import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { scan, query } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import type { User } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // If email query param is provided, do a targeted lookup
    const email = event.queryStringParameters?.email;
    if (email) {
      const { items } = await query<User>(
        'users',
        'email = :email',
        { ':email': email },
        { indexName: 'EmailIndex' },
      );
      return success({ users: items });
    }

    // Otherwise, full table scan for admin user list
    const allUsers: User[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<User>('users', { exclusiveStartKey: lastKey });
      allUsers.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    return success({ users: allUsers });
  } catch (err) {
    console.error('getUsers error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
