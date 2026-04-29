import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
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

    const spaces: Space[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<Space>('spaces', { exclusiveStartKey: lastKey });
      spaces.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    return success({ spaces });
  } catch (err) {
    console.error('adminGetSpaces error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get spaces', 500);
  }
};
