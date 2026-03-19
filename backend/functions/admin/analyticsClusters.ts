import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, query } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { GameSession, CheckIn, User, LocationMasterConfig, LocationClassification } from '../../shared/types';

const CLUSTER_KEYS = ['nomad', 'seeker', 'drifter', 'forced', 'disengaged', 'null'] as const;
type ClusterKey = (typeof CLUSTER_KEYS)[number];

const CLASSIFICATIONS: LocationClassification[] = [
  'Social Hub', 'Transit / Forced Stay', 'Hidden Gem', 'Dead Zone', 'Unvisited', 'TBD',
];

const PIXEL_MATCH_THRESHOLD = 50;

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function matchCheckinToLocation(
  checkin: CheckIn,
  locations: LocationMasterConfig[],
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const loc of locations) {
    const dx = checkin.pixelX - loc.mapPixelX;
    const dy = checkin.pixelY - loc.mapPixelY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist && dist <= PIXEL_MATCH_THRESHOLD) {
      bestDist = dist;
      bestId = loc.locationId;
    }
  }
  return bestId;
}

function userClusterKey(user: User): ClusterKey {
  return (user.phase1Cluster ?? 'null') as ClusterKey;
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const params = event.queryStringParameters || {};
    const today = getTodayISTString();
    const startDate = params.startDate || today;
    const endDate = params.endDate || today;
    const dates = getDatesInRange(startDate, endDate);
    const dayCount = dates.length || 1;

    // ── Parallel scans ───────────────────────────────────────────────
    const [usersData, sessionsData, locationsData] = await Promise.all([
      scanAll<User>('users'),
      scanAllFiltered<GameSession>('game-sessions', startDate, endDate),
      scanAll<LocationMasterConfig>('location-master-config'),
    ]);

    // Query checkins via DateIndex
    const checkinsData = await queryCheckinsByDates(dates);

    // ── Build lookup maps ────────────────────────────────────────────
    const userClusterMap = new Map<string, ClusterKey>();
    const userClanMap = new Map<string, string>();
    const clusterUsers = new Map<ClusterKey, Set<string>>();
    for (const ck of CLUSTER_KEYS) clusterUsers.set(ck, new Set());

    for (const u of usersData) {
      const ck = userClusterKey(u);
      userClusterMap.set(u.userId, ck);
      userClanMap.set(u.userId, u.clan);
      clusterUsers.get(ck)!.add(u.userId);
    }

    const locClassMap = new Map<string, LocationClassification>();
    for (const loc of locationsData) {
      locClassMap.set(loc.locationId, loc.classification);
    }

    // Filter out practice sessions
    const sessions = sessionsData.filter((s) => !s.practiceSession);

    // ── A) clusterOverview ───────────────────────────────────────────
    // Group sessions by cluster and date
    const clusterSessionsByDate = new Map<ClusterKey, Map<string, Set<string>>>();
    const clusterSessionCounts = new Map<ClusterKey, number>();
    const clusterXpUsers = new Map<ClusterKey, Map<string, Set<string>>>(); // per date, users with >=25 XP
    for (const ck of CLUSTER_KEYS) {
      clusterSessionsByDate.set(ck, new Map());
      clusterSessionCounts.set(ck, 0);
      clusterXpUsers.set(ck, new Map());
    }

    for (const s of sessions) {
      const ck = userClusterMap.get(s.userId);
      if (!ck) continue;
      clusterSessionCounts.set(ck, (clusterSessionCounts.get(ck) || 0) + 1);

      const dateMap = clusterSessionsByDate.get(ck)!;
      if (!dateMap.has(s.date)) dateMap.set(s.date, new Set());
      dateMap.get(s.date)!.add(s.userId);

      if (s.xpEarned >= 25) {
        const xpMap = clusterXpUsers.get(ck)!;
        if (!xpMap.has(s.date)) xpMap.set(s.date, new Set());
        xpMap.get(s.date)!.add(s.userId);
      }
    }

    // Group checkins by cluster
    const clusterCheckinCounts = new Map<ClusterKey, number>();
    const clusterSatisfactions = new Map<ClusterKey, number[]>();
    const clusterSentiments = new Map<ClusterKey, { yes: number; maybe: number; no: number }>();
    for (const ck of CLUSTER_KEYS) {
      clusterCheckinCounts.set(ck, 0);
      clusterSatisfactions.set(ck, []);
      clusterSentiments.set(ck, { yes: 0, maybe: 0, no: 0 });
    }

    for (const c of checkinsData) {
      const ck = userClusterMap.get(c.userId) ?? 'null';
      clusterCheckinCounts.set(ck as ClusterKey, (clusterCheckinCounts.get(ck as ClusterKey) || 0) + 1);
      clusterSatisfactions.get(ck as ClusterKey)!.push(c.satisfaction);
      const sent = clusterSentiments.get(ck as ClusterKey)!;
      if (c.sentiment === 'yes') sent.yes++;
      else if (c.sentiment === 'maybe') sent.maybe++;
      else if (c.sentiment === 'no') sent.no++;
    }

    const clusterOverview: Record<string, unknown> = {};
    for (const ck of CLUSTER_KEYS) {
      const rosterCount = clusterUsers.get(ck)!.size;
      const dateMap = clusterSessionsByDate.get(ck)!;
      const dauValues = dates.map((d) => dateMap.get(d)?.size ?? 0);
      const avgDau = dauValues.length > 0 ? dauValues.reduce((a, b) => a + b, 0) / dauValues.length : 0;

      const xpMap = clusterXpUsers.get(ck)!;
      const participationRates = dates.map((d) => {
        const count = xpMap.get(d)?.size ?? 0;
        return rosterCount > 0 ? count / rosterCount : 0;
      });
      const avgParticipation = participationRates.length > 0
        ? participationRates.reduce((a, b) => a + b, 0) / participationRates.length : 0;

      const sats = clusterSatisfactions.get(ck)!;
      const avgSat = sats.length > 0 ? sats.reduce((a, b) => a + b, 0) / sats.length : null;

      const clusterUsersList = usersData.filter((u) => userClusterKey(u) === ck);
      const avgStreak = clusterUsersList.length > 0
        ? clusterUsersList.reduce((s, u) => s + u.currentStreak, 0) / clusterUsersList.length : 0;

      clusterOverview[ck] = {
        rosterCount,
        dau: Math.round(avgDau * 100) / 100,
        participationRate: Math.round(avgParticipation * 10000) / 10000,
        avgSessionsPerDay: Math.round((clusterSessionCounts.get(ck)! / dayCount) * 100) / 100,
        avgStreak: Math.round(avgStreak * 100) / 100,
        totalGameSessions: clusterSessionCounts.get(ck)!,
        totalCheckins: clusterCheckinCounts.get(ck)!,
        avgSatisfaction: avgSat !== null ? Math.round(avgSat * 100) / 100 : null,
        sentimentBreakdown: clusterSentiments.get(ck)!,
      };
    }

    // ── B) clusterSpaceTypeMatrix ────────────────────────────────────
    // Count visits per cluster per classification
    const matrix: Record<string, Record<string, number>> = {};
    for (const ck of CLUSTER_KEYS) {
      matrix[ck] = {};
      for (const cls of CLASSIFICATIONS) matrix[ck][cls] = 0;
    }

    for (const s of sessions) {
      const ck = userClusterMap.get(s.userId);
      if (!ck) continue;
      const cls = locClassMap.get(s.locationId);
      if (cls && matrix[ck][cls] !== undefined) {
        matrix[ck][cls]++;
      }
    }

    // Also count checkins (matched to locations)
    for (const c of checkinsData) {
      const ck = (userClusterMap.get(c.userId) ?? 'null') as ClusterKey;
      const locId = matchCheckinToLocation(c, locationsData);
      if (!locId) continue;
      const cls = locClassMap.get(locId);
      if (cls && matrix[ck][cls] !== undefined) {
        matrix[ck][cls]++;
      }
    }

    // Convert to percentages
    const clusterSpaceTypeMatrix: Record<string, Record<string, number>> = {};
    for (const ck of CLUSTER_KEYS) {
      const total = Object.values(matrix[ck]).reduce((a, b) => a + b, 0);
      clusterSpaceTypeMatrix[ck] = {};
      for (const cls of CLASSIFICATIONS) {
        clusterSpaceTypeMatrix[ck][cls] = total > 0
          ? Math.round((matrix[ck][cls] / total) * 10000) / 10000 : 0;
      }
    }

    // ── C) clusterSatisfactionOverTime ───────────────────────────────
    // Group checkins by date+cluster
    const satByDateCluster = new Map<string, Map<ClusterKey, number[]>>();
    for (const c of checkinsData) {
      const ck = (userClusterMap.get(c.userId) ?? 'null') as ClusterKey;
      if (!satByDateCluster.has(c.date)) {
        satByDateCluster.set(c.date, new Map());
      }
      const dateMap = satByDateCluster.get(c.date)!;
      if (!dateMap.has(ck)) dateMap.set(ck, []);
      dateMap.get(ck)!.push(c.satisfaction);
    }

    const satisfactionDays = dates.map((date) => {
      const entry: Record<string, unknown> = { date };
      const dateMap = satByDateCluster.get(date);
      for (const ck of CLUSTER_KEYS) {
        const sats = dateMap?.get(ck);
        entry[ck] = sats && sats.length > 0
          ? Math.round((sats.reduce((a, b) => a + b, 0) / sats.length) * 100) / 100
          : null;
      }
      return entry;
    });

    // ── D) clusterEngagement ─────────────────────────────────────────
    const engagementDays = dates.map((date) => {
      const entry: Record<string, unknown> = { date };
      for (const ck of CLUSTER_KEYS) {
        const dateMap = clusterSessionsByDate.get(ck)!;
        entry[ck] = dateMap.get(date)?.size ?? 0;
      }
      return entry;
    });

    return success({
      clusterOverview,
      clusterSpaceTypeMatrix: { clusters: clusterSpaceTypeMatrix },
      clusterSatisfactionOverTime: { days: satisfactionDays },
      clusterEngagement: { days: engagementDays },
    });
  } catch (err) {
    console.error('[analyticsClusters] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}

// ── Helper: paginated scan ───────────────────────────────────────────

async function scanAll<T>(table: string): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, { exclusiveStartKey: lastKey });
    items.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function scanAllFiltered<T>(table: string, startDate: string, endDate: string): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, {
      filterExpression: '#d BETWEEN :start AND :end',
      expressionNames: { '#d': 'date' },
      expressionValues: { ':start': startDate, ':end': endDate },
      exclusiveStartKey: lastKey,
    });
    items.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function queryCheckinsByDates(dates: string[]): Promise<CheckIn[]> {
  const items: CheckIn[] = [];
  for (const date of dates) {
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await query<CheckIn>(
        'checkins',
        '#d = :date',
        { ':date': date },
        { indexName: 'DateIndex', expressionNames: { '#d': 'date' }, exclusiveStartKey: lastKey },
      );
      items.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);
  }
  return items;
}
