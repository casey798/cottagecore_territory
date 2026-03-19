import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import crypto from 'crypto';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem, query, scan } from '../../shared/db';
import { isWithinGeofence } from '../../shared/geo';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import { Location, User } from '../../shared/types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const body = JSON.parse(event.body || '{}');
    const gpsLat = body.gpsLat as number;
    const gpsLng = body.gpsLng as number;

    if (typeof gpsLat !== 'number' || typeof gpsLng !== 'number' ||
        gpsLat < -90 || gpsLat > 90 || gpsLng < -180 || gpsLng > 180) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid GPS coordinates', 400);
    }

    // Verify user exists
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    // Load all locations
    const { items: locations } = await scan<Location>('locations');

    // Find a matching location within geofence
    let matchedLocation: Location | null = null;
    for (const loc of locations) {
      if (isWithinGeofence(gpsLat, gpsLng, loc.gpsLat, loc.gpsLng, loc.geofenceRadius)) {
        matchedLocation = loc;
        break;
      }
    }

    if (!matchedLocation) {
      return error(ErrorCode.NOT_IN_RANGE, 'You are not within range of any location', 400);
    }

    const today = getTodayISTString();

    // Check if already checked in at this location today
    const { items: existingCheckins } = await query(
      'game-sessions',
      'userId = :uid AND #d = :date',
      {
        ':uid': userId,
        ':date': today,
        ':locId': matchedLocation.locationId,
        ':checkin': 'checkin',
      },
      {
        indexName: 'UserDateIndex',
        expressionNames: { '#d': 'date', '#r': 'result' },
        filterExpression: 'locationId = :locId AND #r = :checkin',
        limit: 50,
      }
    );

    if (existingCheckins.length > 0) {
      return error(ErrorCode.ALREADY_CHECKED_IN, 'You have already checked in at this location today', 400);
    }

    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();

    // Write checkin as a game session record
    const checkinRecord: Record<string, unknown> = {
      sessionId,
      userId,
      locationId: matchedLocation.locationId,
      minigameId: 'checkin',
      date: today,
      startedAt: now,
      completedAt: now,
      result: 'checkin',
      xpEarned: 0,
      chestDropped: false,
      chestAssetId: null,
      completionHash: '',
      coopPartnerId: null,
      practiceSession: true,
    };

    await putItem('game-sessions', checkinRecord);

    return success({
      locationId: matchedLocation.locationId,
      locationName: matchedLocation.name,
      checkedIn: true,
    });
  } catch (err) {
    console.error('checkin error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
