import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import type { PlayerAssignment, User, LocationMasterConfig } from '../../shared/types';

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

const CSV_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'text/csv',
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
    const startDate = params.startDate;
    const endDate = params.endDate;

    // Parallel scans
    const [allItems, users, locations] = await Promise.all([
      scanAll<PlayerAssignment>('player-assignments'),
      scanAll<User>('users'),
      scanAll<LocationMasterConfig>('location-master-config'),
    ]);

    const userMap = new Map<string, User>();
    for (const u of users) userMap.set(u.userId, u);

    const locationMap = new Map<string, LocationMasterConfig>();
    for (const l of locations) locationMap.set(l.locationId, l);

    // Post-filter by date (extracted from composite key "YYYY-MM-DD#userId")
    const filtered = allItems.filter((item) => {
      const date = item.dateUserId.split('#')[0];
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    });

    const header = 'date,userId,assignedLocationIds,assignedLocationNames,weightsUsed,phase1Cluster';
    const rows = filtered.map((a) => {
      const [date, userId] = a.dateUserId.split('#');
      const user = userMap.get(userId);

      // Resolve location names (semicolon-separated to avoid CSV conflicts)
      const locationNames = (a.assignedLocationIds ?? []).map(id => {
        const loc = locationMap.get(id);
        return loc?.name ?? id;
      });

      // Stringify weightsUsed as JSON
      const weightsStr = a.weightsUsed ? JSON.stringify(a.weightsUsed) : '';

      return csvRow([
        date,
        userId,
        a.assignedLocationIds?.join(';') ?? '',
        locationNames.join(';'),
        weightsStr,
        user?.phase1Cluster ?? '',
      ]);
    });

    return {
      statusCode: 200,
      headers: CSV_HEADERS,
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportPlayerAssignments] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
