import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, query } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { GameSession, CheckIn, LocationMasterConfig } from '../../shared/types';

// Checkins don't store locationId directly — match by pixel proximity
const PIXEL_MATCH_THRESHOLD = 50; // pixels

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

type LocationStatus = 'Thriving' | 'Activated' | 'Below Baseline' | 'Unactivated' | 'New';

function computeStatus(
  totalVisits: number,
  phase1Visits: number,
  isNewSpace: boolean,
  dayCount: number,
): LocationStatus {
  if (isNewSpace || phase1Visits === 0) {
    return totalVisits > 0 ? 'New' : 'Unactivated';
  }
  if (totalVisits === 0) return 'Unactivated';
  // Normalize to daily averages for comparison
  const phase1DailyAvg = phase1Visits; // phase1Visits is already a total; compare raw totals
  const ratio = totalVisits / Math.max(phase1DailyAvg, 1);
  if (ratio >= 3) return 'Thriving';
  if (ratio >= 1) return 'Activated';
  return 'Below Baseline';
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

    // Parallel: locations, game-sessions, checkins
    const [locationsResult, sessionsResult] = await Promise.all([
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
        const items: GameSession[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const result = await scan<GameSession>('game-sessions', {
            filterExpression: '#d BETWEEN :start AND :end',
            expressionNames: { '#d': 'date' },
            expressionValues: { ':start': startDate, ':end': endDate },
            exclusiveStartKey: lastKey,
          });
          items.push(...result.items);
          lastKey = result.lastEvaluatedKey;
        } while (lastKey);
        return items;
      })(),
    ]);

    // Query checkins via DateIndex
    const allCheckins: CheckIn[] = [];
    for (const date of dates) {
      let lastCheckinKey: Record<string, unknown> | undefined;
      do {
        const result = await query<CheckIn>(
          'checkins',
          '#d = :date',
          { ':date': date },
          { indexName: 'DateIndex', expressionNames: { '#d': 'date' }, exclusiveStartKey: lastCheckinKey },
        );
        allCheckins.push(...result.items);
        lastCheckinKey = result.lastEvaluatedKey;
      } while (lastCheckinKey);
    }

    // Count sessions per location
    const sessionCountByLoc = new Map<string, number>();
    for (const s of sessionsResult) {
      sessionCountByLoc.set(s.locationId, (sessionCountByLoc.get(s.locationId) || 0) + 1);
    }

    // Match checkins to locations and aggregate
    const checkinCountByLoc = new Map<string, number>();
    const satisfactionByLoc = new Map<string, number[]>();
    const sentimentByLoc = new Map<string, { yes: number; maybe: number; no: number }>();

    for (const c of allCheckins) {
      const locId = matchCheckinToLocation(c, locationsResult);
      if (!locId) continue;

      checkinCountByLoc.set(locId, (checkinCountByLoc.get(locId) || 0) + 1);

      // Satisfaction
      const sats = satisfactionByLoc.get(locId) || [];
      sats.push(c.satisfaction);
      satisfactionByLoc.set(locId, sats);

      // Sentiment
      const sent = sentimentByLoc.get(locId) || { yes: 0, maybe: 0, no: 0 };
      if (c.sentiment === 'yes') sent.yes++;
      else if (c.sentiment === 'maybe') sent.maybe++;
      else if (c.sentiment === 'no') sent.no++;
      sentimentByLoc.set(locId, sent);
    }

    // Build per-location result
    const locations = locationsResult.map((loc) => {
      const gameSessions = sessionCountByLoc.get(loc.locationId) || 0;
      const freeRoamCheckins = checkinCountByLoc.get(loc.locationId) || 0;
      const total = gameSessions + freeRoamCheckins;
      const sats = satisfactionByLoc.get(loc.locationId) || [];
      const avgSatisfaction = sats.length > 0
        ? Math.round((sats.reduce((a, b) => a + b, 0) / sats.length) * 100) / 100
        : null;
      const sentiment = sentimentByLoc.get(loc.locationId) || { yes: 0, maybe: 0, no: 0 };
      const status = computeStatus(total, loc.phase1Visits, loc.isNewSpace, dates.length);

      return {
        locationId: loc.locationId,
        qrNumber: loc.qrNumber,
        name: loc.name,
        classification: loc.classification,
        gameSessions,
        freeRoamCheckins,
        total,
        avgSatisfaction,
        sentimentBreakdown: sentiment,
        phase1Visits: loc.phase1Visits,
        phase1Satisfaction: loc.phase1Satisfaction,
        change: total - loc.phase1Visits,
        status,
        active: loc.active,
        mapPixelX: loc.mapPixelX,
        mapPixelY: loc.mapPixelY,
      };
    });

    // Sort by total visits descending
    locations.sort((a, b) => b.total - a.total);

    return success({ locations });
  } catch (err) {
    console.error('[analyticsLocations] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
