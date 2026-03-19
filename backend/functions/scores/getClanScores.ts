import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem, scan } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { Clan, ClanId, ClanScore, CapturedSpace } from '../../shared/types';

const CLAN_IDS: ClanId[] = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];

export const handler = async (
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Count captured spaces per clan from the captured-spaces table (source of truth)
    const spaceCounts: Record<string, number> = {};
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<CapturedSpace>('captured-spaces', {
        exclusiveStartKey: lastKey,
      });
      for (const space of result.items) {
        spaceCounts[space.clan] = (spaceCounts[space.clan] || 0) + 1;
      }
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    const clans = await Promise.all(
      CLAN_IDS.map(async (clanId) => {
        const clan = await getItem<Clan>('clans', { clanId });
        return {
          clanId,
          todayXp: clan?.todayXp ?? 0,
          seasonXp: clan?.seasonXp ?? 0,
          spacesCaptured: spaceCounts[clanId] ?? 0,
          todayParticipants: clan?.todayParticipants ?? 0,
          rosterSize: clan?.rosterSize ?? 0,
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
