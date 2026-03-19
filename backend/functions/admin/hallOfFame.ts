import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import type { User, CapturedSpace, GameSession } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // Scan all users
    const allUsers: User[] = [];
    let lastUserKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<User>('users', { exclusiveStartKey: lastUserKey });
      allUsers.push(...result.items);
      lastUserKey = result.lastEvaluatedKey;
    } while (lastUserKey);

    // Scan captured spaces
    const allSpaces: CapturedSpace[] = [];
    let lastSpaceKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<CapturedSpace>('captured-spaces', { exclusiveStartKey: lastSpaceKey });
      allSpaces.push(...result.items);
      lastSpaceKey = result.lastEvaluatedKey;
    } while (lastSpaceKey);

    // Count game sessions
    let totalGameSessions = 0;
    let lastSessionKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<GameSession>('game-sessions', { exclusiveStartKey: lastSessionKey });
      totalGameSessions += result.items.length;
      lastSessionKey = result.lastEvaluatedKey;
    } while (lastSessionKey);

    // Territories per clan
    const territoriesPerClan: Record<string, number> = {
      ember: 0, tide: 0, bloom: 0, gale: 0, hearth: 0,
    };
    for (const space of allSpaces) {
      if (space.clan && territoriesPerClan[space.clan] !== undefined) {
        territoriesPerClan[space.clan]++;
      }
    }

    // Winning clan
    let winningClan: { clanId: string; spacesCaptured: number } | null = null;
    let maxSpaces = 0;
    for (const [clanId, count] of Object.entries(territoriesPerClan)) {
      if (count > maxSpaces) {
        maxSpaces = count;
        winningClan = { clanId, spacesCaptured: count };
      }
    }

    // Top 10 players by seasonXp
    const sortedUsers = [...allUsers]
      .filter((u) => u.seasonXp > 0)
      .sort((a, b) => b.seasonXp - a.seasonXp)
      .slice(0, 10);

    const topPlayers = sortedUsers.map((u, i) => ({
      rank: i + 1,
      displayName: u.displayName,
      clan: u.clan,
      seasonXp: u.seasonXp,
      totalWins: u.totalWins,
      bestStreak: u.bestStreak,
    }));

    // Longest streak holders
    const maxStreak = allUsers.reduce((max, u) => Math.max(max, u.bestStreak || 0), 0);
    const longestStreakHolders = maxStreak > 0
      ? allUsers
          .filter((u) => u.bestStreak === maxStreak)
          .map((u) => ({
            displayName: u.displayName,
            clan: u.clan,
            bestStreak: u.bestStreak,
          }))
      : [];

    // Unique players who earned XP
    const totalUniquePlayers = allUsers.filter((u) => u.seasonXp > 0).length;

    return success({
      winningClan,
      territoriesPerClan,
      topPlayers,
      longestStreakHolders,
      seasonStats: {
        totalUniquePlayers,
        totalGameSessions,
      },
    });
  } catch (err) {
    console.error('[hallOfFame] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
