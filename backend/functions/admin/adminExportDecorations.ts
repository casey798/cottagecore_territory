import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { SpaceDecorationSubmission, Space, User } from '../../shared/types';

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

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const params = event.queryStringParameters || {};
    const startDate = params.startDate;
    const endDate = params.endDate;

    const decorationScanOpts: Parameters<typeof scan>[1] = {};
    if (startDate && endDate) {
      decorationScanOpts.filterExpression = '#d BETWEEN :start AND :end';
      decorationScanOpts.expressionNames = { '#d': 'date' };
      decorationScanOpts.expressionValues = { ':start': startDate, ':end': endDate };
    }

    // Parallel scans: decorations, spaces, users
    const [allDecorations, allSpaces, allUsers] = await Promise.all([
      scanAll<SpaceDecorationSubmission>('space-decorations', decorationScanOpts),
      scanAll<Space>('spaces'),
      scanAll<User>('users'),
    ]);

    const spaceMap = new Map<string, Space>();
    for (const s of allSpaces) spaceMap.set(s.spaceId, s);

    const userMap = new Map<string, User>();
    for (const u of allUsers) userMap.set(u.userId, u);

    const header = 'userSpaceId,date,userId,displayName,clan,phase1Cluster,spaceId,spaceName,qrNumber,assetsPlaced,furnitureCount,aestheticsCount,natureCount,xpAwarded,wantSpaceToBe,whyChoseItems,wouldVisitMore,submittedAt,screenshotS3Key';

    const rows = allDecorations.map((d) => {
      const space = spaceMap.get(d.spaceId);
      const user = userMap.get(d.userId);
      return csvRow([
        d.userSpaceId,
        d.date,
        d.userId,
        user?.displayName ?? '',
        d.clan,
        user?.phase1Cluster ?? '',
        d.spaceId,
        space?.name ?? '',
        space?.qrNumber ?? '',
        d.layout.placedAssets.length,
        d.packUsageSummary?.furniture ?? 0,
        d.packUsageSummary?.aesthetics ?? 0,
        d.packUsageSummary?.nature ?? 0,
        d.xpAwarded,
        d.survey.wantSpaceToBe,
        d.survey.whyChoseItems,
        d.survey.wouldVisitMore,
        d.submittedAt,
        d.screenshotS3Key,
      ]);
    });

    const today = getTodayISTString();
    const csvString = [header, ...rows].join('\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="decorations-export-${today}.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
      body: csvString,
    };
  } catch (err) {
    console.error('adminExportDecorations error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to export decorations', 500);
  }
};
