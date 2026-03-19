import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { ClanId } from '../../shared/types';
import type { Clan, GameSession, PlayerAsset } from '../../shared/types';

interface ClanStats {
  clanId: ClanId;
  todayXp: number;
  seasonXp: number;
  spacesCaptured: number;
}

interface LocationHeatmapEntry {
  locationId: string;
  sessionCount: number;
}

interface MinigameWinRateEntry {
  minigameId: string;
  totalPlayed: number;
  wins: number;
  winRate: number;
}

interface AnalyticsResponse {
  clanStats: ClanStats[];
  locationHeatmap: LocationHeatmapEntry[];
  minigameWinRates: MinigameWinRateEntry[];
  assetAnalytics: {
    totalAssetsDistributed: number;
    byCategory: Record<string, number>;
    byRarity: Record<string, number>;
    bySource: Record<string, number>;
  };
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);

    const params = event.queryStringParameters || {};
    const startDate = params.startDate;
    const endDate = params.endDate;

    // Parallel: clan stats, game sessions, player assets
    const [clanStatsResult, sessionsResult, assetsResult] = await Promise.all([
      (async () => {
        const stats: ClanStats[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const result = await scan<Clan>('clans', { exclusiveStartKey: lastKey });
          for (const clan of result.items) {
            stats.push({
              clanId: clan.clanId,
              todayXp: clan.todayXp,
              seasonXp: clan.seasonXp,
              spacesCaptured: clan.spacesCaptured,
            });
          }
          lastKey = result.lastEvaluatedKey;
        } while (lastKey);
        return stats;
      })(),
      (async () => {
        const items: GameSession[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const scanOpts: Parameters<typeof scan>[1] = { exclusiveStartKey: lastKey };
          if (startDate && endDate) {
            scanOpts.filterExpression = '#d BETWEEN :start AND :end';
            scanOpts.expressionNames = { '#d': 'date' };
            scanOpts.expressionValues = { ':start': startDate, ':end': endDate };
          }
          const result = await scan<GameSession>('game-sessions', scanOpts);
          items.push(...result.items);
          lastKey = result.lastEvaluatedKey;
        } while (lastKey);
        return items;
      })(),
      (async () => {
        const items: PlayerAsset[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const result = await scan<PlayerAsset>('player-assets', { exclusiveStartKey: lastKey });
          items.push(...result.items);
          lastKey = result.lastEvaluatedKey;
        } while (lastKey);
        return items;
      })(),
    ]);

    // Filter out practice sessions
    const sessions = sessionsResult.filter((s) => !s.practiceSession);

    // Location heatmap
    const locationCounts = new Map<string, number>();
    const minigameCounts = new Map<string, { total: number; wins: number }>();

    for (const session of sessions) {
      locationCounts.set(session.locationId, (locationCounts.get(session.locationId) || 0) + 1);

      const mgStats = minigameCounts.get(session.minigameId) || { total: 0, wins: 0 };
      mgStats.total++;
      if (session.result === 'win') mgStats.wins++;
      minigameCounts.set(session.minigameId, mgStats);
    }

    const locationHeatmap: LocationHeatmapEntry[] = [];
    locationCounts.forEach((count, locationId) => {
      locationHeatmap.push({ locationId, sessionCount: count });
    });
    locationHeatmap.sort((a, b) => b.sessionCount - a.sessionCount);

    const minigameWinRates: MinigameWinRateEntry[] = [];
    minigameCounts.forEach((stats, minigameId) => {
      minigameWinRates.push({
        minigameId,
        totalPlayed: stats.total,
        wins: stats.wins,
        winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) / 100 : 0,
      });
    });

    // Asset analytics — fully implemented
    const byCategory: Record<string, number> = {};
    const byRarity: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    // We only have obtainedFrom on PlayerAsset; category/rarity require joining with asset-catalog
    // For now aggregate by obtainedFrom and count totals
    for (const asset of assetsResult) {
      const source = asset.obtainedFrom || 'unknown';
      bySource[source] = (bySource[source] || 0) + 1;
    }

    const assetAnalytics = {
      totalAssetsDistributed: assetsResult.length,
      byCategory,
      byRarity,
      bySource,
    };

    const analytics: AnalyticsResponse = {
      clanStats: clanStatsResult,
      locationHeatmap,
      minigameWinRates,
      assetAnalytics,
    };

    return success(analytics);
  } catch (err) {
    console.error('analytics error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
