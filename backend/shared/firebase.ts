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

  let result;
  try {
    result = await ssmClient.send(
      new GetParameterCommand({
        Name: SSM_PARAM_PATH,
        WithDecryption: true,
      })
    );
  } catch (err) {
    const error = err as Error;
    throw new Error('Failed to load Firebase service account from SSM: ' + error.message);
  }

  const credentialsJson = result.Parameter?.Value;
  if (!credentialsJson) {
    throw new Error('Firebase service account not found in SSM at ' + SSM_PARAM_PATH);
  }

  let serviceAccount: admin.ServiceAccount;
  try {
    serviceAccount = JSON.parse(credentialsJson) as admin.ServiceAccount;
  } catch (err) {
    const error = err as Error;
    throw new Error('Firebase service account JSON in SSM is malformed: ' + error.message);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'grovewars-b37da',
  });

  initialized = true;
  return true;
}

export function getFirebaseAdmin(): typeof admin {
  return admin;
}
