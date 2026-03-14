import { randomUUID } from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { sendNotificationSchema } from '../../shared/schemas';
import { scan, query, putItem } from '../../shared/db';
import { sendToTokens } from '../../shared/notifications';
import { ClanId, NotificationType } from '../../shared/types';
import type { User, AdminNotification } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);

    // Validate input
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const parsed = sendNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { message, target: targetRaw, notificationType: notifTypeRaw } = parsed.data;
    const target = targetRaw as ClanId | 'all';
    const notificationType = notifTypeRaw as NotificationType;

    // Collect FCM tokens
    const tokens: string[] = [];

    if (target === 'all') {
      // Scan all users
      let lastKey: Record<string, unknown> | undefined;
      do {
        const result = await scan<User>('users', {
          filterExpression: 'attribute_exists(fcmToken) AND fcmToken <> :empty',
          expressionValues: { ':empty': '' },
          exclusiveStartKey: lastKey,
        });
        for (const user of result.items) {
          if (user.fcmToken) {
            tokens.push(user.fcmToken);
          }
        }
        lastKey = result.lastEvaluatedKey;
      } while (lastKey);
    } else {
      // Query by clan using ClanIndex
      let lastKey: Record<string, unknown> | undefined;
      do {
        const result = await query<User>(
          'users',
          'clan = :clan',
          { ':clan': target },
          {
            indexName: 'ClanIndex',
            filterExpression: 'attribute_exists(fcmToken) AND fcmToken <> :empty',
            expressionNames: undefined,
            exclusiveStartKey: lastKey,
          }
        );
        for (const user of result.items) {
          if (user.fcmToken) {
            tokens.push(user.fcmToken);
          }
        }
        lastKey = result.lastEvaluatedKey;
      } while (lastKey);
    }

    // Send notifications
    const sent = await sendToTokens(tokens, {
      notification: { title: 'GroveWars', body: message },
      data: { type: 'ADMIN_CUSTOM', notificationType, target },
    });

    // Create admin notification record
    const notificationId = randomUUID();
    const notification: AdminNotification = {
      notificationId,
      message,
      target,
      notificationType: notificationType as AdminNotification['notificationType'],
      sentAt: new Date().toISOString(),
      sentBy: (event.requestContext.authorizer?.sub as string) || 'admin',
      deliveryCount: sent,
    };

    await putItem<Record<string, unknown>>(
      'admin-notifications',
      notification as unknown as Record<string, unknown>
    );

    return success({
      notificationId,
      deliveryCount: sent,
    });
  } catch (err) {
    console.error('sendNotification error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
