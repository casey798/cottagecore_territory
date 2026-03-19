import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { query, scan } from '../../shared/db';
import type { CheckIn, User } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const params = event.queryStringParameters || {};
    const clan = params.clan;

    // Default to last 7 days if no dates provided
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
    const current = new Date(startDate);
    const last = new Date(endDate);

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

      current.setDate(current.getDate() + 1);
    }

    // Filter by clan if requested
    const filtered = clan
      ? allCheckins.filter((c) => c.clanId === clan)
      : allCheckins;

    // Build user lookup for phase1Cluster
    const userMap = new Map<string, string>();
    let lastUserKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<User>('users', { exclusiveStartKey: lastUserKey });
      for (const u of result.items) {
        userMap.set(u.userId, u.phase1Cluster ?? '');
      }
      lastUserKey = result.lastEvaluatedKey;
    } while (lastUserKey);

    const enriched = filtered.map((c) => ({
      ...c,
      phase1Cluster: userMap.get(c.userId) ?? '',
    }));

    return success(enriched);
  } catch (err) {
    console.error('[exportCheckins] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
