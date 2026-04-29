import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { scan, query } from '../../shared/db';
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

async function queryAll<T>(
  table: string,
  keyCondition: string,
  exprValues: Record<string, unknown>,
  opts?: Parameters<typeof query>[3]
): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await query<T>(table, keyCondition, exprValues, {
      ...opts,
      exclusiveStartKey: lastKey,
    });
    items.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return items;
}

function getDefaultStartDate(): string {
  const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
  return format(addDays(nowIST, -14), 'yyyy-MM-dd');
}

function sanitize(str: string): string {
  return str
    .slice(0, 30)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
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
    const spaceIdFilter = params.spaceId;
    const dateFilter = params.date;
    const clanFilter = params.clan;
    const startDate = params.startDate || getDefaultStartDate();
    const endDate = params.endDate || getTodayISTString();

    // Load decorations
    let decorations: SpaceDecorationSubmission[];

    if (spaceIdFilter) {
      // Query by spaceId via SpaceDateIndex
      let keyCondition = 'spaceId = :sid';
      const exprValues: Record<string, unknown> = { ':sid': spaceIdFilter };
      const exprNames: Record<string, string> = {};

      if (dateFilter) {
        keyCondition += ' AND #d = :date';
        exprValues[':date'] = dateFilter;
        exprNames['#d'] = 'date';
      }

      decorations = await queryAll<SpaceDecorationSubmission>(
        'space-decorations',
        keyCondition,
        exprValues,
        {
          indexName: 'SpaceDateIndex',
          expressionNames: Object.keys(exprNames).length > 0 ? exprNames : undefined,
        }
      );
    } else {
      // Full scan with date range
      decorations = await scanAll<SpaceDecorationSubmission>('space-decorations', {
        filterExpression: '#d BETWEEN :start AND :end',
        expressionNames: { '#d': 'date' },
        expressionValues: { ':start': startDate, ':end': endDate },
      });
    }

    // Apply clan filter
    if (clanFilter) {
      decorations = decorations.filter((d) => d.clan === clanFilter);
    }

    // Filter out records without screenshots
    decorations = decorations.filter((d) => d.screenshotS3Key);

    // Collect unique IDs
    const userIds = new Set<string>();
    const spaceIds = new Set<string>();
    for (const d of decorations) {
      userIds.add(d.userId);
      spaceIds.add(d.spaceId);
    }

    // Parallel: users and spaces
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

    // Build manifest with pre-signed URLs
    const images = await Promise.all(
      decorations.map(async (d) => {
        let url: string;
        try {
          url = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: ASSETS_BUCKET, Key: d.screenshotS3Key }),
            { expiresIn: PRESIGN_EXPIRY }
          );
        } catch {
          return null; // Skip failed presigns
        }

        const user = userMap.get(d.userId);
        const space = spaceMap.get(d.spaceId);
        const displayName = user?.displayName ?? '';
        const spaceName = space?.name ?? d.spaceId;

        const filename = `${sanitize(spaceName)}_${d.date}_${sanitize(displayName || 'anon')}_${d.userId.slice(0, 8)}.png`;

        return {
          url,
          filename,
          spaceId: d.spaceId,
          spaceName,
          userId: d.userId,
          displayName,
          clan: d.clan,
          date: d.date,
          submittedAt: d.submittedAt,
          wouldVisitMore: d.survey?.wouldVisitMore ?? '',
          wantSpaceToBe: d.survey?.wantSpaceToBe ?? '',
          whyChoseItems: d.survey?.whyChoseItems ?? '',
          furnitureCount: d.packUsageSummary?.furniture ?? 0,
          aestheticsCount: d.packUsageSummary?.aesthetics ?? 0,
          natureCount: d.packUsageSummary?.nature ?? 0,
        };
      })
    );

    const validImages = images.filter((img): img is NonNullable<typeof img> => img !== null);

    return success({ images: validImages, total: validImages.length });
  } catch (err) {
    console.error('getDecorationImageManifest error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to build image manifest', 500);
  }
};
