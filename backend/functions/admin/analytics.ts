import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { ClanId } from '../../shared/types';
import type { Clan, GameSession, CapturedSpace } from '../../shared/types';

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
  };
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const claims = event.requestContext.authorizer?.claims;
    if (!claims) return error(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    const groups: string[] = (claims['cognito:groups'] as string || '').split(',').filter(Boolean);
    if (!groups.some((g) => g.toLowerCase() === 'admin')) return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);

    // Clan stats
    const clanStats: ClanStats[] = [];
    let lastClanKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<Clan>('clans', {
        exclusiveStartKey: lastClanKey,
      });
      for (const clan of result.items) {
        clanStats.push({
          clanId: clan.clanId,
          todayXp: clan.todayXp,
          seasonXp: clan.seasonXp,
          spacesCaptured: clan.spacesCaptured,
        });
      }
      lastClanKey = result.lastEvaluatedKey;
    } while (lastClanKey);

    // Location heatmap from game sessions
    const locationCounts = new Map<string, number>();
    const minigameCounts = new Map<string, { total: number; wins: number }>();
    let lastSessionKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<GameSession>('game-sessions', {
        exclusiveStartKey: lastSessionKey,
      });
      for (const session of result.items) {
        // Location heatmap
        const locCount = locationCounts.get(session.locationId) || 0;
        locationCounts.set(session.locationId, locCount + 1);

        // Minigame win rates
        const mgId = session.minigameId;
        const mgStats = minigameCounts.get(mgId) || { total: 0, wins: 0 };
        mgStats.total++;
        if (session.result === 'win') {
          mgStats.wins++;
        }
        minigameCounts.set(mgId, mgStats);
      }
      lastSessionKey = result.lastEvaluatedKey;
    } while (lastSessionKey);

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

    // Asset analytics - stub with proper structure
    // Full implementation would scan player-assets table
    const assetAnalytics = {
      totalAssetsDistributed: 0,
      byCategory: {
        banner: 0,
        statue: 0,
        furniture: 0,
        mural: 0,
        pet: 0,
        special: 0,
      },
    };

    const analytics: AnalyticsResponse = {
      clanStats,
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
