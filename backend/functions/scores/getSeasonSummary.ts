import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem, scan } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { extractUserId } from '../../shared/auth';
import { Clan, ClanId, User, CapturedSpace, SpaceDecoration } from '../../shared/types';

const CLAN_IDS: ClanId[] = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];

interface ClanSummary {
  clanId: ClanId;
  seasonXp: number;
  spacesCaptured: number;
}

interface PlayerRankEntry {
  userId: string;
  displayName: string;
  clan: ClanId;
  seasonXp: number;
}

interface StreakRankEntry {
  userId: string;
  displayName: string;
  clan: ClanId;
  bestStreak: number;
}

interface DecoratedSpaceEntry {
  spaceId: string;
  spaceName: string;
  decoratorCount: number;
}

interface PlayerSeasonStats {
  seasonXp: number;
  totalWins: number;
  bestStreak: number;
  spacesDiscovered: number;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    // 1. Fetch all clan records
    const clanRecords = await Promise.all(
      CLAN_IDS.map(async (clanId) => {
        const clan = await getItem<Clan>('clans', { clanId });
        return {
          clanId,
          seasonXp: clan?.seasonXp ?? 0,
          spacesCaptured: clan?.spacesCaptured ?? 0,
        } satisfies ClanSummary;
      })
    );

    // Count actual captured spaces from captured-spaces table
    const spaceCounts: Record<string, number> = {};
    let lastSpaceKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<CapturedSpace>('captured-spaces', {
        exclusiveStartKey: lastSpaceKey,
      });
      for (const space of result.items) {
        spaceCounts[space.clan] = (spaceCounts[space.clan] || 0) + 1;
      }
      lastSpaceKey = result.lastEvaluatedKey;
    } while (lastSpaceKey);

    const clans: ClanSummary[] = clanRecords.map((c) => ({
      ...c,
      spacesCaptured: spaceCounts[c.clanId] ?? c.spacesCaptured,
    }));

    // Determine winner by spacesCaptured
    const sorted = [...clans].sort((a, b) => b.spacesCaptured - a.spacesCaptured);
    const winnerClan = sorted[0].spacesCaptured > 0 ? sorted[0].clanId : null;

    // 2. Scan all users for top players and streaks
    const allUsers: User[] = [];
    let lastUserKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<User>('users', {
        exclusiveStartKey: lastUserKey,
      });
      allUsers.push(...result.items);
      lastUserKey = result.lastEvaluatedKey;
    } while (lastUserKey);

    // Top 10 by seasonXp
    const byXp = [...allUsers]
      .sort((a, b) => b.seasonXp - a.seasonXp)
      .slice(0, 10)
      .map((u) => ({
        userId: u.userId,
        displayName: u.displayName,
        clan: u.clan,
        seasonXp: u.seasonXp,
      } satisfies PlayerRankEntry));

    // Top 5 by bestStreak
    const byStreak = [...allUsers]
      .sort((a, b) => b.bestStreak - a.bestStreak)
      .slice(0, 5)
      .map((u) => ({
        userId: u.userId,
        displayName: u.displayName,
        clan: u.clan,
        bestStreak: u.bestStreak,
      } satisfies StreakRankEntry));

    // 3. Most decorated spaces — count distinct users per spaceId from space-decorations
    const spaceDecorators: Record<string, Set<string>> = {};
    let lastDecoKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<SpaceDecoration & { userSpaceId: string }>('space-decorations', {
        exclusiveStartKey: lastDecoKey,
      });
      for (const deco of result.items) {
        // userSpaceId format: "userId#spaceId"
        const parts = deco.userSpaceId.split('#');
        if (parts.length >= 2) {
          const decoUserId = parts[0];
          const spaceId = parts.slice(1).join('#');
          if (!spaceDecorators[spaceId]) {
            spaceDecorators[spaceId] = new Set();
          }
          spaceDecorators[spaceId].add(decoUserId);
        }
      }
      lastDecoKey = result.lastEvaluatedKey;
    } while (lastDecoKey);

    // Build a spaceId -> spaceName lookup from captured-spaces
    const spaceNameMap: Record<string, string> = {};
    let lastCsKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<CapturedSpace>('captured-spaces', {
        exclusiveStartKey: lastCsKey,
      });
      for (const space of result.items) {
        spaceNameMap[space.spaceId] = space.spaceName;
      }
      lastCsKey = result.lastEvaluatedKey;
    } while (lastCsKey);

    const mostDecoratedSpaces: DecoratedSpaceEntry[] = Object.entries(spaceDecorators)
      .map(([spaceId, users]) => ({
        spaceId,
        spaceName: spaceNameMap[spaceId] ?? spaceId,
        decoratorCount: users.size,
      }))
      .sort((a, b) => b.decoratorCount - a.decoratorCount)
      .slice(0, 5);

    // 4. Current player's stats
    const currentUser = allUsers.find((u) => u.userId === userId);

    // Count spaces the player has discovered (has game sessions at distinct locations)
    // We approximate with the user's totalWins as a proxy; a full query would scan game-sessions
    const playerStats: PlayerSeasonStats = {
      seasonXp: currentUser?.seasonXp ?? 0,
      totalWins: currentUser?.totalWins ?? 0,
      bestStreak: currentUser?.bestStreak ?? 0,
      spacesDiscovered: 0,
    };

    // Count distinct locations from game-sessions for this player
    let lastSessionKey: Record<string, unknown> | undefined;
    const discoveredLocations = new Set<string>();
    do {
      const result = await scan<{ userId: string; locationId: string }>('game-sessions', {
        filterExpression: 'userId = :uid',
        expressionValues: { ':uid': userId },
        exclusiveStartKey: lastSessionKey,
      });
      for (const session of result.items) {
        discoveredLocations.add(session.locationId);
      }
      lastSessionKey = result.lastEvaluatedKey;
    } while (lastSessionKey);
    playerStats.spacesDiscovered = discoveredLocations.size;

    return success({
      winnerClan,
      clans,
      topPlayersByXp: byXp,
      topPlayersByStreak: byStreak,
      mostDecoratedSpaces,
      playerStats,
    });
  } catch (err) {
    console.error('getSeasonSummary error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get season summary', 500);
  }
};
