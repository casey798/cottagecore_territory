import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { updateItem, query, deleteItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import { GameSession, PlayerLock } from '../../shared/types';

/**
 * DEV ONLY — resets the calling user's daily progress:
 *   1. todayXp → 0
 *   2. Delete today's game-sessions for this user
 *   3. Delete today's player-locks for this user
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const stage = process.env.STAGE || 'dev';
  if (stage !== 'dev') {
    return error(ErrorCode.VALIDATION_ERROR, 'This endpoint is only available in dev', 403);
  }

  try {
    const userId = extractUserId(event);
    const today = getTodayISTString();

    // 1. Reset user todayXp
    await updateItem(
      'users',
      { userId },
      'SET todayXp = :zero',
      { ':zero': 0 },
    );

    // 2. Delete today's game sessions
    const { items: todaySessions } = await query<GameSession>(
      'game-sessions',
      'userId = :uid AND #d = :date',
      { ':uid': userId, ':date': today },
      {
        indexName: 'UserDateIndex',
        expressionNames: { '#d': 'date' },
        limit: 100,
      },
    );

    for (const session of todaySessions) {
      await deleteItem('game-sessions', { sessionId: session.sessionId });
    }

    // 3. Delete today's player locks for this user
    // Player lock PK format: "YYYY-MM-DD#userId#locationId"
    const lockPrefix = `${today}#${userId}#`;
    // We can't query player-locks by prefix since PK is the full composite key.
    // Instead, derive lock keys from sessions' locationIds.
    const locationIds = new Set(todaySessions.map((s) => s.locationId));
    for (const locationId of locationIds) {
      const dateUserLocation = `${today}#${userId}#${locationId}`;
      await deleteItem('player-locks', { dateUserLocation });
    }

    console.log(`[devReset] Reset user ${userId}: todayXp=0, deleted ${todaySessions.length} sessions, cleared ${locationIds.size} locks`);

    return success({
      reset: true,
      sessionsDeleted: todaySessions.length,
      locksCleared: locationIds.size,
    });
  } catch (err) {
    console.error('devReset error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
