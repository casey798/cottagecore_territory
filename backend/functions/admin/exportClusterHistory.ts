import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan, query } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { toZonedTime } from 'date-fns-tz';
import { addDays, format } from 'date-fns';
import type { User } from '../../shared/types';

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

function getDefault14DaysAgo(): string {
  const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
  return format(addDays(nowIST, -14), 'yyyy-MM-dd');
}

interface ClusterHistoryRecord {
  userId: string;
  date: string;
  computedCluster: string;
  clusterComputedAt: string;
  quietModeActive?: boolean;
  featureSnapshot?: Record<string, unknown>;
  assignmentWeightsSnapshot?: Record<string, unknown>;
}

// Known feature fields in order (from PlayerFeatureVector)
const FEATURE_FIELDS = [
  'visits',
  'avg_duration',
  'avg_satisfaction',
  'unique_spaces',
  'space_diversity',
  'pct_morning',
  'pct_he_social',
  'pct_he_personal',
  'pct_le_social',
  'pct_le_personal',
  'pct_social_hub',
  'pct_transit',
  'pct_hidden_gem',
  'pct_dead_zone',
] as const;

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

async function queryAll<T>(
  table: string,
  keyCondition: string,
  values: Record<string, unknown>,
  options?: { indexName?: string; expressionNames?: Record<string, string> },
): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await query<T>(table, keyCondition, values, {
      ...options,
      exclusiveStartKey: lastKey,
    });
    items.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return items;
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
    const startDate = params.startDate || getDefault14DaysAgo();
    const endDate = params.endDate || today;
    const userId = params.userId;

    // Load cluster history records
    let historyRecords: ClusterHistoryRecord[];

    if (userId) {
      // Query by specific user (PK=userId, SK BETWEEN)
      historyRecords = await queryAll<ClusterHistoryRecord>(
        'cluster-history',
        'userId = :uid AND #d BETWEEN :start AND :end',
        { ':uid': userId, ':start': startDate, ':end': endDate },
        { expressionNames: { '#d': 'date' } },
      );
    } else {
      // Full scan with date filter
      historyRecords = await scanAll<ClusterHistoryRecord>('cluster-history', {
        filterExpression: '#d BETWEEN :start AND :end',
        expressionNames: { '#d': 'date' },
        expressionValues: { ':start': startDate, ':end': endDate },
      });
    }

    // Load users for email/clan/phase1Cluster lookup
    const usersData = await scanAll<User>('users');
    const userMap = new Map<string, { email: string; clan: string; phase1Cluster: string }>();
    for (const u of usersData) {
      userMap.set(u.userId, {
        email: u.email,
        clan: u.clan,
        phase1Cluster: u.phase1Cluster ?? '',
      });
    }

    // Discover any extra feature fields beyond the known set
    const allFeatureKeys = new Set<string>(FEATURE_FIELDS);
    for (const rec of historyRecords) {
      if (rec.featureSnapshot) {
        for (const key of Object.keys(rec.featureSnapshot)) {
          allFeatureKeys.add(key);
        }
      }
    }
    const featureColumns = [...allFeatureKeys];

    // Group records by userId and sort by date for change detection
    const byUser = new Map<string, ClusterHistoryRecord[]>();
    for (const rec of historyRecords) {
      const list = byUser.get(rec.userId) || [];
      list.push(rec);
      byUser.set(rec.userId, list);
    }

    // Sort each user's records by date ascending
    for (const [, records] of byUser) {
      records.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    }

    // Build CSV rows
    const featureHeaders = featureColumns.map((f) => `feature_${f}`);
    const header = [
      'date', 'userId', 'email', 'clan', 'phase1Cluster',
      'computedCluster', 'clusterComputedAt', 'quietModeActive', 'clusterChanged', 'previousCluster',
      ...featureHeaders,
    ].join(',');

    const rows: string[] = [];

    for (const [uid, records] of byUser) {
      const user = userMap.get(uid);

      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const prevCluster = i > 0 ? records[i - 1].computedCluster : '';
        const clusterChanged = i > 0 ? rec.computedCluster !== records[i - 1].computedCluster : false;

        const featureValues = featureColumns.map((f) => {
          if (!rec.featureSnapshot) return '';
          const val = rec.featureSnapshot[f];
          if (val === null || val === undefined) return '';
          if (typeof val === 'number') return Math.round(val * 10000) / 10000;
          return val;
        });

        rows.push(csvRow([
          rec.date,
          rec.userId,
          user?.email ?? '',
          user?.clan ?? '',
          user?.phase1Cluster ?? '',
          rec.computedCluster,
          rec.clusterComputedAt,
          rec.quietModeActive === true ? 'true' : 'false',
          clusterChanged ? 'true' : 'false',
          prevCluster,
          ...featureValues,
        ]));
      }
    }

    // Sort output by date, then userId for consistent ordering
    rows.sort();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="cluster-history-${startDate}-to-${endDate}.csv"`,
      },
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportClusterHistory] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
