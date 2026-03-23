import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { getItem, query, scan } from '../../shared/db';
import type { CheckIn, User, LocationMasterConfig, DailyConfig } from '../../shared/types';

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

const CSV_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'text/csv',
  'Content-Disposition': 'attachment; filename="checkins-export.csv"',
};

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

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const params = event.queryStringParameters || {};
    const clan = params.clan;

    let startDate = params.startDate;
    let endDate = params.endDate;

    if (!startDate || !endDate) {
      const now = new Date();
      const end = new Date(now);
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      startDate = start.toISOString().slice(0, 10);
      endDate = end.toISOString().slice(0, 10);
    }

    // Query each date in the range using DateIndex GSI
    const allCheckins: CheckIn[] = [];
    const current = new Date(startDate + 'T00:00:00Z');
    const last = new Date(endDate + 'T00:00:00Z');

    while (current <= last) {
      const dateStr = current.toISOString().slice(0, 10);
      let lastKey: Record<string, unknown> | undefined;

      do {
        const result = await query<CheckIn>(
          'checkins',
          '#d = :date',
          { ':date': dateStr },
          {
            indexName: 'DateIndex',
            expressionNames: { '#d': 'date' },
            exclusiveStartKey: lastKey,
          },
        );

        allCheckins.push(...result.items);
        lastKey = result.lastEvaluatedKey;
      } while (lastKey);

      current.setUTCDate(current.getUTCDate() + 1);
    }

    // Filter by clan if requested
    const filtered = clan
      ? allCheckins.filter((c) => c.clanId === clan)
      : allCheckins;

    // Parallel: users and locations
    const [users, locations] = await Promise.all([
      scanAll<User>('users'),
      scanAll<LocationMasterConfig>('location-master-config'),
    ]);

    const userMap = new Map<string, User>();
    for (const u of users) userMap.set(u.userId, u);

    const locationMap = new Map<string, LocationMasterConfig>();
    for (const l of locations) locationMap.set(l.locationId, l);

    // Build quiet mode date set from daily-config
    const uniqueDates = new Set<string>();
    for (const c of filtered) uniqueDates.add(c.date);
    const quietModeDates = new Set<string>();
    const dateArray = [...uniqueDates];
    const BATCH_SIZE = 100;
    for (let i = 0; i < dateArray.length; i += BATCH_SIZE) {
      const batch = dateArray.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (date) => {
          const config = await getItem<DailyConfig>('daily-config', { date });
          if (config?.quietMode === true) {
            quietModeDates.add(date);
          }
        }),
      );
    }

    const header = 'checkInId,userId,email,clan,phase1Cluster,date,timestamp,locationId,locationName,locationClassification,gpsLat,gpsLng,pixelX,pixelY,pixelAvailable,activityCategory,activityTime,floor,durationMinutes,satisfaction,sentiment,sessionPhase';
    const rows = filtered.map((c) => {
      const user = userMap.get(c.userId);
      // checkins table does not store locationId — leave empty
      const locationId = (c as unknown as Record<string, unknown>).locationId as string | undefined;
      const loc = locationId ? locationMap.get(locationId) : undefined;

      return csvRow([
        c.checkInId,
        c.userId,
        user?.email ?? '',
        user?.clan ?? c.clanId ?? '',
        user?.phase1Cluster ?? '',
        c.date,
        c.timestamp,
        locationId ?? '',
        loc?.name ?? '',
        loc?.classification ?? '',
        c.gpsLat,
        c.gpsLng,
        c.pixelX,
        c.pixelY,
        c.pixelAvailable,
        c.activityCategory,
        c.activityTime,
        c.floor,
        c.durationMinutes,
        c.satisfaction,
        c.sentiment,
        quietModeDates.has(c.date) ? 'quiet_mode' : 'in_season',
      ]);
    });

    return {
      statusCode: 200,
      headers: CSV_HEADERS,
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportCheckins] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
