import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import type { DailyConfig } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const date = event.queryStringParameters?.date ?? getTodayISTString();

    const config = await getItem<DailyConfig>('daily-config', { date });
    if (!config) {
      return error(ErrorCode.NOT_FOUND, 'No daily config found for this date', 404);
    }

    return success({
      date: config.date,
      activeLocationIds: config.activeLocationIds,
      targetSpace: config.targetSpace,
      difficulty: config.difficulty,
      status: config.status,
      winnerClan: config.winnerClan,
    });
  } catch (err) {
    console.error('getDailyConfig error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
