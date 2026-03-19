import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, updateItem } from '../../shared/db';

interface NotificationRecord {
  notificationId: string;
  status?: string;
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const notificationId = event.pathParameters?.notificationId;
    if (!notificationId) {
      return error(ErrorCode.VALIDATION_ERROR, 'notificationId is required', 400);
    }

    const existing = await getItem<NotificationRecord>('admin-notifications', { notificationId });
    if (!existing) {
      return error(ErrorCode.NOT_FOUND, 'Notification not found', 404);
    }

    if (existing.status === 'sent') {
      return error(ErrorCode.VALIDATION_ERROR, 'Cannot cancel a sent notification', 400);
    }

    await updateItem(
      'admin-notifications',
      { notificationId },
      'SET #s = :cancelled',
      { ':cancelled': 'cancelled' },
      { '#s': 'status' },
    );

    return success({ notificationId, status: 'cancelled' });
  } catch (err) {
    console.error('[cancelNotification] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
