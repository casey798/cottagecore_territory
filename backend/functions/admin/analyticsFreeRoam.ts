import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, query } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { CheckIn, User, PlayerAssignment, LocationMasterConfig } from '../../shared/types';

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

    // Parallel: checkins, users, locations, player-assignments
    const [allCheckins, usersData, locationsData, assignmentsData] = await Promise.all([
      (async () => {
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
      })(),
      (async () => {
        const items: User[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const result = await scan<User>('users', { exclusiveStartKey: lastKey });
          items.push(...result.items);
          lastKey = result.lastEvaluatedKey;
        } while (lastKey);
        return items;
      })(),
      (async () => {
        const items: LocationMasterConfig[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const result = await scan<LocationMasterConfig>('location-master-config', { exclusiveStartKey: lastKey });
          items.push(...result.items);
          lastKey = result.lastEvaluatedKey;
        } while (lastKey);
        return items;
      })(),
      (async () => {
        const items: PlayerAssignment[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const result = await scan<PlayerAssignment>('player-assignments', { exclusiveStartKey: lastKey });
          items.push(...result.items);
          lastKey = result.lastEvaluatedKey;
        } while (lastKey);
        return items;
      })(),
    ]);

    // Build userId → phase1Cluster lookup
    const userClusterMap = new Map<string, string>();
    for (const u of usersData) {
      userClusterMap.set(u.userId, u.phase1Cluster ?? 'null');
    }

    // Build date#userId → assignedLocationIds lookup
    const assignmentMap = new Map<string, string[]>();
    for (const a of assignmentsData) {
      // dateUserId = "YYYY-MM-DD#userId"
      const [date] = a.dateUserId.split('#');
      // Only include assignments in our date range
      if (date >= startDate && date <= endDate) {
        assignmentMap.set(a.dateUserId, a.assignedLocationIds || []);
      }
    }

    // Basic aggregates
    const uniqueUserIds = new Set<string>();
    const sentimentCounts = { yes: 0, maybe: 0, no: 0 };
    const activityCounts = new Map<string, number>();

    // Per-date counts
    const checkinsByDate = new Map<string, number>();
    for (const date of dates) checkinsByDate.set(date, 0);

    // Sentiment by location
    const sentimentByLoc = new Map<string, { yes: number; maybe: number; no: number; total: number }>();

    // Sentiment by cluster
    const sentimentByCluster = new Map<string, { yes: number; maybe: number; no: number; total: number }>();

    // Control signal
    let assignedCount = 0;
    let nonAssignedCount = 0;
    const nonAssignedByDate = new Map<string, { assigned: number; nonAssigned: number }>();
    for (const date of dates) nonAssignedByDate.set(date, { assigned: 0, nonAssigned: 0 });

    for (const c of allCheckins) {
      uniqueUserIds.add(c.userId);

      // Sentiment
      if (c.sentiment === 'yes') sentimentCounts.yes++;
      else if (c.sentiment === 'maybe') sentimentCounts.maybe++;
      else if (c.sentiment === 'no') sentimentCounts.no++;

      // Activity category
      activityCounts.set(c.activityCategory, (activityCounts.get(c.activityCategory) || 0) + 1);

      // Daily count
      checkinsByDate.set(c.date, (checkinsByDate.get(c.date) || 0) + 1);

      // Match to location for location-level sentiment
      const locId = matchCheckinToLocation(c, locationsData);
      if (locId) {
        const locSent = sentimentByLoc.get(locId) || { yes: 0, maybe: 0, no: 0, total: 0 };
        if (c.sentiment === 'yes') locSent.yes++;
        else if (c.sentiment === 'maybe') locSent.maybe++;
        else if (c.sentiment === 'no') locSent.no++;
        locSent.total++;
        sentimentByLoc.set(locId, locSent);

        // Control signal: was this location in the user's assignment for this day?
        const assignmentKey = `${c.date}#${c.userId}`;
        const assigned = assignmentMap.get(assignmentKey);
        const isAssigned = assigned ? assigned.includes(locId) : false;
        if (isAssigned) {
          assignedCount++;
          const dayEntry = nonAssignedByDate.get(c.date)!;
          dayEntry.assigned++;
        } else {
          nonAssignedCount++;
          const dayEntry = nonAssignedByDate.get(c.date)!;
          dayEntry.nonAssigned++;
        }
      }

      // Sentiment by cluster
      const cluster = userClusterMap.get(c.userId) || 'null';
      const clusterSent = sentimentByCluster.get(cluster) || { yes: 0, maybe: 0, no: 0, total: 0 };
      if (c.sentiment === 'yes') clusterSent.yes++;
      else if (c.sentiment === 'maybe') clusterSent.maybe++;
      else if (c.sentiment === 'no') clusterSent.no++;
      clusterSent.total++;
      sentimentByCluster.set(cluster, clusterSent);
    }

    const totalCheckins = allCheckins.length;
    const totalSentiment = sentimentCounts.yes + sentimentCounts.maybe + sentimentCounts.no;

    // Build daily checkins array
    const dailyCheckins = dates.map((date) => ({
      date,
      count: checkinsByDate.get(date) || 0,
    }));

    // Build sentiment by location with location names
    const locNameMap = new Map<string, string>();
    for (const loc of locationsData) locNameMap.set(loc.locationId, loc.name);

    const sentimentByLocation: Array<{ locationId: string; name: string; yes: number; maybe: number; no: number; total: number }> = [];
    sentimentByLoc.forEach((sent, locId) => {
      sentimentByLocation.push({
        locationId: locId,
        name: locNameMap.get(locId) || locId,
        ...sent,
      });
    });
    sentimentByLocation.sort((a, b) => b.total - a.total);

    // Build sentiment by cluster
    const sentimentByClusterResult: Array<{ cluster: string; yes: number; maybe: number; no: number; total: number }> = [];
    sentimentByCluster.forEach((sent, cluster) => {
      sentimentByClusterResult.push({ cluster, ...sent });
    });

    // Activity category breakdown
    const activityCategoryBreakdown: Record<string, number> = {};
    activityCounts.forEach((count, category) => {
      activityCategoryBreakdown[category] = count;
    });

    // Control signal daily trend
    const controlSignalDaily = dates.map((date) => {
      const entry = nonAssignedByDate.get(date)!;
      const dayTotal = entry.assigned + entry.nonAssigned;
      return {
        date,
        assigned: entry.assigned,
        nonAssigned: entry.nonAssigned,
        nonAssignedPercent: dayTotal > 0 ? Math.round((entry.nonAssigned / dayTotal) * 10000) / 10000 : 0,
      };
    });

    const totalControlSignal = assignedCount + nonAssignedCount;

    return success({
      totalCheckins,
      uniqueUsers: uniqueUserIds.size,
      avgSentiment: {
        yes: totalSentiment > 0 ? Math.round((sentimentCounts.yes / totalSentiment) * 10000) / 10000 : 0,
        maybe: totalSentiment > 0 ? Math.round((sentimentCounts.maybe / totalSentiment) * 10000) / 10000 : 0,
        no: totalSentiment > 0 ? Math.round((sentimentCounts.no / totalSentiment) * 10000) / 10000 : 0,
      },
      dailyCheckins,
      controlSignal: {
        assigned: assignedCount,
        nonAssigned: nonAssignedCount,
        assignedPercent: totalControlSignal > 0 ? Math.round((assignedCount / totalControlSignal) * 10000) / 10000 : 0,
        nonAssignedPercent: totalControlSignal > 0 ? Math.round((nonAssignedCount / totalControlSignal) * 10000) / 10000 : 0,
        daily: controlSignalDaily,
      },
      sentimentByLocation,
      sentimentByCluster: sentimentByClusterResult,
      activityCategoryBreakdown,
    });
  } catch (err) {
    console.error('[analyticsFreeRoam] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
