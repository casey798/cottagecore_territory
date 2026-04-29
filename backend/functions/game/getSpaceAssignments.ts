import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import { Space } from '../../shared/types';
import { getOrCreateSpaceAssignment } from '../../shared/spaceAssignment';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);
    const today = getTodayISTString();

    // Get or lazy-create today's space assignment
    const assignment = await getOrCreateSpaceAssignment(userId, today);

    // Fetch space details in parallel
    const spaceDetails = await Promise.all(
      assignment.assignedSpaceIds.map(async (spaceId) => {
        const space = await getItem<Space>('spaces', { spaceId });
        return {
          spaceId,
          spaceName: space?.name ?? 'Unknown Space',
          completed: assignment.completedSpaceIds.includes(spaceId),
          mapPixelX: space?.mapPixelX ?? 0,
          mapPixelY: space?.mapPixelY ?? 0,
          gpsLat: space?.gpsLat ?? 0,
          gpsLng: space?.gpsLng ?? 0,
          geofenceRadius: space?.geofenceRadius ?? 15,
          polygonPoints: space?.polygonPoints ?? [],
        };
      })
    );

    return success({
      assignments: spaceDetails,
      spacesPerDay: assignment.assignedSpaceIds.length,
      completedCount: assignment.completedSpaceIds.length,
    });
  } catch (err) {
    console.error('getSpaceAssignments error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
