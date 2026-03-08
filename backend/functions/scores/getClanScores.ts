import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { Clan, ClanId, ClanScore } from '../../shared/types';

const CLAN_IDS: ClanId[] = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale];

export const handler = async (
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const clans = await Promise.all(
      CLAN_IDS.map(async (clanId) => {
        const clan = await getItem<Clan>('clans', { clanId });
        return {
          clanId,
          todayXp: clan?.todayXp ?? 0,
          seasonXp: clan?.seasonXp ?? 0,
          spacesCaptured: clan?.spacesCaptured ?? 0,
        } satisfies ClanScore;
      })
    );

    clans.sort((a, b) => b.todayXp - a.todayXp);

    return success({ clans });
  } catch (err) {
    console.error('getClanScores error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get clan scores', 500);
  }
};
