import { SSMClient, GetParameterCommand, ParameterNotFound } from '@aws-sdk/client-ssm';
import admin from 'firebase-admin';

const STAGE = process.env.STAGE || 'dev';
const PARAM_PATH = `/grovewars/${STAGE}/fcm-service-account`;

async function main(): Promise<void> {
  console.log(`[verifyFCM] Stage: ${STAGE}`);
  console.log(`[verifyFCM] SSM path: ${PARAM_PATH}`);

  // 1. Read service account JSON from SSM
  let raw: string;
  try {
    const ssm = new SSMClient({ region: 'ap-south-1' });
    const resp = await ssm.send(
      new GetParameterCommand({ Name: PARAM_PATH, WithDecryption: true }),
    );
    raw = resp.Parameter?.Value ?? '';
    if (!raw) {
      console.error('[FAIL] SSM parameter exists but value is empty.');
      process.exit(1);
    }
    console.log('[OK] SSM parameter retrieved.');
  } catch (err: unknown) {
    if (err instanceof ParameterNotFound) {
      console.error(`[FAIL] SSM parameter not found at ${PARAM_PATH}`);
      console.error('       Create it with: aws ssm put-parameter --name', PARAM_PATH,
        '--type SecureString --value \'<service-account-json>\'');
    } else if (err instanceof Error && err.name === 'ParameterNotFound') {
      console.error(`[FAIL] SSM parameter not found at ${PARAM_PATH}`);
    } else {
      console.error('[FAIL] Unexpected SSM error:', err);
    }
    process.exit(1);
  }

  // 2. Parse JSON
  let serviceAccount: { project_id?: string; client_email?: string };
  try {
    serviceAccount = JSON.parse(raw);
    console.log(`[OK] JSON parsed — project_id: ${serviceAccount.project_id}, client_email: ${serviceAccount.client_email}`);
  } catch {
    console.error('[FAIL] SSM value is not valid JSON. First 200 chars:', raw.slice(0, 200));
    process.exit(1);
  }

  // 3. Initialize Firebase Admin
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  }, 'verify-fcm-script');

  // 4. Dry-run FCM send
  try {
    await admin.messaging(app).send(
      {
        token: 'test-token-verification',
        notification: { title: 'FCM Verification', body: 'dry-run' },
      },
      true, // dryRun / validate_only
    );
    console.log('[OK] FCM dry-run succeeded — credentials are VALID.');
    console.log(`     project_id:   ${serviceAccount.project_id}`);
    console.log(`     client_email: ${serviceAccount.client_email}`);
  } catch (err: unknown) {
    const fcmErr = err as { code?: string; message?: string };

    if (
      fcmErr.message?.includes('invalid_grant') ||
      fcmErr.message?.includes('invalid credentials') ||
      fcmErr.message?.includes('Invalid JWT') ||
      fcmErr.code === 'app/invalid-credential'
    ) {
      console.error('[FAIL] Firebase auth error — service account key is stale or revoked.');
      console.error('       Detail:', fcmErr.message);
      process.exit(1);
    }

    // messaging/invalid-argument for a bad token is EXPECTED on dry-run with a dummy token
    // It means auth succeeded but the token is (obviously) invalid
    if (fcmErr.code === 'messaging/invalid-argument' || fcmErr.code === 'messaging/registration-token-not-registered') {
      console.log('[OK] FCM dry-run auth succeeded (token rejected as expected) — credentials are VALID.');
      console.log(`     project_id:   ${serviceAccount.project_id}`);
      console.log(`     client_email: ${serviceAccount.client_email}`);
    } else {
      console.error('[FAIL] Unexpected FCM error:', fcmErr.code, fcmErr.message);
      process.exit(1);
    }
  } finally {
    await app.delete();
  }
}

main();
