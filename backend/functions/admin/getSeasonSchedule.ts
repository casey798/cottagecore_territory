import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, getItem } from '../../shared/db';
import type { DailyLocationPool, LocationMasterConfig } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // Scan all DailyLocationPool records with captureSpaceId set
    const allPools: DailyLocationPool[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<DailyLocationPool>('daily-config', {
        filterExpression: 'attribute_exists(captureSpaceId) AND captureSpaceId <> :null',
        expressionValues: { ':null': null },
        exclusiveStartKey: lastKey,
      });
      allPools.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    // Look up location names for captureSpaceIds
    const schedule: Array<{ date: string; captureSpaceId: string; locationName: string }> = [];

    for (const pool of allPools) {
      if (!pool.captureSpaceId) continue;

      const location = await getItem<LocationMasterConfig>('location-master-config', {
        locationId: pool.captureSpaceId,
      });

      schedule.push({
        date: pool.date,
        captureSpaceId: pool.captureSpaceId,
        locationName: location?.name ?? 'Unknown',
      });
    }

    schedule.sort((a, b) => a.date.localeCompare(b.date));

    return success({ schedule });
  } catch (err) {
    console.error('[getSeasonSchedule] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to fetch season schedule', 500);
  }
}
