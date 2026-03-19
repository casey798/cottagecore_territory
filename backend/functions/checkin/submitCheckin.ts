import crypto from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { CheckIn, User, ActivityCategory, Satisfaction, Sentiment, Floor } from '../../shared/types';

const VALID_ACTIVITIES: ActivityCategory[] = [
  'high_effort_personal',
  'low_effort_personal',
  'high_effort_social',
  'low_effort_social',
];

const VALID_SATISFACTIONS: Satisfaction[] = [0, 0.25, 0.5, 0.75, 1];

const VALID_SENTIMENTS: Sentiment[] = ['yes', 'maybe', 'no'];

const VALID_FLOORS: Floor[] = ['outdoor', 'ground', 'first', 'second', 'third'];

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = extractUserId(event);

    const body = JSON.parse(event.body || '{}');

    // Validate required fields
    const { gpsLat, gpsLng, pixelX, pixelY, activityCategory, satisfaction, sentiment, floor } = body;

    if (typeof gpsLat !== 'number' || typeof gpsLng !== 'number' || !isFinite(gpsLat) || !isFinite(gpsLng)) {
      return error(ErrorCode.VALIDATION_ERROR, 'gpsLat and gpsLng must be valid numbers', 400);
    }

    if (typeof pixelX !== 'number' || typeof pixelY !== 'number' || pixelX < 0 || pixelY < 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'pixelX and pixelY must be non-negative numbers', 400);
    }

    if (!VALID_ACTIVITIES.includes(activityCategory)) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid activityCategory', 400);
    }

    if (!VALID_SATISFACTIONS.includes(satisfaction)) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid satisfaction value', 400);
    }

    if (!VALID_SENTIMENTS.includes(sentiment)) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid sentiment value', 400);
    }

    if (!VALID_FLOORS.includes(floor)) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid floor value', 400);
    }

    // Get user's clan
    const user = await getItem<User>('users', { userId });
    const clanId = user?.clan ?? 'unknown';

    const checkInId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const date = getTodayISTString();

    const checkIn: CheckIn = {
      checkInId,
      userId,
      clanId,
      gpsLat,
      gpsLng,
      pixelX,
      pixelY,
      activityCategory,
      satisfaction,
      sentiment,
      floor,
      timestamp,
      date,
    };

    await putItem('checkins', checkIn as unknown as Record<string, unknown>);

    return success({ checkInId });
  } catch (err) {
    console.error('[submitCheckin] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
