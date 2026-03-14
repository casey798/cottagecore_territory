import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { User } from '../../shared/types';

function adminCheck(event: APIGatewayProxyEvent): APIGatewayProxyResult | null {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) return error(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
  if (authorizer.isAdmin !== 'true') {
    return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
  }
  return null;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const denied = adminCheck(event);
  if (denied) return denied;

  try {
    const email = event.queryStringParameters?.email;
    if (!email) {
      return error(ErrorCode.VALIDATION_ERROR, 'email query parameter is required', 400);
    }

    const { items } = await query<User>(
      'users',
      'email = :email',
      { ':email': email },
      { indexName: 'EmailIndex' },
    );

    return success({
      users: items.map((u) => ({
        userId: u.userId,
        email: u.email,
        displayName: u.displayName,
        clan: u.clan,
      })),
    });
  } catch (err) {
    console.error('getUsers error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
