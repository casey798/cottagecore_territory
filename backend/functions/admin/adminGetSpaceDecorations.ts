import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { query, scan } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import type { SpaceDecorationSubmission, User, Space } from '../../shared/types';

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

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const spaceId = event.pathParameters?.spaceId;
    if (!spaceId) {
      return error(ErrorCode.VALIDATION_ERROR, 'spaceId path parameter is required', 400);
    }

    const params = event.queryStringParameters || {};
    const dateFilter = params.date;
    const clanFilter = params.clan;

    // Query SpaceDateIndex: spaceId (HASH) + date (RANGE)
    let keyCondition = 'spaceId = :sid';
    const exprValues: Record<string, unknown> = { ':sid': spaceId };

    if (dateFilter) {
      keyCondition += ' AND #d = :date';
      exprValues[':date'] = dateFilter;
    }

    const decorations: SpaceDecorationSubmission[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await query<SpaceDecorationSubmission>(
        'space-decorations',
        keyCondition,
        exprValues,
        {
          indexName: 'SpaceDateIndex',
          expressionNames: dateFilter ? { '#d': 'date' } : undefined,
          scanIndexForward: false,
          exclusiveStartKey: lastKey,
        }
      );
      decorations.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    // Apply clan filter post-query
    const filtered = clanFilter
      ? decorations.filter((d) => d.clan === clanFilter)
      : decorations;

    // Collect unique userIds and spaceIds for enrichment
    const userIds = new Set<string>();
    const spaceIds = new Set<string>();
    for (const d of filtered) {
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

    // Generate pre-signed URLs and enrich with user/space data
    const decorationsWithUrls = await Promise.all(
      filtered.map(async (d) => {
        let screenshotUrl: string | null = null;
        if (d.screenshotS3Key) {
          try {
            screenshotUrl = await getSignedUrl(
              s3,
              new GetObjectCommand({
                Bucket: ASSETS_BUCKET,
                Key: d.screenshotS3Key,
              }),
              { expiresIn: PRESIGN_EXPIRY }
            );
          } catch {
            // Non-fatal — screenshot may not exist yet
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

    return success({ decorations: decorationsWithUrls });
  } catch (err) {
    console.error('adminGetSpaceDecorations error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get decorations', 500);
  }
};
