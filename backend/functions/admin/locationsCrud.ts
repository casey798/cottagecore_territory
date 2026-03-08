import { randomUUID } from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, getItem, putItem, updateItem, deleteItem } from '../../shared/db';
import type { Location } from '../../shared/types';
import { LocationCategory } from '../../shared/types';

function adminCheck(event: APIGatewayProxyEvent): APIGatewayProxyResult | null {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) return error(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
  const groups: string[] = (claims['cognito:groups'] as string || '').split(',').filter(Boolean);
  if (!groups.some((g) => g.toLowerCase() === 'admin')) {
    return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
  }
  return null;
}

async function listLocations(): Promise<APIGatewayProxyResult> {
  const locations: Location[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<Location>('locations', { exclusiveStartKey: lastKey });
    locations.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  return success({ locations });
}

async function createLocation(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as Record<string, unknown>;

  const name = body.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    return error(ErrorCode.VALIDATION_ERROR, 'name is required', 400);
  }
  if (typeof body.gpsLat !== 'number' || typeof body.gpsLng !== 'number') {
    return error(ErrorCode.VALIDATION_ERROR, 'gpsLat and gpsLng are required numbers', 400);
  }

  const location: Location = {
    locationId: randomUUID(),
    name: (name as string).trim(),
    gpsLat: body.gpsLat as number,
    gpsLng: body.gpsLng as number,
    geofenceRadius: typeof body.geofenceRadius === 'number' ? body.geofenceRadius : 50,
    category: Object.values(LocationCategory).includes(body.category as LocationCategory)
      ? (body.category as LocationCategory)
      : LocationCategory.Other,
    active: typeof body.active === 'boolean' ? body.active : true,
    chestDropModifier: typeof body.chestDropModifier === 'number' ? body.chestDropModifier : 1,
    notes: typeof body.notes === 'string' ? body.notes : '',
  };

  await putItem<Record<string, unknown>>('locations', location as unknown as Record<string, unknown>);
  return success(location, 201);
}

async function updateLocationHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const locationId = event.pathParameters?.locationId;
  if (!locationId) return error(ErrorCode.VALIDATION_ERROR, 'locationId is required', 400);

  const existing = await getItem<Location>('locations', { locationId });
  if (!existing) return error(ErrorCode.NOT_FOUND, 'Location not found', 404);

  const body = JSON.parse(event.body || '{}') as Record<string, unknown>;

  const updates: string[] = [];
  const values: Record<string, unknown> = {};
  const names: Record<string, string> = {};

  if (typeof body.name === 'string') {
    updates.push('#n = :name');
    values[':name'] = body.name.trim();
    names['#n'] = 'name';
  }
  if (typeof body.gpsLat === 'number') {
    updates.push('gpsLat = :lat');
    values[':lat'] = body.gpsLat;
  }
  if (typeof body.gpsLng === 'number') {
    updates.push('gpsLng = :lng');
    values[':lng'] = body.gpsLng;
  }
  if (typeof body.geofenceRadius === 'number') {
    updates.push('geofenceRadius = :radius');
    values[':radius'] = body.geofenceRadius;
  }
  if (typeof body.category === 'string') {
    updates.push('category = :cat');
    values[':cat'] = body.category;
  }
  if (typeof body.active === 'boolean') {
    updates.push('active = :active');
    values[':active'] = body.active;
  }
  if (typeof body.chestDropModifier === 'number') {
    updates.push('chestDropModifier = :cdm');
    values[':cdm'] = body.chestDropModifier;
  }
  if (typeof body.notes === 'string') {
    updates.push('notes = :notes');
    values[':notes'] = body.notes;
  }

  if (updates.length === 0) {
    return error(ErrorCode.VALIDATION_ERROR, 'No fields to update', 400);
  }

  const result = await updateItem(
    'locations',
    { locationId },
    'SET ' + updates.join(', '),
    Object.keys(values).length > 0 ? values : undefined,
    Object.keys(names).length > 0 ? names : undefined,
  );

  return success(result);
}

async function deleteLocationHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const locationId = event.pathParameters?.locationId;
  if (!locationId) return error(ErrorCode.VALIDATION_ERROR, 'locationId is required', 400);

  const existing = await getItem<Location>('locations', { locationId });
  if (!existing) return error(ErrorCode.NOT_FOUND, 'Location not found', 404);

  await deleteItem('locations', { locationId });
  return success({ deleted: true });
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const denied = adminCheck(event);
    if (denied) return denied;

    const method = event.httpMethod.toUpperCase();
    const hasLocationId = !!event.pathParameters?.locationId;

    if (method === 'GET') return listLocations();
    if (method === 'POST') return createLocation(event);
    if (method === 'PUT' && hasLocationId) return updateLocationHandler(event);
    if (method === 'DELETE' && hasLocationId) return deleteLocationHandler(event);

    return error(ErrorCode.VALIDATION_ERROR, 'Method not allowed', 405);
  } catch (err) {
    console.error('locationsCrud error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
