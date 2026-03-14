import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem, query, updateItem } from '../../shared/db';
import { isWithinGeofence } from '../../shared/geo';
import { verifyQrPayload } from '../../shared/hmac';
import { success, error, ErrorCode } from '../../shared/response';
import { scanQrSchema } from '../../shared/schemas';
import { getTodayISTString } from '../../shared/time';
import { MINIGAME_POOL } from '../../shared/minigames';
import {
  DailyConfig,
  Location,
  PlayerAssignment,
  PlayerLock,
  User,
  GameSession,
  AvailableMinigame,
} from '../../shared/types';

const DAILY_XP_CAP = 100;
const SET_SIZE = 6;

function pickRandomMinigames(excludeIds: string[]): string[] {
  const allEntries = Object.keys(MINIGAME_POOL);
  const pool = allEntries.filter((id) => !excludeIds.includes(id));
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(SET_SIZE, shuffled.length));
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const parsed = scanQrSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { qrData, gpsLat, gpsLng } = parsed.data;
    const today = getTodayISTString();

    // Step 1: Check QR date matches today
    if (qrData.d !== today) {
      return error(ErrorCode.QR_EXPIRED, 'QR code has expired', 400);
    }

    // Step 2: Verify HMAC using daily config's qrSecret
    const dailyConfig = await getItem<DailyConfig>('daily-config', { date: today });
    if (!dailyConfig) {
      return error(ErrorCode.GAME_INACTIVE, 'No daily config found for today', 400);
    }

    const stage = process.env.STAGE || 'dev';
    const isDevBypass = stage === 'dev' && qrData.h === 'dev-bypass';
    if (!isDevBypass && !verifyQrPayload(qrData, dailyConfig.qrSecret)) {
      return error(ErrorCode.QR_INVALID, 'Invalid QR code', 400);
    }

    const locationId = qrData.l;

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
      // First scan at this location today — roll a new set excluding won minigames
      minigameIds = pickRandomMinigames([...wonToday]);

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
        completed: wonToday.has(id),
      };
    });

    // Check if XP was already earned at this location today
    const xpAvailable = !todaySessions.some(
      (s) => s.locationId === locationId && s.result === 'win' && s.xpEarned > 0 && s.completedAt,
    );

    return success({
      locationId,
      locationName: location.name,
      availableMinigames,
      xpAvailable,
      capReached,
    });
  } catch (err) {
    console.error('scanQR error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
