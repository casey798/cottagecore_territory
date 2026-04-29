import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, query } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { GameSession, CheckIn, User, LocationMasterConfig, SpaceDecorationSubmission } from '../../shared/types';
import { toZonedTime } from 'date-fns-tz';
import { addDays, format } from 'date-fns';

function getYesterdayISTString(): string {
  const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
  return format(addDays(nowIST, -1), 'yyyy-MM-dd');
}

async function getMetricsForDate(date: string) {
  // Game sessions for this date
  const sessionUserIds = new Set<string>();
  const sessionLocationIds = new Set<string>();
  let sessionCount = 0;
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<GameSession>('game-sessions', {
      filterExpression: '#d = :date',
      expressionNames: { '#d': 'date' },
      expressionValues: { ':date': date },
      exclusiveStartKey: lastKey,
    });
    for (const s of result.items) {
      sessionUserIds.add(s.userId);
      sessionLocationIds.add(s.locationId);
      sessionCount++;
    }
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  // Checkins for this date via DateIndex GSI
  const checkinUserIds = new Set<string>();
  let lastCheckinKey: Record<string, unknown> | undefined;
  let checkinCount = 0;
  do {
    const result = await query<CheckIn>(
      'checkins',
      '#d = :date',
      { ':date': date },
      { indexName: 'DateIndex', expressionNames: { '#d': 'date' }, exclusiveStartKey: lastCheckinKey },
    );
    for (const c of result.items) {
      checkinUserIds.add(c.userId);
    }
    checkinCount += result.items.length;
    lastCheckinKey = result.lastEvaluatedKey;
  } while (lastCheckinKey);

  // Space decorations for this date
  const decoratorUserIds = new Set<string>();
  let decorationCount = 0;
  let decorationXp = 0;
  let lastDecKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<SpaceDecorationSubmission>('space-decorations', {
      filterExpression: '#d = :date',
      expressionNames: { '#d': 'date' },
      expressionValues: { ':date': date },
      exclusiveStartKey: lastDecKey,
    });
    for (const d of result.items) {
      decoratorUserIds.add(d.userId);
      decorationCount++;
      decorationXp += d.xpAwarded;
    }
    lastDecKey = result.lastEvaluatedKey;
  } while (lastDecKey);

  const allUserIds = new Set([...sessionUserIds, ...checkinUserIds, ...decoratorUserIds]);

  return {
    dau: allUserIds.size,
    sessionsToday: sessionCount,
    checkinsToday: checkinCount,
    uniqueLocationsVisited: sessionLocationIds.size,
    decorationsToday: decorationCount,
    decoratorsToday: decoratorUserIds.size,
    decorationXpToday: decorationXp,
  };
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const today = getTodayISTString();
    const yesterday = getYesterdayISTString();

    // Parallel: today metrics, yesterday metrics, total users, total active locations
    const [todayMetrics, yesterdayMetrics, userCountResult, locationsResult] = await Promise.all([
      getMetricsForDate(today),
      getMetricsForDate(yesterday),
      scan<User>('users'),
      scan<LocationMasterConfig>('location-master-config'),
    ]);

    // Count total users (paginate if needed — unlikely for ~420 users)
    let totalUsers = userCountResult.items.length;
    let lastUserKey = userCountResult.lastEvaluatedKey;
    while (lastUserKey) {
      const more = await scan<User>('users', { exclusiveStartKey: lastUserKey });
      totalUsers += more.items.length;
      lastUserKey = more.lastEvaluatedKey;
    }

    const totalActiveLocations = locationsResult.items.filter((l) => l.active).length;

    const dauPercent = totalUsers > 0 ? Math.round((todayMetrics.dau / totalUsers) * 10000) / 100 : 0;
    const avgSessionsPerPlayer = todayMetrics.dau > 0
      ? Math.round((todayMetrics.sessionsToday / todayMetrics.dau) * 100) / 100
      : 0;

    return success({
      today: {
        date: today,
        dau: todayMetrics.dau,
        dauPercent,
        sessionsToday: todayMetrics.sessionsToday,
        checkinsToday: todayMetrics.checkinsToday,
        avgSessionsPerPlayer,
        uniqueLocationsVisited: todayMetrics.uniqueLocationsVisited,
        totalActiveLocations,
        totalRoster: totalUsers,
        decorationsToday: todayMetrics.decorationsToday,
        decoratorsToday: todayMetrics.decoratorsToday,
        decorationXpToday: todayMetrics.decorationXpToday,
      },
      yesterday: {
        date: yesterday,
        dau: yesterdayMetrics.dau,
        sessionsToday: yesterdayMetrics.sessionsToday,
        checkinsToday: yesterdayMetrics.checkinsToday,
        uniqueLocationsVisited: yesterdayMetrics.uniqueLocationsVisited,
        decorationsToday: yesterdayMetrics.decorationsToday,
      },
      deltas: {
        dau: todayMetrics.dau - yesterdayMetrics.dau,
        sessions: todayMetrics.sessionsToday - yesterdayMetrics.sessionsToday,
        checkins: todayMetrics.checkinsToday - yesterdayMetrics.checkinsToday,
        locations: todayMetrics.uniqueLocationsVisited - yesterdayMetrics.uniqueLocationsVisited,
        decorations: todayMetrics.decorationsToday - yesterdayMetrics.decorationsToday,
      },
    });
  } catch (err) {
    console.error('[analyticsOverview] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
