import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, deleteItem } from '../../shared/db';
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

    const spaceId = event.pathParameters?.spaceId;
    if (!spaceId) {
      return error(ErrorCode.VALIDATION_ERROR, 'Missing spaceId path parameter', 400);
    }

    const existing = await getItem<Space>('spaces', { spaceId });
    if (!existing) {
      return error(ErrorCode.NOT_FOUND, 'Space not found', 404);
    }

    await deleteItem('spaces', { spaceId });

    return success({ success: true });
  } catch (err) {
    console.error('adminDeleteSpace error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to delete space', 500);
  }
};
