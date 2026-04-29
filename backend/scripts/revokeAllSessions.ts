/**
 * One-time script: revoke Firebase refresh tokens for all users in DynamoDB.
 *
 * Usage:
 *   cd backend
 *   npx ts-node scripts/revokeAllSessions.ts
 *
 * Verification for a specific user:
 *   admin.auth().getUser(uid) — check tokensValidAfterTime updated to ~now
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import admin from 'firebase-admin';

const STAGE = process.env.STAGE || 'dev';
const REGION = 'ap-south-1';
const USERS_TABLE = `grovewars-${STAGE}-users`;
const SSM_PARAM_PATH = `/grovewars/${STAGE}/fcm-service-account`;

async function initFirebase(): Promise<void> {
  const ssm = new SSMClient({ region: REGION });
  const resp = await ssm.send(
    new GetParameterCommand({ Name: SSM_PARAM_PATH, WithDecryption: true }),
  );
  const raw = resp.Parameter?.Value;
  if (!raw) {
    throw new Error(`SSM parameter empty at ${SSM_PARAM_PATH}`);
  }
  const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'grovewars-b37da',
  });
  console.log('[init] Firebase Admin initialized');
}

async function getAllUserIds(): Promise<string[]> {
  const client = new DynamoDBClient({ region: REGION });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  const userIds: string[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        ProjectionExpression: 'userId',
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const item of result.Items ?? []) {
      if (item.userId) userIds.push(item.userId as string);
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return userIds;
}

async function main(): Promise<void> {
  console.log(`[revokeAllSessions] Stage: ${STAGE}`);
  console.log(`[revokeAllSessions] Users table: ${USERS_TABLE}`);

  await initFirebase();

  const userIds = await getAllUserIds();
  console.log(`[revokeAllSessions] Found ${userIds.length} users in DynamoDB`);

  if (userIds.length === 0) {
    console.log('[revokeAllSessions] No users to revoke. Done.');
    return;
  }

  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        await admin.auth().revokeRefreshTokens(userId);
        console.log(`  ✓ ${userId}`);
      } catch (err) {
        console.error(`  ✗ ${userId}: ${(err as Error).message}`);
        throw err;
      }
    }),
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log('');
  console.log(`[revokeAllSessions] Done. ${succeeded} succeeded, ${failed} failed out of ${userIds.length} total.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[revokeAllSessions] Fatal error:', err);
  process.exitCode = 1;
});
