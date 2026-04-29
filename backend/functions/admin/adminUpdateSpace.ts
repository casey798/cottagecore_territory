import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, updateItem } from '../../shared/db';
import { Space } from '../../shared/types';

function adminCheck(event: APIGatewayProxyEvent): APIGatewayProxyResult | null {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) return error(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
  if (authorizer.isAdmin !== 'true') {
    return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
  }
  return null;
}

const UPDATABLE_FIELDS = [
  'name', 'polygonPoints', 'gridCells', 'gridColumns', 'gridRows',
  'gpsLat', 'gpsLng', 'geofenceRadius', 'mapPixelX', 'mapPixelY',
  'active', 'notes',
] as const;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const authError = adminCheck(event);
    if (authError) return authError;

    const spaceId = event.pathParameters?.spaceId;
    if (!spaceId) {
      return error(ErrorCode.VALIDATION_ERROR, 'Missing spaceId path parameter', 400);
    }

    const existing = await getItem<Space>('spaces', { spaceId });
    if (!existing) {
      return error(ErrorCode.NOT_FOUND, 'Space not found', 404);
    }

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;

    // Build dynamic UpdateExpression from provided fields
    const setParts: string[] = [];
    const expressionValues: Record<string, unknown> = {};
    const expressionNames: Record<string, string> = {};

    for (const field of UPDATABLE_FIELDS) {
      if (body[field] !== undefined) {
        const attrAlias = `#${field}`;
        const valAlias = `:${field}`;
        expressionNames[attrAlias] = field;
        expressionValues[valAlias] = body[field];
        setParts.push(`${attrAlias} = ${valAlias}`);
      }
    }

    if (setParts.length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'No updatable fields provided', 400);
    }

    await updateItem(
      'spaces',
      { spaceId },
      `SET ${setParts.join(', ')}`,
      expressionValues,
      expressionNames
    );

    // Fetch updated item
    const updated = await getItem<Space>('spaces', { spaceId });

    return success(updated);
  } catch (err) {
    console.error('adminUpdateSpace error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to update space', 500);
  }
};
