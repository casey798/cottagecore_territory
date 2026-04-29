import { randomUUID, randomBytes } from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { putItem } from '../../shared/db';
import { Space } from '../../shared/types';

function adminCheck(event: APIGatewayProxyEvent): APIGatewayProxyResult | null {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) return error(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
  if (authorizer.isAdmin !== 'true') {
    return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
  }
  return null;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const authError = adminCheck(event);
    if (authError) return authError;

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;

    if (typeof body.name !== 'string' || (body.name as string).trim().length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'name is required', 400);
    }
    if (!Array.isArray(body.polygonPoints) || body.polygonPoints.length < 3) {
      return error(ErrorCode.VALIDATION_ERROR, 'polygonPoints must have at least 3 points', 400);
    }
    if (!Array.isArray(body.gridCells) || body.gridCells.length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'gridCells is required', 400);
    }
    if (typeof body.gridColumns !== 'number' || typeof body.gridRows !== 'number') {
      return error(ErrorCode.VALIDATION_ERROR, 'gridColumns and gridRows are required numbers', 400);
    }
    if (typeof body.gpsLat !== 'number' || typeof body.gpsLng !== 'number') {
      return error(ErrorCode.VALIDATION_ERROR, 'gpsLat and gpsLng are required numbers', 400);
    }

    const space: Space = {
      spaceId: randomUUID(),
      name: (body.name as string).trim(),
      polygonPoints: body.polygonPoints as Array<{ x: number; y: number }>,
      gridCells: body.gridCells as Array<{ col: number; row: number }>,
      gridColumns: body.gridColumns as number,
      gridRows: body.gridRows as number,
      qrSecret: randomBytes(32).toString('hex'),
      qrNumber: Math.floor(Math.random() * 9000) + 1000,
      gpsLat: body.gpsLat as number,
      gpsLng: body.gpsLng as number,
      geofenceRadius: typeof body.geofenceRadius === 'number' ? body.geofenceRadius : 15,
      mapPixelX: typeof body.mapPixelX === 'number' ? body.mapPixelX : 0,
      mapPixelY: typeof body.mapPixelY === 'number' ? body.mapPixelY : 0,
      active: true,
      createdAt: new Date().toISOString(),
      ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
    };

    await putItem('spaces', space as unknown as Record<string, unknown>);

    return success(space, 201);
  } catch (err) {
    console.error('adminCreateSpace error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to create space', 500);
  }
};
