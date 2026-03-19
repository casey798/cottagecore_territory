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
      return success({
        date: today,
        targetSpace: null,
        status: null,
        resetSeq: 0,
        winnerClan: null,
        quietMode: true,
      });
    }

    return success({
      date: config.date,
      targetSpace: config.targetSpace,
      status: config.status,
      resetSeq: config.resetSeq ?? 0,
      winnerClan: config.winnerClan ?? null,
      quietMode: config.quietMode ?? false,
    });
  } catch (err) {
    console.error('getDailyInfo error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get daily info', 500);
  }
};
