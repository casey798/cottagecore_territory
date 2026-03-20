import crypto from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem, query } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { submitCheckinSchema } from '../../shared/schemas';
import type { CheckIn, User } from '../../shared/types';

const RATE_LIMIT_SECONDS = 30;
const CAP_MINUTES = 600; // 10 hours

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = extractUserId(event);

    const body = JSON.parse(event.body || '{}');

    // Validate with Zod schema
    const parsed = submitCheckinSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message ?? 'Invalid request';
      return error(ErrorCode.VALIDATION_ERROR, firstError, 400);
    }

    const { gpsLat, gpsLng, pixelX, pixelY, pixelAvailable, activityCategory, satisfaction, sentiment, floor, durationMinutes, activityTime } = parsed.data;

    const today = getTodayISTString();

    // Query today's check-ins for rate limit and duration cap
    const { items: todayCheckins } = await query<CheckIn>(
      'checkins',
      'userId = :uid AND #d = :date',
      { ':uid': userId, ':date': today },
      {
        indexName: 'UserDateIndex',
        expressionNames: { '#d': 'date' },
        limit: 600,
      }
    );

    // Rate limit: check if any check-in was created in the last 30 seconds
    const now = new Date();
    const recentCutoff = new Date(now.getTime() - RATE_LIMIT_SECONDS * 1000).toISOString();
    const hasRecentCheckin = todayCheckins.some(
      (c) => c.timestamp > recentCutoff
    );
    if (hasRecentCheckin) {
      return error(ErrorCode.RATE_LIMITED, 'Please wait before checking in again.', 429);
    }

    // Cumulative duration cap: 10 hours (600 minutes) per day
    const totalExistingMinutes = todayCheckins.reduce((sum, c) => {
      const mins = (c as Record<string, unknown>).durationMinutes;
      return sum + (typeof mins === 'number' ? mins : 0);
    }, 0);
    if (totalExistingMinutes + durationMinutes > CAP_MINUTES) {
      const remainingMinutes = CAP_MINUTES - totalExistingMinutes;
      return error(
        ErrorCode.DURATION_CAP_EXCEEDED,
        remainingMinutes <= 0
          ? 'You have reached the 10-hour daily activity limit.'
          : `Adding this would exceed your 10-hour daily limit. You have ${remainingMinutes} minutes remaining today.`,
        429
      );
    }

    // Get user's clan
    const user = await getItem<User>('users', { userId });
    const clanId = user?.clan ?? 'unknown';

    const checkInId = crypto.randomUUID();
    const timestamp = now.toISOString();

    const checkIn: CheckIn = {
      checkInId,
      userId,
      clanId,
      gpsLat,
      gpsLng,
      pixelX: pixelAvailable ? pixelX : null,
      pixelY: pixelAvailable ? pixelY : null,
      pixelAvailable,
      activityCategory,
      satisfaction,
      sentiment,
      floor,
      durationMinutes,
      activityTime,
      timestamp,
      date: today,
    };

    await putItem('checkins', checkIn as unknown as Record<string, unknown>);

    return success({ checkInId });
  } catch (err) {
    console.error('[submitCheckin] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
