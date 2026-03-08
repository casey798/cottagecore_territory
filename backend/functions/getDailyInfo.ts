import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem } from '../shared/db';
import { getTodayISTString } from '../shared/time';
import { success, error, ErrorCode } from '../shared/response';
import { DailyConfig } from '../shared/types';

export const handler = async (
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const today = getTodayISTString();

    const config = await getItem<DailyConfig>('daily-config', { date: today });

    if (!config) {
      return error(ErrorCode.NOT_FOUND, 'No daily config found for today', 404);
    }

    return success({
      date: config.date,
      targetSpace: config.targetSpace,
      status: config.status,
      difficulty: config.difficulty,
    });
  } catch (err) {
    console.error('getDailyInfo error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get daily info', 500);
  }
};
