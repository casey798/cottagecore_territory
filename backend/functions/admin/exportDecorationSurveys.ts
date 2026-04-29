import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { SpaceDecorationSubmission, User, Space } from '../../shared/types';
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
    const [allDecorations, allUsers, allSpaces] = await Promise.all([
      scanAll<SpaceDecorationSubmission>('space-decorations', {
        filterExpression: '#d BETWEEN :start AND :end',
        expressionNames: { '#d': 'date' },
        expressionValues: { ':start': startDate, ':end': endDate },
      }),
      scanAll<User>('users'),
      scanAll<Space>('spaces'),
    ]);

    // Build lookup maps
    const userMap = new Map<string, User>();
    for (const u of allUsers) userMap.set(u.userId, u);

    const spaceMap = new Map<string, string>();
    for (const s of allSpaces) spaceMap.set(s.spaceId, s.name);

    // Sort: date ASC, then submittedAt ASC
    allDecorations.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.submittedAt.localeCompare(b.submittedAt);
    });

    const header = 'submittedAt,date,userId,email,displayName,clan,phase1Cluster,spaceId,spaceName,wantSpaceToBe,whyChoseItems,wouldVisitMore,furnitureCount,aestheticsCount,natureCount,totalItems,xpAwarded';

    const rows = allDecorations.map((d) => {
      const user = userMap.get(d.userId);
      const spaceName = spaceMap.get(d.spaceId) || d.spaceId;

      const furniture = d.packUsageSummary?.furniture ?? 0;
      const aesthetics = d.packUsageSummary?.aesthetics ?? 0;
      const nature = d.packUsageSummary?.nature ?? 0;
      const totalItems = furniture + aesthetics + nature;

      return csvRow([
        d.submittedAt,
        d.date,
        d.userId,
        user?.email ?? '',
        user?.displayName ?? '',
        d.clan,
        user?.phase1Cluster ?? '',
        d.spaceId,
        spaceName,
        d.survey?.wantSpaceToBe ?? '',
        d.survey?.whyChoseItems ?? '',
        d.survey?.wouldVisitMore ?? '',
        furniture,
        aesthetics,
        nature,
        totalItems,
        d.xpAwarded,
      ]);
    });

    const filename = `decoration-surveys-${startDate}-to-${endDate}.csv`;

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
    console.error('[exportDecorationSurveys] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
