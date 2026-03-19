import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, putItem } from '../../shared/db';
import type { DailyLocationPool } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const body = JSON.parse(event.body || '{}') as {
      schedule?: Array<{ date: string; captureSpaceId: string }>;
    };

    if (!body.schedule || !Array.isArray(body.schedule)) {
      return error(ErrorCode.VALIDATION_ERROR, 'schedule array is required', 400);
    }

    // Validate entries
    for (const entry of body.schedule) {
      if (!entry.date || typeof entry.date !== 'string') {
        return error(ErrorCode.VALIDATION_ERROR, 'Each schedule entry must have a date string', 400);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
        return error(ErrorCode.VALIDATION_ERROR, `Invalid date format: ${entry.date}. Use YYYY-MM-DD`, 400);
      }
      if (!entry.captureSpaceId || typeof entry.captureSpaceId !== 'string') {
        return error(ErrorCode.VALIDATION_ERROR, 'Each schedule entry must have a captureSpaceId string', 400);
      }
    }

    let updated = 0;
    let created = 0;

    for (const entry of body.schedule) {
      const existing = await getItem<DailyLocationPool>('daily-config', { date: entry.date });

      if (existing) {
        // Upsert: merge captureSpaceId into existing record
        const merged: Record<string, unknown> = {
          ...existing,
          captureSpaceId: entry.captureSpaceId,
        };
        await putItem('daily-config', merged);
        updated++;
      } else {
        // Create minimal DailyLocationPool
        const newPool: Record<string, unknown> = {
          date: entry.date,
          activeLocationIds: [],
          captureSpaceId: entry.captureSpaceId,
          algorithmScores: {},
          amPool: null,
          pmPool: null,
        };
        await putItem('daily-config', newPool);
        created++;
      }
    }

    return success({ updated, created, total: body.schedule.length });
  } catch (err) {
    console.error('[saveSeasonSchedule] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to save season schedule', 500);
  }
}
