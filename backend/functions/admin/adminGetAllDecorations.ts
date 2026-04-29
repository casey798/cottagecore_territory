import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { scan } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import type { SpaceDecorationSubmission, User, Space } from '../../shared/types';
import { toZonedTime } from 'date-fns-tz';
import { addDays, format } from 'date-fns';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const ASSETS_BUCKET = process.env.ASSETS_BUCKET || '';
const PRESIGN_EXPIRY = 14400; // 4 hours

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
  return format(addDays(nowIST, -14), 'yyyy-MM-dd');
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
    const clanFilter = params.clan;

    // Scan space-decorations — apply date filter only if provided
    const scanOpts: Parameters<typeof scan>[1] = {};
    if (startDate && endDate) {
      scanOpts.filterExpression = '#d BETWEEN :start AND :end';
      scanOpts.expressionNames = { '#d': 'date' };
      scanOpts.expressionValues = { ':start': startDate, ':end': endDate };
    }
    let allDecorations = await scanAll<SpaceDecorationSubmission>('space-decorations', scanOpts);

    // Apply clan filter
    if (clanFilter) {
      allDecorations = allDecorations.filter((d) => d.clan === clanFilter);
    }

    // Collect unique IDs for enrichment
    const userIds = new Set<string>();
    const spaceIds = new Set<string>();
    for (const d of allDecorations) {
      userIds.add(d.userId);
      spaceIds.add(d.spaceId);
    }

    // Parallel: load users and spaces
    const [allUsers, allSpaces] = await Promise.all([
      scanAll<User>('users'),
      scanAll<Space>('spaces'),
    ]);

    const userMap = new Map<string, User>();
    for (const u of allUsers) {
      if (userIds.has(u.userId)) userMap.set(u.userId, u);
    }

    const spaceMap = new Map<string, Space>();
    for (const sp of allSpaces) {
      if (spaceIds.has(sp.spaceId)) spaceMap.set(sp.spaceId, sp);
    }

    // Generate pre-signed URLs and enrich
    const enriched = await Promise.all(
      allDecorations.map(async (d) => {
        let screenshotUrl: string | null = null;
        if (d.screenshotS3Key) {
          try {
            screenshotUrl = await getSignedUrl(
              s3,
              new GetObjectCommand({ Bucket: ASSETS_BUCKET, Key: d.screenshotS3Key }),
              { expiresIn: PRESIGN_EXPIRY }
            );
          } catch {
            // Non-fatal
          }
        }

        const user = userMap.get(d.userId);
        const space = spaceMap.get(d.spaceId);

        return {
          userSpaceId: d.userSpaceId,
          date: d.date,
          userId: d.userId,
          displayName: user?.displayName ?? '',
          spaceId: d.spaceId,
          spaceName: space?.name ?? '',
          clan: d.clan,
          layout: d.layout,
          survey: d.survey,
          packUsageSummary: d.packUsageSummary,
          xpAwarded: d.xpAwarded,
          submittedAt: d.submittedAt,
          screenshotUrl,
        };
      })
    );

    return success({ decorations: enriched });
  } catch (err) {
    console.error('adminGetAllDecorations error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get decorations', 500);
  }
};
