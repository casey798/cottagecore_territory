import admin from 'firebase-admin';
import { scan, query } from './db';
import { User } from './types';
import { ensureFirebaseInitialized } from './firebase';

export interface FCMMessage {
  notification: {
    title: string;
    body: string;
  };
  data: Record<string, string>;
}

const BATCH_SIZE = 500;

export async function sendToTokens(
  tokens: string[],
  message: FCMMessage
): Promise<number> {
  if (tokens.length === 0) return 0;

  const initialized = await ensureFirebaseInitialized();
  if (!initialized) return 0;

  const messaging = admin.messaging();
  let delivered = 0;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    try {
      const result = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: message.notification,
        data: message.data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'grovewars_alerts',
          },
        },
      });
      delivered += result.successCount;
    } catch (err) {
      console.error('FCM batch send error:', err);
    }
  }

  return delivered;
}

export async function sendToAll(message: FCMMessage): Promise<number> {
  const tokens: string[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await scan<User>('users', {
      exclusiveStartKey: lastKey,
    });

    for (const user of result.items) {
      if (user.fcmToken) {
        tokens.push(user.fcmToken);
      }
    }

    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  return sendToTokens(tokens, message);
}

export async function sendToClan(
  clan: string,
  message: FCMMessage
): Promise<number> {
  const { items: users } = await query<User>(
    'users',
    'clan = :clan',
    { ':clan': clan },
    { indexName: 'ClanIndex' }
  );

  const tokens = users
    .map((u) => u.fcmToken)
    .filter((t): t is string => !!t);

  return sendToTokens(tokens, message);
}
