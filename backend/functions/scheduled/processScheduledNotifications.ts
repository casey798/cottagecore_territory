import { ScheduledEvent } from 'aws-lambda';
import { scan, query, updateItem } from '../../shared/db';
import { sendToTokens } from '../../shared/notifications';
import type { User, AdminNotification } from '../../shared/types';

interface ScheduledNotification extends AdminNotification {
  scheduledFor: string;
  status: string;
}

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  try {
    const now = new Date().toISOString();

    // Scan for scheduled notifications ready to send
    const pending: ScheduledNotification[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<ScheduledNotification>('admin-notifications', {
        filterExpression: '#s = :scheduled AND scheduledFor <= :now',
        expressionNames: { '#s': 'status' },
        expressionValues: { ':scheduled': 'scheduled', ':now': now },
        exclusiveStartKey: lastKey,
      });
      pending.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    if (pending.length === 0) {
      console.log('No scheduled notifications to process');
      return;
    }

    console.log(`Processing ${pending.length} scheduled notifications`);

    for (const notif of pending) {
      try {
        // Collect FCM tokens based on target
        const tokens: string[] = [];

        if (notif.target === 'all') {
          let lastUserKey: Record<string, unknown> | undefined;
          do {
            const result = await scan<User>('users', {
              filterExpression: 'attribute_exists(fcmToken) AND fcmToken <> :empty',
              expressionValues: { ':empty': '' },
              exclusiveStartKey: lastUserKey,
            });
            for (const user of result.items) {
              if (user.fcmToken) tokens.push(user.fcmToken);
            }
            lastUserKey = result.lastEvaluatedKey;
          } while (lastUserKey);
        } else {
          let lastUserKey: Record<string, unknown> | undefined;
          do {
            const result = await query<User>(
              'users',
              'clan = :clan',
              { ':clan': notif.target },
              {
                indexName: 'ClanIndex',
                filterExpression: 'attribute_exists(fcmToken) AND fcmToken <> :empty',
                expressionNames: undefined,
                exclusiveStartKey: lastUserKey,
              }
            );
            for (const user of result.items) {
              if (user.fcmToken) tokens.push(user.fcmToken);
            }
            lastUserKey = result.lastEvaluatedKey;
          } while (lastUserKey);
        }

        // Send via FCM
        const sent = await sendToTokens(tokens, {
          notification: { title: 'GroveWars', body: notif.message },
          data: { type: 'ADMIN_CUSTOM', notificationType: notif.notificationType, target: notif.target },
        });

        // Update status to sent
        await updateItem(
          'admin-notifications',
          { notificationId: notif.notificationId },
          'SET #s = :sent, sentAt = :now, deliveryCount = :count',
          { ':sent': 'sent', ':now': new Date().toISOString(), ':count': sent },
          { '#s': 'status' },
        );

        console.log(`Sent scheduled notification ${notif.notificationId}: ${sent} devices`);
      } catch (err) {
        console.error(`Failed to process notification ${notif.notificationId}:`, err);
        await updateItem(
          'admin-notifications',
          { notificationId: notif.notificationId },
          'SET #s = :failed',
          { ':failed': 'failed' },
          { '#s': 'status' },
        );
      }
    }
  } catch (err) {
    console.error('processScheduledNotifications error:', err);
    throw err;
  }
};
