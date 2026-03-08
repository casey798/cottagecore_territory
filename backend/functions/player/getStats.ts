import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { User, Clan, GetPlayerStatsResponse } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const user = await getItem<User>('users', { userId });

    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    const clan = await getItem<Clan>('clans', { clanId: user.clan });

    const stats: GetPlayerStatsResponse = {
      todayXp: user.todayXp,
      seasonXp: user.seasonXp,
      totalWins: user.totalWins,
      currentStreak: user.currentStreak,
      bestStreak: user.bestStreak,
      clan: user.clan,
      clanTodayXp: clan?.todayXp ?? 0,
      clanSeasonXp: clan?.seasonXp ?? 0,
    };

    return success(stats);
  } catch (err) {
    console.error('getStats error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get stats', 500);
  }
};
