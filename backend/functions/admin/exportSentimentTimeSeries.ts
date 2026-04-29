import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan, query } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { GameSession, SpaceDecorationSubmission, CheckIn, User } from '../../shared/types';
import { toZonedTime } from 'date-fns-tz';
import { addDays, format } from 'date-fns';

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

function getDefaultStartDate(): string {
  const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
  return format(addDays(nowIST, -30), 'yyyy-MM-dd');
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

interface SentimentBucket {
  yes: number;
  maybe: number;
  no: number;
  uniquePlayers: Set<string>;
}

function emptyBucket(): SentimentBucket {
  return { yes: 0, maybe: 0, no: 0, uniquePlayers: new Set() };
}

function pctYes(bucket: SentimentBucket): string {
  const total = bucket.yes + bucket.maybe + bucket.no;
  if (total === 0) return '';
  return ((bucket.yes / total) * 100).toFixed(1);
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
    const startDate = params.startDate || getDefaultStartDate();
    const endDate = params.endDate || getTodayISTString();
    const dates = getDatesInRange(startDate, endDate);

    // Parallel scans: users, game-sessions, space-decorations, checkins
    const [allUsers, allSessions, allDecorations] = await Promise.all([
      scanAll<User>('users'),
      scanAll<GameSession>('game-sessions', {
        filterExpression: '#d BETWEEN :start AND :end',
        expressionNames: { '#d': 'date' },
        expressionValues: { ':start': startDate, ':end': endDate },
      }),
      scanAll<SpaceDecorationSubmission>('space-decorations', {
        filterExpression: '#d BETWEEN :start AND :end',
        expressionNames: { '#d': 'date' },
        expressionValues: { ':start': startDate, ':end': endDate },
      }),
    ]);

    // Query checkins per date via DateIndex GSI
    const allCheckins: CheckIn[] = [];
    for (const dateStr of dates) {
      let lastKey: Record<string, unknown> | undefined;
      do {
        const result = await query<CheckIn>(
          'checkins',
          '#d = :date',
          { ':date': dateStr },
          { indexName: 'DateIndex', expressionNames: { '#d': 'date' }, exclusiveStartKey: lastKey },
        );
        allCheckins.push(...result.items);
        lastKey = result.lastEvaluatedKey;
      } while (lastKey);
    }

    // Build userId → user lookup
    const userMap = new Map<string, User>();
    for (const u of allUsers) userMap.set(u.userId, u);

    function getCluster(userId: string): string {
      return userMap.get(userId)?.phase1Cluster ?? 'null';
    }

    // Aggregation structure: Map<"date|cluster", { game, decor, checkin }>
    type AggRow = { game: SentimentBucket; decor: SentimentBucket; checkin: SentimentBucket };
    const agg = new Map<string, AggRow>();

    function getRow(date: string, cluster: string): AggRow {
      const key = `${date}|${cluster}`;
      let row = agg.get(key);
      if (!row) {
        row = { game: emptyBucket(), decor: emptyBucket(), checkin: emptyBucket() };
        agg.set(key, row);
      }
      return row;
    }

    // Process game sessions (only those with non-null spaceSentiment)
    for (const s of allSessions) {
      if (!s.spaceSentiment) continue;
      const cluster = getCluster(s.userId);
      const row = getRow(s.date, cluster);
      if (s.spaceSentiment === 'yes') row.game.yes++;
      else if (s.spaceSentiment === 'maybe') row.game.maybe++;
      else if (s.spaceSentiment === 'no') row.game.no++;
      row.game.uniquePlayers.add(s.userId);
    }

    // Process space decorations (only those with non-null wouldVisitMore)
    for (const d of allDecorations) {
      const sentiment = d.survey?.wouldVisitMore;
      if (!sentiment) continue;
      const cluster = getCluster(d.userId);
      const row = getRow(d.date, cluster);
      if (sentiment === 'yes') row.decor.yes++;
      else if (sentiment === 'maybe') row.decor.maybe++;
      else if (sentiment === 'no') row.decor.no++;
      row.decor.uniquePlayers.add(d.userId);
    }

    // Process checkins (only those with non-null sentiment)
    for (const c of allCheckins) {
      if (!c.sentiment) continue;
      const cluster = getCluster(c.userId);
      const row = getRow(c.date, cluster);
      if (c.sentiment === 'yes') row.checkin.yes++;
      else if (c.sentiment === 'maybe') row.checkin.maybe++;
      else if (c.sentiment === 'no') row.checkin.no++;
      row.checkin.uniquePlayers.add(c.userId);
    }

    // Build CSV rows — only emit rows with at least one non-zero total
    const header = 'date,cluster,gameSentiment_yes,gameSentiment_maybe,gameSentiment_no,gameSentiment_total,gameSentiment_pctYes,gameSentiment_uniquePlayers,decorSentiment_yes,decorSentiment_maybe,decorSentiment_no,decorSentiment_total,decorSentiment_pctYes,decorSentiment_uniquePlayers,checkinSentiment_yes,checkinSentiment_maybe,checkinSentiment_no,checkinSentiment_total,checkinSentiment_pctYes,checkinSentiment_uniquePlayers,combinedTotal,combinedYes,combinedPctYes';

    // Sort keys: date ASC, cluster alphabetically
    const sortedKeys = [...agg.keys()].sort((a, b) => {
      const [da, ca] = a.split('|');
      const [db, cb] = b.split('|');
      if (da !== db) return da.localeCompare(db);
      return ca.localeCompare(cb);
    });

    const rows: string[] = [];
    for (const key of sortedKeys) {
      const [date, cluster] = key.split('|');
      const row = agg.get(key)!;

      const gameTotal = row.game.yes + row.game.maybe + row.game.no;
      const decorTotal = row.decor.yes + row.decor.maybe + row.decor.no;
      const checkinTotal = row.checkin.yes + row.checkin.maybe + row.checkin.no;
      const combinedTotal = gameTotal + decorTotal + checkinTotal;

      if (combinedTotal === 0) continue;

      const combinedYes = row.game.yes + row.decor.yes + row.checkin.yes;
      const combinedPctYes = combinedTotal > 0
        ? ((combinedYes / combinedTotal) * 100).toFixed(1)
        : '';

      rows.push(csvRow([
        date,
        cluster,
        row.game.yes,
        row.game.maybe,
        row.game.no,
        gameTotal,
        pctYes(row.game),
        row.game.uniquePlayers.size,
        row.decor.yes,
        row.decor.maybe,
        row.decor.no,
        decorTotal,
        pctYes(row.decor),
        row.decor.uniquePlayers.size,
        row.checkin.yes,
        row.checkin.maybe,
        row.checkin.no,
        checkinTotal,
        pctYes(row.checkin),
        row.checkin.uniquePlayers.size,
        combinedTotal,
        combinedYes,
        combinedPctYes,
      ]));
    }

    const filename = `sentiment-time-series-${startDate}-to-${endDate}.csv`;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportSentimentTimeSeries] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
