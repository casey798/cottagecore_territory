/**
 * Bulk-set quietMode on daily-config for a range of dates.
 * Creates minimal daily-config entries for dates that don't have one yet.
 *
 * Usage:
 *   npx ts-node scripts/bulkQuietMode.ts 2026-04-03 2026-04-30
 *   npx ts-node scripts/bulkQuietMode.ts 2026-04-03 2026-04-30 --stage prod
 *   npx ts-node scripts/bulkQuietMode.ts 2026-04-03 2026-04-30 --dry-run
 */

import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const startDate = process.argv[2];
const endDate = process.argv[3];

if (
  !startDate || !endDate ||
  !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
  !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
) {
  console.error('Usage: npx ts-node scripts/bulkQuietMode.ts YYYY-MM-DD YYYY-MM-DD [--stage dev] [--dry-run]');
  process.exit(1);
}

const stage = process.argv.includes('--stage')
  ? process.argv[process.argv.indexOf('--stage') + 1] || 'dev'
  : 'dev';
const dryRun = process.argv.includes('--dry-run');

const tableName = `grovewars-${stage}-daily-config`;

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: 'ap-south-1' }),
  { marshallOptions: { removeUndefinedValues: true } },
);

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

async function run() {
  const dates = getDatesInRange(startDate, endDate);
  console.log(`Setting quietMode=true for ${dates.length} dates: ${dates[0]} → ${dates[dates.length - 1]}`);
  if (dryRun) console.log('(DRY RUN — no writes)');

  let updated = 0;
  let created = 0;

  for (const date of dates) {
    const existing = await client.send(
      new GetCommand({ TableName: tableName, Key: { date } }),
    );

    if (existing.Item) {
      if (existing.Item.quietMode === true) {
        console.log(`  ${date}: already quiet — skipping`);
        continue;
      }
      if (!dryRun) {
        await client.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { date },
            UpdateExpression: 'SET quietMode = :qm',
            ExpressionAttributeValues: { ':qm': true },
          }),
        );
      }
      console.log(`  ${date}: updated existing config → quietMode=true`);
      updated++;
    } else {
      // Create a minimal config so dailyReset/dailyScoring see quietMode=true
      if (!dryRun) {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              date,
              activeLocationIds: [],
              targetSpace: null,
              qrSecret: crypto.randomBytes(32).toString('hex'),
              winnerClan: null,
              status: 'active',
              quietMode: true,
            },
          }),
        );
      }
      console.log(`  ${date}: created new config with quietMode=true`);
      created++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Created: ${created}, Total: ${dates.length}`);
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
