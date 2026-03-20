import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, deleteItem } from '../../shared/db';
import type { LocationMasterConfig } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const locationId = event.pathParameters?.locationId;
    if (!locationId) {
      return error(ErrorCode.VALIDATION_ERROR, 'locationId is required', 400);
    }

    const existing = await getItem<LocationMasterConfig>('location-master-config', { locationId });
    if (!existing) {
      return error(ErrorCode.NOT_FOUND, 'Location not found', 404);
    }

    await deleteItem('location-master-config', { locationId });
    await deleteItem('locations', { locationId });

    return success({ deleted: true });
  } catch (err) {
    console.error('[deleteMasterLocation] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
