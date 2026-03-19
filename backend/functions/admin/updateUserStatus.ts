import { randomUUID } from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { updateItem, putItem } from '../../shared/db';

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

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const status = body.status as string;
    const reason = (body.reason as string) || '';

    if (status !== 'banned' && status !== 'active') {
      return error(ErrorCode.VALIDATION_ERROR, 'status must be "banned" or "active"', 400);
    }

    if (status === 'banned') {
      if (!reason.trim()) {
        return error(ErrorCode.VALIDATION_ERROR, 'reason is required when banning a player', 400);
      }
      await updateItem(
        'users',
        { userId },
        'SET banned = :banned, banReason = :reason, bannedAt = :bannedAt',
        {
          ':banned': true,
          ':reason': reason.trim(),
          ':bannedAt': new Date().toISOString(),
        },
      );
    } else {
      await updateItem(
        'users',
        { userId },
        'SET banned = :banned REMOVE banReason, bannedAt',
        { ':banned': false },
      );
    }

    // Audit log
    const adminUserId = authorizer.userId || authorizer.uid || 'unknown';
    await putItem('admin-audit', {
      auditId: randomUUID(),
      action: status === 'banned' ? 'BAN_USER' : 'UNBAN_USER',
      targetUserId: userId,
      adminUserId,
      details: JSON.stringify({ status, reason }),
      timestamp: new Date().toISOString(),
    });

    return success({ updated: true });
  } catch (err) {
    console.error('[updateUserStatus] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
