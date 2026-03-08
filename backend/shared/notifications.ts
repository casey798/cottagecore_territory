import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import admin from 'firebase-admin';
import { scan, query } from './db';
import { User } from './types';

const STAGE = process.env.STAGE || 'dev';
const SSM_PARAM_PATH = `/grovewars/${STAGE}/fcm-service-account`;

const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'ap-south-1' });

let firebaseInitialized = false;

async function initFirebase(): Promise<boolean> {
  if (firebaseInitialized) return true;

  try {
    const result = await ssmClient.send(
      new GetParameterCommand({
        Name: SSM_PARAM_PATH,
        WithDecryption: true,
      })
    );

    const credentialsJson = result.Parameter?.Value;
    if (!credentialsJson) {
      console.warn('FCM service account not found in SSM, skipping Firebase init');
      return false;
    }

    const serviceAccount = JSON.parse(credentialsJson) as admin.ServiceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'grovewars-b37da',
    });

    firebaseInitialized = true;
    return true;
  } catch (err) {
    console.warn('Failed to initialize Firebase:', err);
    return false;
  }
}

export interface FCMNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendToDevices(
  tokens: string[],
  notification: FCMNotification
): Promise<void> {
  if (tokens.length === 0) return;

  const initialized = await initFirebase();
  if (!initialized) return;

  const messaging = admin.messaging();
  const BATCH_SIZE = 500;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    try {
      await messaging.sendEachForMulticast({
        tokens: batch,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data,
      });
    } catch (err) {
      console.error('FCM batch send error:', err);
    }
  }
}

export async function sendToClans(
  clans: string[],
  notification: FCMNotification
): Promise<void> {
  const tokens: string[] = [];

  for (const clan of clans) {
    const { items: users } = await query<User>(
      'users',
      'clan = :clan',
      { ':clan': clan },
      { indexName: 'ClanIndex' }
    );

    for (const user of users) {
      if (user.fcmToken) {
        tokens.push(user.fcmToken);
      }
    }
  }

  await sendToDevices(tokens, notification);
}

export async function sendToAll(
  notification: FCMNotification
): Promise<void> {
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

  await sendToDevices(tokens, notification);
}

// Legacy functions for backward compatibility
export async function sendToDevice(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<void> {
  await sendToDevices([token], { title, body, data });
}

export async function sendToTokens(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>
): Promise<{ sent: number }> {
  await sendToDevices(tokens, { title, body, data });
  return { sent: tokens.length };
}
