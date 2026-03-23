import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan, query } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { classifySession, isCompetitive, isPractice, isTrueAbandoned } from '../../shared/sessionClassification';
import { toZonedTime } from 'date-fns-tz';
import { addDays, format } from 'date-fns';
import type { GameSession, CheckIn, User, LocationMasterConfig, DailyConfig } from '../../shared/types';

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

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

function getDefault14DaysAgo(): string {
  const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
  return format(addDays(nowIST, -14), 'yyyy-MM-dd');
}

async function scanAll<T>(table: string, opts?: Parameters<typeof scan>[1]): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, { ...opts, exclusiveStartKey: lastKey });
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

const PIXEL_MATCH_THRESHOLD = 50;

function matchCheckinToLocation(
  checkin: CheckIn,
  locations: LocationMasterConfig[],
): string | null {
  if (!checkin.pixelAvailable) return null;
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const loc of locations) {
    const dx = (checkin.pixelX ?? 0) - loc.mapPixelX;
    const dy = (checkin.pixelY ?? 0) - loc.mapPixelY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist && dist <= PIXEL_MATCH_THRESHOLD) {
      bestDist = dist;
      bestId = loc.locationId;
    }
  }
  return bestId;
}

type Phase1Cluster = string;

const CLUSTER_LABELS = ['nomad', 'seeker', 'drifter', 'forced', 'disengaged'] as const;

function computeStatusVsPhase1(totalVisits: number, phase1Visits: number): string {
  if (phase1Visits === 0 && totalVisits > 0) return 'New Activation';
  if (totalVisits > phase1Visits * 1.2) return 'Increased';
  if (totalVisits >= phase1Visits * 0.8) return 'Stable';
  if (totalVisits > 0) return 'Decreased';
  return 'Inactive';
}

interface ActivityCounts {
  studying: number;
  socialising: number;
  eating: number;
  passing: number;
  other: number;
}

const ACTIVITY_MAP: Record<string, keyof ActivityCounts> = {
  high_effort_personal: 'studying',
  low_effort_personal: 'passing',
  high_effort_social: 'socialising',
  low_effort_social: 'eating',
};

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
    const startDate = params.startDate || getDefault14DaysAgo();
    const endDate = params.endDate || today;
    const dates = getDatesInRange(startDate, endDate);

    // Step A-D: Parallel data loading
    const [locationsData, sessionsData, checkinsData, usersData, dailyConfigsData] = await Promise.all([
      scanAll<LocationMasterConfig>('location-master-config'),
      scanAll<GameSession>('game-sessions', {
        filterExpression: '#d BETWEEN :start AND :end',
        expressionNames: { '#d': 'date' },
        expressionValues: { ':start': startDate, ':end': endDate },
      }),
      queryCheckinsByDates(dates),
      scanAll<User>('users'),
      scanAll<DailyConfig>('daily-config', {
        filterExpression: '#d BETWEEN :start AND :end',
        expressionNames: { '#d': 'date' },
        expressionValues: { ':start': startDate, ':end': endDate },
      }),
    ]);

    // Build quiet mode date set
    const quietModeDates = new Set<string>();
    for (const dc of dailyConfigsData) {
      if (dc.quietMode === true) quietModeDates.add(dc.date);
    }

    // Build lookup maps
    const locationMap = new Map<string, LocationMasterConfig>();
    for (const l of locationsData) locationMap.set(l.locationId, l);

    const userMap = new Map<string, { phase1Cluster: Phase1Cluster; clan: string }>();
    for (const u of usersData) {
      userMap.set(u.userId, { phase1Cluster: u.phase1Cluster ?? '', clan: u.clan });
    }

    // Group sessions by (date, locationId)
    const sessionsByDateLoc = new Map<string, GameSession[]>();
    for (const s of sessionsData) {
      const key = `${s.date}#${s.locationId}`;
      const list = sessionsByDateLoc.get(key) || [];
      list.push(s);
      sessionsByDateLoc.set(key, list);
    }

    // Match checkins to locations and group by (date, locationId)
    const checkinsByDateLoc = new Map<string, CheckIn[]>();
    for (const c of checkinsData) {
      const locId = matchCheckinToLocation(c, locationsData);
      if (!locId) continue;
      const key = `${c.date}#${locId}`;
      const list = checkinsByDateLoc.get(key) || [];
      list.push(c);
      checkinsByDateLoc.set(key, list);
    }

    // Collect all unique (date, locationId) keys
    const allKeys = new Set<string>();
    for (const key of sessionsByDateLoc.keys()) allKeys.add(key);
    for (const key of checkinsByDateLoc.keys()) allKeys.add(key);

    // Build rows
    const rows: string[] = [];

    for (const key of allKeys) {
      const [date, locationId] = key.split('#');
      const sessions = sessionsByDateLoc.get(key) || [];
      const checkins = checkinsByDateLoc.get(key) || [];
      const loc = locationMap.get(locationId);

      // Classify sessions
      const competitive = sessions.filter((s) => isCompetitive(s));
      const practice = sessions.filter((s) => isPractice(s));
      const gameSessions = competitive.length;
      const gameSessionWins = competitive.filter((s) => s.result === 'win').length;
      const gameLosses = competitive.filter((s) => s.result === 'lose').length;
      const gameTimeout = competitive.filter((s) => s.result === 'timeout').length;
      const gameTrueAbandoned = competitive.filter((s) => isTrueAbandoned(s)).length;
      const gameScanAbandoned = competitive.filter((s) => s.result === 'abandoned' && s.leaveReason === 'new_scan').length;
      const practiceSessionCount = practice.length;
      const coopSessionCount = competitive.filter((s) => s.coopPartnerId != null).length;
      const freeRoamCheckins = checkins.length;

      // Skip rows with zero activity
      if (gameSessions === 0 && freeRoamCheckins === 0 && practiceSessionCount === 0) continue;

      const totalVisits = gameSessions + freeRoamCheckins;

      // Dwell time: from all sessions (competitive + practice + free-roam type in game-sessions) where dwellTime is not null
      const dwellValues = sessions.filter((s) => s.dwellTime != null).map((s) => s.dwellTime as number);
      const avgDwellTimeSeconds = dwellValues.length > 0
        ? Math.round(dwellValues.reduce((a, b) => a + b, 0) / dwellValues.length)
        : '';

      // Checkin duration
      const durationValues = checkins
        .map((c) => c.durationMinutes)
        .filter((v): v is number => typeof v === 'number');
      const avgCheckinDurationMinutes = durationValues.length > 0
        ? Math.round((durationValues.reduce((a, b) => a + b, 0) / durationValues.length) * 100) / 100
        : '';

      // Checkin sentiment
      const sentimentMap = { yes: 0, maybe: 0, no: 0 };
      for (const c of checkins) {
        if (c.sentiment === 'yes') sentimentMap.yes++;
        else if (c.sentiment === 'maybe') sentimentMap.maybe++;
        else if (c.sentiment === 'no') sentimentMap.no++;
      }
      const sentimentTotal = sentimentMap.yes + sentimentMap.maybe + sentimentMap.no;
      const avgSentimentScore = sentimentTotal > 0
        ? Math.round(((sentimentMap.yes * 1 + sentimentMap.maybe * 0.5 + sentimentMap.no * 0) / sentimentTotal) * 100) / 100
        : '';

      // Game session sentiment
      const gssSentiment = { yes: 0, maybe: 0, no: 0 };
      for (const s of competitive) {
        if (s.spaceSentiment === 'yes') gssSentiment.yes++;
        else if (s.spaceSentiment === 'maybe') gssSentiment.maybe++;
        else if (s.spaceSentiment === 'no') gssSentiment.no++;
      }

      // Checkin satisfaction
      const satisfactionValues: number[] = checkins.map((c) => c.satisfaction as number).filter((v) => typeof v === 'number');
      const checkinSatisfactionAvg = satisfactionValues.length > 0
        ? Math.round((satisfactionValues.reduce((a, b) => a + b, 0) / satisfactionValues.length) * 100) / 100
        : '';

      // Activity categories
      const activityCounts: ActivityCounts = { studying: 0, socialising: 0, eating: 0, passing: 0, other: 0 };
      for (const c of checkins) {
        const mapped = ACTIVITY_MAP[c.activityCategory];
        if (mapped) activityCounts[mapped]++;
        else activityCounts.other++;
      }

      // Cluster breakdown: distinct users from sessions + checkins
      const clusterCounts: Record<string, number> = {};
      for (const label of CLUSTER_LABELS) clusterCounts[label] = 0;
      const userIdsSeen = new Set<string>();
      for (const s of sessions) {
        if (!userIdsSeen.has(s.userId)) {
          userIdsSeen.add(s.userId);
          const cluster = userMap.get(s.userId)?.phase1Cluster ?? '';
          if (CLUSTER_LABELS.includes(cluster as typeof CLUSTER_LABELS[number])) {
            clusterCounts[cluster]++;
          }
        }
      }
      for (const c of checkins) {
        if (!userIdsSeen.has(c.userId)) {
          userIdsSeen.add(c.userId);
          const cluster = userMap.get(c.userId)?.phase1Cluster ?? '';
          if (CLUSTER_LABELS.includes(cluster as typeof CLUSTER_LABELS[number])) {
            clusterCounts[cluster]++;
          }
        }
      }

      const statusVsPhase1 = computeStatusVsPhase1(totalVisits, loc?.phase1Visits ?? 0);

      rows.push(csvRow([
        date,
        locationId,
        loc?.qrNumber ?? '',
        loc?.name ?? '',
        loc?.classification ?? '',
        loc?.phase1Visits ?? '',
        loc?.phase1Satisfaction ?? '',
        gameSessions,
        gameSessionWins,
        gameLosses,
        gameTimeout,
        gameTrueAbandoned,
        gameScanAbandoned,
        practiceSessionCount,
        coopSessionCount,
        freeRoamCheckins,
        totalVisits,
        avgDwellTimeSeconds,
        avgCheckinDurationMinutes,
        avgSentimentScore,
        sentimentMap.yes,
        sentimentMap.maybe,
        sentimentMap.no,
        gssSentiment.yes,
        gssSentiment.maybe,
        gssSentiment.no,
        checkinSatisfactionAvg,
        activityCounts.studying,
        activityCounts.socialising,
        activityCounts.eating,
        activityCounts.passing,
        activityCounts.other,
        clusterCounts.nomad,
        clusterCounts.seeker,
        clusterCounts.drifter,
        clusterCounts.forced,
        clusterCounts.disengaged,
        statusVsPhase1,
        quietModeDates.has(date) ? 'true' : 'false',
        quietModeDates.has(date) ? 'quiet_mode' : 'in_season',
      ]));
    }

    // Sort by date, then locationId
    rows.sort();

    const header = 'date,locationId,qrNumber,locationName,classification,phase1Visits,phase1Satisfaction,gameSessions,gameSessionWins,gameLosses,gameTimeout,gameTrueAbandoned,gameScanAbandoned,practiceSessionCount,coopSessionCount,freeRoamCheckins,totalVisits,avgDwellTimeSeconds,avgCheckinDurationMinutes,avgSentimentScore,checkinSentimentYes,checkinSentimentMaybe,checkinSentimentNo,gameSessionSentimentYes,gameSessionSentimentMaybe,gameSessionSentimentNo,checkinSatisfactionAvg,activityCategory_studying,activityCategory_socialising,activityCategory_eating,activityCategory_passing,activityCategory_other,clusterBreakdown_C0,clusterBreakdown_C1,clusterBreakdown_C2,clusterBreakdown_C3,clusterBreakdown_C4,statusVsPhase1,quietModeDay,sessionPhase';

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="location-summary-${startDate}-to-${endDate}.csv"`,
      },
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportLocationSummary] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
