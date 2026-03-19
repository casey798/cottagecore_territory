import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { query } from '../../shared/db';
import type { GameSession } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const userId = event.pathParameters?.userId;
    if (!userId) {
      return error(ErrorCode.VALIDATION_ERROR, 'userId path parameter is required', 400);
    }

    const params = event.queryStringParameters || {};
    const limit = Math.min(parseInt(params.limit || '50', 10) || 50, 200);
    const cursor = params.cursor;

    const exclusiveStartKey = cursor
      ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
      : undefined;

    const result = await query<GameSession>(
      'game-sessions',
      'userId = :userId',
      { ':userId': userId },
      {
        indexName: 'UserDateIndex',
        scanIndexForward: false,
        limit,
        exclusiveStartKey,
      },
    );

    const nextCursor = result.lastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64')
      : undefined;

    return success({
      sessions: result.items,
      nextCursor,
    });
  } catch (err) {
    console.error('[getUserSessions] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
