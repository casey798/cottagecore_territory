import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem, updateItem, query, deleteItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import { GameSession, User, Clan } from '../../shared/types';
import { generatePlayerAssignment } from '../../shared/generatePlayerAssignment';

/**
 * DEV ONLY — full reset of a player's daily game state:
 *   1. Read user's current todayXp, then zero it and deduct from clan
 *   2. Delete today's player-assignments, then regenerate via weighted algorithm
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

    // 1a. Read user's current todayXp and clan before zeroing
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }
    const xpToDeduct = user.todayXp || 0;

    // 1b. Reset user todayXp to 0 (leave everything else intact)
    await updateItem(
      'users',
      { userId },
      'SET todayXp = :zero',
      { ':zero': 0 },
    );

    // 1c. Deduct the player's XP contribution from their clan
    if (xpToDeduct > 0) {
      const clan = await getItem<Clan>('clans', { clanId: user.clan });
      const currentClanXp = clan?.todayXp ?? 0;
      const newClanXp = Math.max(0, currentClanXp - xpToDeduct);

      if (newClanXp === 0) {
        // Clan XP zeroed out — clear timestamp and participants too
        await updateItem(
          'clans',
          { clanId: user.clan },
          'SET todayXp = :zero, todayParticipants = :zero REMOVE todayXpTimestamp',
          { ':zero': 0 },
        );
      } else {
        await updateItem(
          'clans',
          { clanId: user.clan },
          'SET todayXp = :newXp',
          { ':newXp': newClanXp },
        );
      }
    }

    // 2a. Delete today's player-assignment
    const dateUserId = `${today}#${userId}`;
    await deleteItem('player-assignments', { dateUserId });

    // 2b. Regenerate assignment using weighted algorithm
    let assignmentRegenerated = false;
    let assignmentWarning: string | undefined;
    try {
      await generatePlayerAssignment(userId, today);
      assignmentRegenerated = true;
    } catch (regenErr) {
      const msg = regenErr instanceof Error ? regenErr.message : String(regenErr);
      assignmentWarning = `Assignment regeneration failed: ${msg}`;
      console.warn(`[resetPlayerState] ${assignmentWarning}`);
    }

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
      `[resetPlayerState] Reset user ${userId}: todayXp=0, xpDeducted=${xpToDeduct} from clan ${user.clan}, ` +
      `deleted assignment (regen=${assignmentRegenerated}), ${todaySessions.length} sessions, ${locationIds.size} locks`,
    );

    return success({
      reset: true,
      sessionsDeleted: todaySessions.length,
      locksCleared: locationIds.size,
      assignmentCleared: true,
      xpDeducted: xpToDeduct,
      assignmentRegenerated,
      ...(assignmentWarning && { assignmentWarning }),
    });
  } catch (err) {
    console.error('resetPlayerState error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
