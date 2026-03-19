import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import type { LocationMasterConfig } from '../../shared/types';

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

const CSV_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'text/csv',
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const allItems: LocationMasterConfig[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<LocationMasterConfig>('location-master-config', { exclusiveStartKey: lastKey });
      allItems.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    const header = [
      'locationId', 'qrNumber', 'name', 'gpsLat', 'gpsLng', 'geofenceRadius',
      'mapPixelX', 'mapPixelY', 'normalizedX', 'normalizedY', 'floor',
      'classification', 'sdtDeficit', 'priorityTier',
      'phase1Visits', 'phase1Satisfaction', 'phase1DominantCluster', 'isNewSpace',
      'active', 'chestDropModifier', 'firstVisitBonus', 'coopOnly', 'bonusXP',
      'spaceFact', 'minigameAffinity', 'linkedTo', 'notes',
      'lastActiveDate', 'totalPhase2GameSessions', 'totalPhase2FreeRoamCheckins', 'avgPhase2Satisfaction',
    ].join(',');

    const rows = allItems.map((l) =>
      csvRow([
        l.locationId, l.qrNumber, l.name, l.gpsLat, l.gpsLng, l.geofenceRadius,
        l.mapPixelX, l.mapPixelY, l.normalizedX, l.normalizedY, l.floor,
        l.classification, l.sdtDeficit, l.priorityTier,
        l.phase1Visits, l.phase1Satisfaction, l.phase1DominantCluster, l.isNewSpace,
        l.active, l.chestDropModifier, l.firstVisitBonus, l.coopOnly, l.bonusXP,
        l.spaceFact, l.minigameAffinity ? l.minigameAffinity.join(';') : '',
        l.linkedTo, l.notes,
        l.lastActiveDate, l.totalPhase2GameSessions, l.totalPhase2FreeRoamCheckins, l.avgPhase2Satisfaction,
      ])
    );

    return {
      statusCode: 200,
      headers: CSV_HEADERS,
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportLocations] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
