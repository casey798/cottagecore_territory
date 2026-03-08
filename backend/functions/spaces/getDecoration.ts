import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { SpaceDecoration } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);
    const spaceId = event.pathParameters?.spaceId;

    if (!spaceId) {
      return error(ErrorCode.VALIDATION_ERROR, 'Missing spaceId path parameter', 400);
    }

    const decoration = await getItem<SpaceDecoration>('space-decorations', {
      userSpaceId: `${userId}#${spaceId}`,
    });

    if (!decoration) {
      return success({ layout: { placedAssets: [] } });
    }

    return success({ layout: decoration.layout });
  } catch (err) {
    console.error('getDecoration error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get decoration', 500);
  }
};
