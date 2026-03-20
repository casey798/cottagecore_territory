import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { PlayerAssignment, LocationMasterConfig } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      return error(ErrorCode.VALIDATION_ERROR, 'userId query parameter is required', 400);
    }

    const date = event.queryStringParameters?.date || getTodayISTString();
    const dateUserId = `${date}#${userId}`;

    const assignment = await getItem<PlayerAssignment>('player-assignments', { dateUserId });
    if (!assignment) {
      return error(ErrorCode.NOT_FOUND, `No assignment found for ${dateUserId}`, 404);
    }

    const coopSet = new Set(assignment.coopLocationIds ?? []);

    // Fetch location names in parallel
    const locationDetails = await Promise.all(
      assignment.assignedLocationIds.map(async (locationId) => {
        const loc = await getItem<LocationMasterConfig>('location-master-config', { locationId });
        return {
          locationId,
          name: loc?.name ?? 'Unknown',
          isCoop: coopSet.has(locationId),
        };
      })
    );

    return success({
      dateUserId: assignment.dateUserId,
      assignedLocations: locationDetails,
      coopCount: coopSet.size,
      totalCount: assignment.assignedLocationIds.length,
    });
  } catch (err) {
    console.error('[getPlayerAssignment] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to fetch player assignment', 500);
  }
}
