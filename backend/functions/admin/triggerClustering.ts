import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { runClusteringPipeline } from '../../shared/clusteringPipeline';
import type { DailyClusteringRun } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const today = getTodayISTString();

    // GET — read-only: return today's clustering run if it exists
    if (event.httpMethod === 'GET') {
      const existing = await getItem<DailyClusteringRun>('clustering-runs', { date: today });
      return success(existing ?? null);
    }

    // POST — run clustering
    const body = JSON.parse(event.body || '{}') as { force?: boolean };

    if (!body.force) {
      const existing = await getItem<DailyClusteringRun>('clustering-runs', { date: today });
      if (existing) {
        return success(existing);
      }
    }

    const run = await runClusteringPipeline();
    return success(run);
  } catch (err) {
    console.error('[triggerClustering] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to run clustering', 500);
  }
}
