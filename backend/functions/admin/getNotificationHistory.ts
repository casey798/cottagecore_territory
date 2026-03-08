import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import type { AdminNotification } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const claims = event.requestContext.authorizer?.claims;
    if (!claims) return error(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    const groups: string[] = (claims['cognito:groups'] as string || '').split(',').filter(Boolean);
    if (!groups.some((g) => g.toLowerCase() === 'admin')) return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);

    // Scan all notifications
    const notifications: AdminNotification[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await scan<AdminNotification>('admin-notifications', {
        exclusiveStartKey: lastKey,
      });
      notifications.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    // Sort by sentAt descending
    notifications.sort((a, b) => {
      return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
    });

    return success({ notifications });
  } catch (err) {
    console.error('getNotificationHistory error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
