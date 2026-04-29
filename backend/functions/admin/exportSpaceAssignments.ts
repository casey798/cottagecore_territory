import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { SpaceAssignment, User, Space } from '../../shared/types';
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
  return format(addDays(nowIST, -7), 'yyyy-MM-dd');
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

    // Parallel scans
    const [allAssignments, allUsers, allSpaces] = await Promise.all([
      scanAll<SpaceAssignment>('space-assignments'),
      scanAll<User>('users'),
      scanAll<Space>('spaces'),
    ]);

    // Filter assignments to date range (PK is "YYYY-MM-DD#userId")
    const filtered = allAssignments.filter((a) => {
      const d = a.dateUserId.split('#')[0];
      return d >= startDate && d <= endDate;
    });

    // Build lookup maps
    const userMap = new Map<string, User>();
    for (const u of allUsers) userMap.set(u.userId, u);

    const spaceMap = new Map<string, string>();
    for (const s of allSpaces) spaceMap.set(s.spaceId, s.name);

    // Sort: date ASC, then userId ASC
    filtered.sort((a, b) => {
      const da = a.dateUserId.split('#')[0];
      const db = b.dateUserId.split('#')[0];
      if (da !== db) return da.localeCompare(db);
      const ua = a.dateUserId.split('#')[1];
      const ub = b.dateUserId.split('#')[1];
      return ua.localeCompare(ub);
    });

    const header = 'date,userId,email,displayName,clan,phase1Cluster,assignedSpaceCount,completedSpaceCount,completionRate,assignedSpaceIds,assignedSpaceNames,completedSpaceIds,completedSpaceNames';

    const rows = filtered.map((a) => {
      const date = a.dateUserId.split('#')[0];
      const userId = a.dateUserId.split('#')[1];
      const user = userMap.get(userId);

      const assigned = a.assignedSpaceIds || [];
      const completed = a.completedSpaceIds || [];
      const assignedCount = assigned.length;
      const completedCount = completed.length;
      const completionRate = assignedCount > 0
        ? (completedCount / assignedCount).toFixed(2)
        : '';

      const assignedNames = assigned.map((id) => spaceMap.get(id) || id).join(';');
      const completedNames = completed.map((id) => spaceMap.get(id) || id).join(';');

      return csvRow([
        date,
        userId,
        user?.email ?? '',
        user?.displayName ?? '',
        user?.clan ?? '',
        user?.phase1Cluster ?? '',
        assignedCount,
        completedCount,
        completionRate,
        assigned.join(';'),
        assignedNames,
        completed.join(';'),
        completedNames,
      ]);
    });

    const filename = `space-assignments-${startDate}-to-${endDate}.csv`;

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
    console.error('[exportSpaceAssignments] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
