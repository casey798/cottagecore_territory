import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import crypto from 'crypto';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem, query } from '../../shared/db';
import { MINIGAME_POOL } from '../../shared/minigames';
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

    // Verify user exists
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    // Check location lock
    const today = getTodayISTString();
    const dateUserLocation = `${today}#${userId}#${locationId}`;
    const lock = await getItem<PlayerLock>('player-locks', { dateUserLocation });
    if (lock) {
      return error(ErrorCode.LOCATION_LOCKED, 'This location is locked for you until tomorrow', 403);
    }

    // Check if player already won this minigame today (across any location)
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
    const alreadyWon = todaySessions.some(
      (s) => s.minigameId === minigameId && s.result === GameResult.Win && s.completedAt !== null,
    );
    if (alreadyWon) {
      return error(ErrorCode.MINIGAME_ALREADY_WON, 'You have already won this challenge today', 400);
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
    }

    // Get difficulty from daily config
    const dailyConfig = await getItem<DailyConfig>('daily-config', { date: today });
    const difficulty = (dailyConfig?.difficulty as Difficulty) || Difficulty.Medium;

    const meta = MINIGAME_POOL[minigameId];
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
      timeLimit: meta.timeLimit,
    };

    await putItem('game-sessions', session as unknown as Record<string, unknown>);

    return success({
      sessionId,
      serverTimestamp: now,
      timeLimit: meta.timeLimit,
      salt,
      puzzleData: {
        type: minigameId,
        difficulty,
      },
    });
  } catch (err) {
    console.error('startMinigame error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
