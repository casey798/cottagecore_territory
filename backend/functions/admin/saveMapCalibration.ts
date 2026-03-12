import { randomUUID } from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, putItem, updateItem } from '../../shared/db';
import { computeAffineTransform } from '../../shared/affineTransform';
import type { CalibrationPoint, MapCalibration } from '../../shared/types';

function adminCheck(event: APIGatewayProxyEvent): APIGatewayProxyResult | null {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) return error(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
  if (authorizer.isAdmin !== 'true') {
    return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
  }
  return null;
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const denied = adminCheck(event);
    if (denied) return denied;

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;

    const mapImageKey = body.mapImageKey;
    if (typeof mapImageKey !== 'string' || mapImageKey.trim().length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'mapImageKey is required', 400);
    }

    const mapWidth = body.mapWidth;
    const mapHeight = body.mapHeight;
    const tileSize = body.tileSize;
    if (typeof mapWidth !== 'number' || typeof mapHeight !== 'number' || typeof tileSize !== 'number') {
      return error(ErrorCode.VALIDATION_ERROR, 'mapWidth, mapHeight, and tileSize are required numbers', 400);
    }

    const points = body.points;
    if (!Array.isArray(points) || points.length < 3) {
      return error(ErrorCode.VALIDATION_ERROR, 'At least 3 calibration points are required', 400);
    }

    for (let i = 0; i < points.length; i++) {
      const p = points[i] as Record<string, unknown>;
      if (
        typeof p.gpsLat !== 'number' || typeof p.gpsLng !== 'number' ||
        typeof p.pixelX !== 'number' || typeof p.pixelY !== 'number'
      ) {
        return error(ErrorCode.VALIDATION_ERROR, `Point ${i + 1} must have numeric gpsLat, gpsLng, pixelX, pixelY`, 400);
      }
    }

    const calibrationPoints: CalibrationPoint[] = (points as Record<string, number>[]).map((p) => ({
      gpsLat: p.gpsLat,
      gpsLng: p.gpsLng,
      pixelX: p.pixelX,
      pixelY: p.pixelY,
    }));

    // Compute the affine transform server-side (don't trust client matrix)
    const transformMatrix = computeAffineTransform(calibrationPoints);

    // Deactivate any currently active calibrations
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<MapCalibration>('map-calibration', {
        filterExpression: 'active = :active',
        expressionValues: { ':active': true },
        exclusiveStartKey: lastKey,
      });
      for (const cal of result.items) {
        await updateItem(
          'map-calibration',
          { calibrationId: cal.calibrationId },
          'SET active = :inactive',
          { ':inactive': false }
        );
      }
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    // Save new calibration as active
    const calibration: MapCalibration = {
      calibrationId: randomUUID(),
      mapImageKey: mapImageKey as string,
      mapWidth: mapWidth as number,
      mapHeight: mapHeight as number,
      tileSize: tileSize as number,
      points: calibrationPoints,
      transformMatrix,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await putItem('map-calibration', calibration as unknown as Record<string, unknown>);

    return success({
      calibrationId: calibration.calibrationId,
      transformMatrix,
    }, 201);
  } catch (err) {
    console.error('saveMapCalibration error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
