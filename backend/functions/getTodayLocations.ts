import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../shared/auth';
import { getItem } from '../shared/db';
import { getTodayISTString } from '../shared/time';
import { success, error, ErrorCode } from '../shared/response';
import { PlayerAssignment, Location, PlayerLock, DailyConfig } from '../shared/types';

const STAGE = process.env.STAGE || 'dev';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);
    const today = getTodayISTString();
    console.log(`[getTodayLocations] userId=${userId}, today=${today}, stage=${STAGE}`);

    const assignment = await getItem<PlayerAssignment>('player-assignments', {
      dateUserId: `${today}#${userId}`,
    });
    console.log(`[getTodayLocations] assignment:`, assignment ? `found ${assignment.assignedLocationIds.length} locations` : 'NOT FOUND');

    let locationIds: string[];

    if (assignment) {
      locationIds = assignment.assignedLocationIds;
    } else if (STAGE === 'dev') {
      // Dev fallback: if no assignment yet, use daily config locations directly
      console.log('[getTodayLocations] Dev fallback: checking daily-config for today');
      const dailyConfig = await getItem<DailyConfig>('daily-config', { date: today });
      console.log(`[getTodayLocations] daily-config:`, dailyConfig ? `found ${dailyConfig.activeLocationIds.length} locations` : 'NOT FOUND');

      if (dailyConfig && dailyConfig.activeLocationIds.length > 0) {
        locationIds = dailyConfig.activeLocationIds;
      } else {
        console.log('[getTodayLocations] No assignment and no daily-config, returning empty');
        return success({ locations: [] });
      }
    } else {
      return success({ locations: [] });
    }

    const locations = await Promise.all(
      locationIds.map(async (locationId) => {
        const location = await getItem<Location>('locations', { locationId });

        const lock = await getItem<PlayerLock>('player-locks', {
          dateUserLocation: `${today}#${userId}#${locationId}`,
        });

        return {
          locationId,
          name: location?.name ?? 'Unknown',
          gpsLat: location?.gpsLat ?? 0,
          gpsLng: location?.gpsLng ?? 0,
          geofenceRadius: location?.geofenceRadius ?? 0,
          category: location?.category ?? 'other',
          locked: !!lock,
        };
      })
    );

    console.log(`[getTodayLocations] Returning ${locations.length} locations`);
    return success({ locations });
  } catch (err) {
    console.error('[getTodayLocations] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get today locations', 500);
  }
};
