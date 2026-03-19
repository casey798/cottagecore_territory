import { randomUUID } from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, updateItem, putItem } from '../../shared/db';
import type { User } from '../../shared/types';

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
    const amount = body.amount as number;
    const reason = body.reason as string;

    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'amount must be a non-zero integer', 400);
    }
    if (!reason || !reason.trim()) {
      return error(ErrorCode.VALIDATION_ERROR, 'reason is required', 400);
    }

    // Get current XP to clamp
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    const newXp = Math.max(0, (user.seasonXp || 0) + amount);

    await updateItem(
      'users',
      { userId },
      'SET seasonXp = :xp',
      { ':xp': newXp },
    );

    // Audit log
    const adminUserId = authorizer.userId || authorizer.uid || 'unknown';
    await putItem('admin-audit', {
      auditId: randomUUID(),
      action: 'XP_ADJUST',
      targetUserId: userId,
      adminUserId,
      details: JSON.stringify({ amount, reason: reason.trim(), previousXp: user.seasonXp, newXp }),
      timestamp: new Date().toISOString(),
    });

    return success({ newSeasonXp: newXp });
  } catch (err) {
    console.error('[adjustUserXp] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
