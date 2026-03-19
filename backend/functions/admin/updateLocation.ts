import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, updateItem } from '../../shared/db';
import type { LocationMasterConfig } from '../../shared/types';

const UPDATABLE_FIELDS = new Set([
  'name',
  'gpsLat',
  'gpsLng',
  'geofenceRadius',
  'mapPixelX',
  'mapPixelY',
  'normalizedX',
  'normalizedY',
  'active',
  'chestDropModifier',
  'firstVisitBonus',
  'coopOnly',
  'bonusXP',
  'spaceFact',
  'minigameAffinity',
  'linkedTo',
  'notes',
]);

const READ_ONLY_FIELDS = new Set([
  'classification',
  'sdtDeficit',
  'priorityTier',
  'phase1Visits',
  'phase1Satisfaction',
  'phase1DominantCluster',
  'isNewSpace',
  'qrNumber',
  'floor',
  'totalPhase2GameSessions',
  'totalPhase2FreeRoamCheckins',
  'avgPhase2Satisfaction',
  'lastActiveDate',
]);

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

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;

    // Reject read-only fields
    const readOnlyAttempts = Object.keys(body).filter(k => READ_ONLY_FIELDS.has(k));
    if (readOnlyAttempts.length > 0) {
      return error(
        ErrorCode.VALIDATION_ERROR,
        `Cannot update read-only fields: ${readOnlyAttempts.join(', ')}`,
        400
      );
    }

    // Filter to only updatable fields
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (UPDATABLE_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'No valid fields to update', 400);
    }

    // Verify location exists
    const existing = await getItem<LocationMasterConfig>('location-master-config', { locationId });
    if (!existing) {
      return error(ErrorCode.NOT_FOUND, 'Location not found', 404);
    }

    // Build dynamic UpdateExpression
    const setParts: string[] = [];
    const expressionValues: Record<string, unknown> = {};
    const expressionNames: Record<string, string> = {};

    let idx = 0;
    for (const [key, value] of Object.entries(updates)) {
      const nameAlias = `#f${idx}`;
      const valueAlias = `:v${idx}`;
      expressionNames[nameAlias] = key;
      expressionValues[valueAlias] = value;
      setParts.push(`${nameAlias} = ${valueAlias}`);
      idx++;
    }

    const updateExpression = `SET ${setParts.join(', ')}`;

    const updated = await updateItem(
      'location-master-config',
      { locationId },
      updateExpression,
      expressionValues,
      expressionNames
    );

    return success({ location: updated });
  } catch (err) {
    console.error('[updateLocation] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to update location', 500);
  }
}
