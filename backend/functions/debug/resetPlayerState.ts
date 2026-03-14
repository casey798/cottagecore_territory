import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { updateItem, query, deleteItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import { GameSession } from '../../shared/types';

/**
 * DEV ONLY — full reset of a player's daily game state:
 *   1. todayXp → 0 (preserves seasonXp, totalWins, streak, clan)
 *   2. Delete today's player-assignments for this user
 *   3. Delete today's game-sessions for this user
 *   4. Delete today's player-locks for this user
 *
 * Accepts optional { userId } in body for admin-initiated resets.
 * Falls back to JWT caller's userId if not provided.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const stage = process.env.STAGE || 'dev';
  if (stage !== 'dev') {
    return error(ErrorCode.FORBIDDEN, 'This endpoint is only available in dev', 403);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const userId = body.userId || extractUserId(event);
    const today = getTodayISTString();

    // 1. Reset user todayXp to 0 (leave everything else intact)
    await updateItem(
      'users',
      { userId },
      'SET todayXp = :zero',
      { ':zero': 0 },
    );

    // 2. Delete today's player-assignment
    const dateUserId = `${today}#${userId}`;
    await deleteItem('player-assignments', { dateUserId });

    // 3. Delete today's game sessions
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

    // 4. Delete today's player locks for this user
    const locationIds = new Set(todaySessions.map((s) => s.locationId));
    for (const locationId of locationIds) {
      const dateUserLocation = `${today}#${userId}#${locationId}`;
      await deleteItem('player-locks', { dateUserLocation });
    }

    console.log(
      `[resetPlayerState] Reset user ${userId}: todayXp=0, deleted assignment, ${todaySessions.length} sessions, ${locationIds.size} locks`,
    );

    return success({
      reset: true,
      sessionsDeleted: todaySessions.length,
      locksCleared: locationIds.size,
      assignmentCleared: true,
    });
  } catch (err) {
    console.error('resetPlayerState error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
