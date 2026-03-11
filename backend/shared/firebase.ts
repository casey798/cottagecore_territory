import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import admin from 'firebase-admin';

const STAGE = process.env.STAGE || 'dev';
const SSM_PARAM_PATH = `/grovewars/${STAGE}/fcm-service-account`;

const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'ap-south-1' });

let initialized = false;

export async function ensureFirebaseInitialized(): Promise<boolean> {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return true;
  }

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

    initialized = true;
    return true;
  } catch (err) {
    console.warn('Failed to initialize Firebase:', err);
    return false;
  }
}

export function getFirebaseAdmin(): typeof admin {
  return admin;
}
