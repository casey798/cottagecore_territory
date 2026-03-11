import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem, query, updateItem } from '../../shared/db';
import { verifyQrPayload } from '../../shared/hmac';
import { success, error, ErrorCode } from '../../shared/response';
import { scanQrSchema } from '../../shared/schemas';
import { getTodayISTString } from '../../shared/time';
import { MINIGAME_POOL } from '../../shared/minigames';
import {
  DailyConfig,
  Location,
  LocationMinigameSet,
  PlayerAssignment,
  PlayerLock,
  User,
  GameSession,
  AvailableMinigame,
} from '../../shared/types';

const DAILY_XP_CAP = 100;

const PICK_COUNT = 5;

function pickRandomMinigames(excludeIds: string[]): AvailableMinigame[] {
  const allEntries = Object.entries(MINIGAME_POOL);

  let pool = allEntries.filter(([id]) => !excludeIds.includes(id));

  // Last resort: if all 12 played, ignore exclusions
  if (pool.length === 0) {
    pool = allEntries;
  }

  const mapped = pool.map(([id, meta]) => ({
    minigameId: id,
    name: meta.name,
    timeLimit: meta.timeLimit,
    description: meta.description,
    completed: false,
  }));

  const shuffled = mapped.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(PICK_COUNT, shuffled.length));
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const parsed = scanQrSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { qrData } = parsed.data;
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

    // Step 6: Daily cap reached
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 400);
    }

    if (user.todayXp >= DAILY_XP_CAP) {
      return error(ErrorCode.DAILY_CAP_REACHED, 'You have reached the daily XP cap', 403);
    }

    // Step 7: Resolve minigame set (locked per player+location+day)
    const savedSet = assignment?.locationMinigames?.[locationId];
    let availableMinigames: AvailableMinigame[];

    if (savedSet) {
      // Return the locked set with completed flags
      const completedSet = new Set(savedSet.completedMinigameIds);
      availableMinigames = savedSet.minigameIds.map((id) => {
        const meta = MINIGAME_POOL[id];
        return {
          minigameId: id,
          name: meta.name,
          timeLimit: meta.timeLimit,
          description: meta.description,
          completed: completedSet.has(id),
        };
      });

      // All completed = exhausted
      if (availableMinigames.every((m) => m.completed)) {
        return error(
          ErrorCode.LOCATION_EXHAUSTED,
          "You've mastered all challenges here today — try another location!",
          400,
        );
      }
    } else {
      // First scan at this location today — roll and lock a new set
      const { items: recentSessions } = await query<GameSession>(
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

      const wonAtLocation = recentSessions
        .filter((s) => s.locationId === locationId && s.result === 'win' && s.completedAt)
        .map((s) => s.minigameId);

      availableMinigames = pickRandomMinigames(wonAtLocation);

      if (availableMinigames.length === 0) {
        return error(
          ErrorCode.LOCATION_EXHAUSTED,
          "You've mastered all challenges here today — try another location!",
          400,
        );
      }

      // Save the locked set to the player-assignments record
      const newSet: LocationMinigameSet = {
        minigameIds: availableMinigames.map((m) => m.minigameId),
        completedMinigameIds: [],
      };

      if (assignment) {
        const updatedMap = {
          ...(assignment.locationMinigames || {}),
          [locationId]: newSet,
        };

        await updateItem(
          'player-assignments',
          { dateUserId },
          'SET locationMinigames = :lm',
          { ':lm': updatedMap },
        );
      }
    }

    // Check if XP was already earned at this location today
    // (query sessions if we haven't already)
    let xpAvailable = true;
    if (savedSet) {
      // Need to check game-sessions for XP status
      const { items: recentSessions } = await query<GameSession>(
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
      xpAvailable = !recentSessions.some(
        (s) => s.locationId === locationId && s.result === 'win' && s.xpEarned > 0 && s.completedAt,
      );
    }

    return success({
      locationId,
      locationName: location.name,
      availableMinigames,
      xpAvailable,
    });
  } catch (err) {
    console.error('scanQR error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
