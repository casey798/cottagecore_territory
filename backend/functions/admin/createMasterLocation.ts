import { randomUUID, randomBytes } from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { putItem, scan } from '../../shared/db';
import type { LocationMasterConfig } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;

    // Validate required fields
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return error(ErrorCode.VALIDATION_ERROR, 'name is required', 400);
    }
    if (typeof body.qrNumber !== 'number') {
      return error(ErrorCode.VALIDATION_ERROR, 'qrNumber is required', 400);
    }
    if (typeof body.mapPixelX !== 'number' || typeof body.mapPixelY !== 'number') {
      return error(ErrorCode.VALIDATION_ERROR, 'mapPixelX and mapPixelY are required', 400);
    }
    if (typeof body.gpsLat !== 'number' || typeof body.gpsLng !== 'number') {
      return error(ErrorCode.VALIDATION_ERROR, 'gpsLat and gpsLng are required', 400);
    }

    // Check QR number uniqueness
    const qrNum = body.qrNumber as number;
    const { items: dupes } = await scan<LocationMasterConfig>('location-master-config', {
      filterExpression: 'qrNumber = :qr',
      expressionValues: { ':qr': qrNum },
    });
    if (dupes.length > 0) {
      return error(
        ErrorCode.DUPLICATE_QR_NUMBER,
        `QR number ${qrNum} is already assigned to location ${dupes[0].name}`,
        400
      );
    }

    const location: LocationMasterConfig = {
      locationId: randomUUID(),
      qrNumber: body.qrNumber as number,
      name: (body.name as string).trim(),
      gpsLat: body.gpsLat as number,
      gpsLng: body.gpsLng as number,
      geofenceRadius: typeof body.geofenceRadius === 'number' ? body.geofenceRadius : 15,
      mapPixelX: body.mapPixelX as number,
      mapPixelY: body.mapPixelY as number,
      normalizedX: typeof body.normalizedX === 'number' ? body.normalizedX : 0,
      normalizedY: typeof body.normalizedY === 'number' ? body.normalizedY : 0,
      floor: typeof body.floor === 'string' ? body.floor : 'ground',
      classification: typeof body.classification === 'string' ? body.classification as LocationMasterConfig['classification'] : 'TBD',
      sdtDeficit: typeof body.sdtDeficit === 'number' ? body.sdtDeficit : 0,
      priorityTier: typeof body.priorityTier === 'string' ? body.priorityTier as LocationMasterConfig['priorityTier'] : null,
      phase1Visits: typeof body.phase1Visits === 'number' ? body.phase1Visits : 0,
      phase1Satisfaction: typeof body.phase1Satisfaction === 'number' ? body.phase1Satisfaction : null,
      phase1DominantCluster: typeof body.phase1DominantCluster === 'string' ? body.phase1DominantCluster : null,
      isNewSpace: typeof body.isNewSpace === 'boolean' ? body.isNewSpace : true,
      active: typeof body.active === 'boolean' ? body.active : true,
      chestDropModifier: typeof body.chestDropModifier === 'number' ? body.chestDropModifier : 1,
      firstVisitBonus: typeof body.firstVisitBonus === 'boolean' ? body.firstVisitBonus : true,
      coopOnly: typeof body.coopOnly === 'boolean' ? body.coopOnly : false,
      bonusXP: typeof body.bonusXP === 'boolean' ? body.bonusXP : false,
      spaceFact: typeof body.spaceFact === 'string' ? body.spaceFact : null,
      minigameAffinity: Array.isArray(body.minigameAffinity) ? body.minigameAffinity as string[] : null,
      linkedTo: typeof body.linkedTo === 'string' ? body.linkedTo : null,
      notes: typeof body.notes === 'string' ? body.notes : '',
      lastActiveDate: null,
      totalPhase2GameSessions: 0,
      totalPhase2FreeRoamCheckins: 0,
      avgPhase2Satisfaction: null,
      last3DaysVisits: [0, 0, 0],
      qrSecret: randomBytes(32).toString('hex'),
      qrGeneratedAt: new Date().toISOString(),
    };

    await putItem<Record<string, unknown>>(
      'location-master-config',
      location as unknown as Record<string, unknown>
    );

    // Also create in the legacy locations table for game-flow compatibility
    await putItem<Record<string, unknown>>('locations', {
      locationId: location.locationId,
      name: location.name,
      gpsLat: location.gpsLat,
      gpsLng: location.gpsLng,
      geofenceRadius: location.geofenceRadius,
      category: 'other',
      active: location.active,
      chestDropModifier: location.chestDropModifier,
      notes: location.notes,
      coopOnly: location.coopOnly,
    });

    return success(location, 201);
  } catch (err) {
    console.error('[createMasterLocation] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
