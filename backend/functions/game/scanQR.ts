import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem, query, updateItem } from '../../shared/db';
import { isWithinGeofence } from '../../shared/geo';
import { verifyQrPayload, verifyPermanentQrPayload } from '../../shared/hmac';
import { success, error, ErrorCode } from '../../shared/response';
import { scanQrSchema } from '../../shared/schemas';
import { getTodayISTString } from '../../shared/time';
import { isQuietModeActive } from '../../shared/quietMode';
import { MINIGAME_POOL } from '../../shared/minigames';
import {
  COOP_MINIGAME_IDS,
  DailyConfig,
  Location,
  LocationMasterConfig,
  LocationModifiers,
  PlayerAssignment,
  PlayerLock,
  User,
  GameSession,
  AvailableMinigame,
} from '../../shared/types';

const DAILY_XP_CAP = 100;
const SOLO_SET_SIZE = 6;
const COOP_SET_SIZE = 3;
const TARGET_EASY = 2;
const TARGET_MEDIUM = 3;
const TARGET_HARD = 1;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandomMinigames(excludeIds: string[], coopOnly: boolean): string[] {
  const allEntries = Object.keys(MINIGAME_POOL);
  const coopSet = new Set(COOP_MINIGAME_IDS);

  let pool: string[];
  if (coopOnly) {
    pool = allEntries.filter((id) => coopSet.has(id) && !excludeIds.includes(id));
  } else {
    pool = allEntries.filter((id) => !coopSet.has(id) && !excludeIds.includes(id));
  }

  // Co-op: flat random (only 6 games, no meaningful difficulty split)
  if (coopOnly) {
    return shuffle(pool).slice(0, Math.min(COOP_SET_SIZE, pool.length));
  }

  // Solo: difficulty-bucketed selection (2 Easy + 3 Medium + 1 Hard)
  const easy: string[] = [];
  const medium: string[] = [];
  const hard: string[] = [];

  for (const id of pool) {
    const diff = MINIGAME_POOL[id].difficulty;
    if (diff === 'easy') easy.push(id);
    else if (diff === 'hard') hard.push(id);
    else medium.push(id);
  }

  const pickedEasy = shuffle(easy).slice(0, TARGET_EASY);
  const pickedHard = shuffle(hard).slice(0, TARGET_HARD);

  // Shortfall from easy/hard gets compensated from medium
  const shortfall = (TARGET_EASY - pickedEasy.length) + (TARGET_HARD - pickedHard.length);
  const pickedMedium = shuffle(medium).slice(0, TARGET_MEDIUM + shortfall);

  const result = [...pickedEasy, ...pickedMedium, ...pickedHard];
  return result.slice(0, SOLO_SET_SIZE);
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const parsed = scanQrSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    // Quiet mode check — block all new sessions
    if (await isQuietModeActive()) {
      return error(ErrorCode.QUIET_MODE, 'The game is currently in quiet mode. No new sessions can be started.', 403);
    }

    const { qrData, gpsLat, gpsLng } = parsed.data;
    const today = getTodayISTString();
    const isPermanentQr = qrData.v === 2 || qrData.d === 'permanent';

    const stage = process.env.STAGE || 'dev';
    const isDevBypass = stage === 'dev' && qrData.h === 'dev-bypass';
    const locationId = qrData.l;

    // Step 1+2: Verify QR authenticity — branched by QR version
    let dailyConfig: DailyConfig | undefined;

    if (isPermanentQr) {
      // Permanent QR: verify using per-location secret from location-master-config
      if (!isDevBypass) {
        const mc = await getItem<LocationMasterConfig>('location-master-config', { locationId });
        if (!mc?.qrSecret) {
          return error(ErrorCode.QR_INVALID, 'No permanent QR configured for this location', 400);
        }
        if (!verifyPermanentQrPayload(qrData, mc.qrSecret)) {
          return error(ErrorCode.QR_INVALID, 'Invalid QR code', 400);
        }
      }
      // Still need daily config for activeLocationIds check
      dailyConfig = await getItem<DailyConfig>('daily-config', { date: today }) ?? undefined;
      if (!dailyConfig) {
        return error(ErrorCode.GAME_INACTIVE, 'No daily config found for today', 400);
      }
    } else {
      // Daily QR (v1): existing validation — date must match today
      if (qrData.d !== today) {
        return error(ErrorCode.QR_EXPIRED, 'QR code has expired', 400);
      }
      dailyConfig = await getItem<DailyConfig>('daily-config', { date: today }) ?? undefined;
      if (!dailyConfig) {
        return error(ErrorCode.GAME_INACTIVE, 'No daily config found for today', 400);
      }
      if (!isDevBypass && !verifyQrPayload(qrData, dailyConfig.qrSecret)) {
        return error(ErrorCode.QR_INVALID, 'Invalid QR code', 400);
      }
    }

    // Step 3: Location exists
    const location = await getItem<Location>('locations', { locationId });
    if (!location) {
      return error(ErrorCode.NOT_FOUND, 'Location not found', 400);
    }

    // Step 3b: Geofence check (skip in dev bypass)
    if (!isDevBypass && !isWithinGeofence(gpsLat, gpsLng, location.gpsLat, location.gpsLng, location.geofenceRadius)) {
      return error(ErrorCode.GPS_OUT_OF_RANGE, 'You must be at the location to scan', 400);
    }

    // Step 4: Location in player's assigned set
    const dateUserId = `${today}#${userId}`;
    const assignment = await getItem<PlayerAssignment>('player-assignments', { dateUserId });
    if (!assignment || !assignment.assignedLocationIds.includes(locationId)) {
      if (isDevBypass && dailyConfig.activeLocationIds.includes(locationId)) {
        console.log(`[scanQR] Dev bypass: no assignment but location ${locationId} is in daily-config`);
      } else {
        return error(ErrorCode.NOT_ASSIGNED, 'You are not assigned to this location today', 400);
      }
    }

    // Bridge the two-table problem: fetch location-master-config (best-effort)
    let masterConfig: LocationMasterConfig | undefined;
    try {
      masterConfig = await getItem<LocationMasterConfig>('location-master-config', { locationId });
    } catch (e) {
      console.warn('[scanQR] Failed to fetch location-master-config (non-fatal):', e);
    }

    const coopOnly = assignment?.coopLocationIds?.includes(locationId) ?? false;
    if (coopOnly) {
      console.log('[scanQR] location', locationId, 'resolved as co-op for user', userId, 'via assignment record');
    }
    const spaceFact = masterConfig?.spaceFact ?? null;
    const firstVisitBonus = masterConfig?.firstVisitBonus ?? false;
    const bonusXP = masterConfig?.bonusXP ?? false;
    const minigameAffinity = masterConfig?.minigameAffinity ?? null;

    // Step 4b: Co-op partner handling
    const coopPartnerId = parsed.data.coopPartnerId ?? null;

    if (coopOnly && !coopPartnerId) {
      // First scan at a co-op-only location without a partner — return partnerRequired
      return success({
        partnerRequired: true as const,
        locationId,
        locationName: location.name,
      });
    }

    // Look up co-op partner if provided (only at co-op-only locations)
    let partnerUser: User | undefined;
    const isDevPartner = stage === 'dev' && coopPartnerId === 'dev-partner';
    if (coopOnly && coopPartnerId) {
      if (isDevPartner) {
        console.log('[scanQR] Dev bypass: using synthetic dev-partner');
      } else {
        partnerUser = await getItem<User>('users', { userId: coopPartnerId });
        if (!partnerUser) {
          return error(ErrorCode.NOT_FOUND, 'Co-op partner not found', 404);
        }
      }
    }

    // Step 5: Location locked
    const dateUserLocation = `${today}#${userId}#${locationId}`;
    const lock = await getItem<PlayerLock>('player-locks', { dateUserLocation });
    if (lock) {
      return error(ErrorCode.LOCATION_LOCKED, 'This location is locked for you until tomorrow', 403);
    }

    // Step 6: Fetch user (needed for cap check in response)
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 400);
    }

    const capReached = user.todayXp >= DAILY_XP_CAP;

    // Step 7: Query all sessions played today (needed for cross-location locking + XP check)
    const { items: todaySessions } = await query<GameSession>(
      'game-sessions',
      'userId = :uid AND #d = :date',
      { ':uid': userId, ':date': today },
      {
        indexName: 'UserDateIndex',
        expressionNames: { '#d': 'date' },
        scanIndexForward: false,
        limit: 50,
      }
    );

    // Flat set of all minigameIds WON today across ALL locations
    const wonToday = new Set(
      todaySessions
        .filter((s) => s.completedAt !== null && s.result === 'win')
        .map((s) => s.minigameId),
    );

    // Step 8: Resolve minigame set (locked per player+location+day)
    const savedSet = assignment?.locationMinigames?.[locationId];
    let minigameIds: string[];

    if (savedSet) {
      minigameIds = savedSet.minigameIds;
    } else {
      // First scan at this location today — roll a new set
      minigameIds = pickRandomMinigames([...wonToday], coopOnly);

      if (minigameIds.length === 0) {
        return error(
          ErrorCode.ALL_MINIGAMES_PLAYED,
          "You've played all available challenges for today. Come back tomorrow!",
          400,
        );
      }

      // Save the locked set to the player-assignments record
      if (assignment) {
        const updatedMap = {
          ...(assignment.locationMinigames || {}),
          [locationId]: { minigameIds },
        };

        await updateItem(
          'player-assignments',
          { dateUserId },
          'SET locationMinigames = :lm',
          { ':lm': updatedMap },
        );
      }
    }

    // Step 9: Build response with live completed flags from game-sessions
    const availableMinigames: AvailableMinigame[] = minigameIds.map((id) => {
      const meta = MINIGAME_POOL[id];
      return {
        minigameId: id,
        name: meta.name,
        timeLimit: meta.timeLimit,
        description: meta.description,
        difficulty: meta.difficulty,
        completed: wonToday.has(id),
      };
    });

    // Check if XP was already earned at this location today
    const xpAvailable = !todaySessions.some(
      (s) => s.locationId === locationId && s.result === 'win' && s.xpEarned > 0 && s.completedAt,
    );

    // Close any previous open sessions (leftAt is null)
    try {
      const now = new Date();
      const nowISO = now.toISOString();
      const thirtyMinAgo = now.getTime() - 30 * 60 * 1000;

      const openSessions = todaySessions.filter((s) => {
        if (s.leftAt) return false;
        // Completed game but player never left
        if (s.completedAt) return true;
        // Abandoned: started > 30 min ago and never completed
        if (!s.completedAt && new Date(s.startedAt).getTime() < thirtyMinAgo) return true;
        return false;
      });

      for (const session of openSessions) {
        const startMs = new Date(session.startedAt).getTime();
        const dwellTime = Math.min(Math.round((now.getTime() - startMs) / 1000), 7200);
        await updateItem(
          'game-sessions',
          { sessionId: session.sessionId },
          'SET leftAt = :leftAt, dwellTime = :dwellTime, leaveReason = :reason',
          { ':leftAt': nowISO, ':dwellTime': dwellTime, ':reason': 'new_scan' },
        ).catch(() => {}); // non-fatal
      }
    } catch (e) {
      console.warn('[scanQR] Failed to close previous sessions (non-fatal):', e);
    }

    // Build locationModifiers for the client
    const locationModifiers: LocationModifiers = {
      coopOnly,
      spaceFact,
      firstVisitBonus,
      bonusXP,
      minigameAffinity,
    };

    return success({
      locationId,
      locationName: location.name,
      availableMinigames,
      xpAvailable,
      capReached,
      locationModifiers,
      ...(coopOnly && (partnerUser || isDevPartner) ? {
        isCoopSession: true,
        partnerDisplayName: isDevPartner ? 'Dev Partner' : partnerUser!.displayName,
      } : {}),
    });
  } catch (err) {
    console.error('scanQR error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
