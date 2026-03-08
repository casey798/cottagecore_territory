import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import crypto from 'crypto';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem } from '../../shared/db';
import { generatePuzzle, MINIGAME_POOL } from '../../shared/minigames';
import { success, error, ErrorCode } from '../../shared/response';
import { startMinigameSchema } from '../../shared/schemas';
import { getTodayISTString } from '../../shared/time';
import {
  Difficulty,
  DailyConfig,
  GameResult,
  GameSession,
  Location,
  PlayerLock,
  User,
} from '../../shared/types';

const DAILY_XP_CAP = 100;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const parsed = startMinigameSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { locationId, minigameId, coopPartnerId } = parsed.data;

    // Validate minigame ID
    if (!MINIGAME_POOL[minigameId]) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid minigame ID', 400);
    }

    // Verify location exists
    const location = await getItem<Location>('locations', { locationId });
    if (!location) {
      return error(ErrorCode.NOT_FOUND, 'Location not found', 404);
    }

    // Verify player hasn't hit daily cap
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    if (user.todayXp >= DAILY_XP_CAP) {
      return error(ErrorCode.DAILY_CAP_REACHED, 'You have reached the daily XP cap', 403);
    }

    // Check location lock
    const today = getTodayISTString();
    const dateUserLocation = `${today}#${userId}#${locationId}`;
    const lock = await getItem<PlayerLock>('player-locks', { dateUserLocation });
    if (lock) {
      return error(ErrorCode.LOCATION_LOCKED, 'This location is locked for you until tomorrow', 403);
    }

    // Co-op validation
    if (coopPartnerId) {
      const partner = await getItem<User>('users', { userId: coopPartnerId });
      if (!partner) {
        return error(ErrorCode.NOT_FOUND, 'Co-op partner not found', 404);
      }
      if (partner.clan !== user.clan) {
        return error(ErrorCode.VALIDATION_ERROR, 'Co-op partner must be in the same clan', 400);
      }
      if (partner.todayXp >= DAILY_XP_CAP) {
        return error(ErrorCode.DAILY_CAP_REACHED, 'Co-op partner has reached the daily XP cap', 403);
      }
    }

    // Get difficulty from daily config
    const dailyConfig = await getItem<DailyConfig>('daily-config', { date: today });
    const difficulty = (dailyConfig?.difficulty as Difficulty) || Difficulty.Medium;

    // Generate puzzle using shared minigames module
    const puzzleData = generatePuzzle(minigameId, difficulty);

    const sessionId = crypto.randomUUID();
    const salt = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();

    const session: GameSession = {
      sessionId,
      userId,
      locationId,
      minigameId,
      date: today,
      startedAt: now,
      completedAt: null,
      result: GameResult.Abandoned,
      xpEarned: 0,
      chestDropped: false,
      chestAssetId: null,
      completionHash: '',
      coopPartnerId: coopPartnerId ?? null,
      _salt: salt,
      puzzleData,
      timeLimit: puzzleData.timeLimit,
    };

    await putItem('game-sessions', session as unknown as Record<string, unknown>);

    // Return puzzle config without the solution
    return success({
      sessionId,
      serverTimestamp: now,
      timeLimit: puzzleData.timeLimit,
      puzzleData: {
        type: puzzleData.type,
        config: puzzleData.config,
        timeLimit: puzzleData.timeLimit,
      },
    });
  } catch (err) {
    console.error('startMinigame error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
