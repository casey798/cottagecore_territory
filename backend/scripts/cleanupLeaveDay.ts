/**
 * Emergency cleanup for a leave day where quiet mode wasn't set before the 8 AM reset.
 *
 * What it does:
 *   1. Sets quietMode = true on the daily-config for the given date
 *   2. Deletes all space-assignments for that date (so they don't pollute rotation)
 *   3. Deletes all player-assignments for that date (unnecessary assignments)
 *
 * Usage:
 *   npx ts-node scripts/cleanupLeaveDay.ts 2026-03-28
 *   npx ts-node scripts/cleanupLeaveDay.ts 2026-03-28 --stage prod
 *   npx ts-node scripts/cleanupLeaveDay.ts 2026-03-28 --dry-run
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';

const date = process.argv[2];
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('Usage: npx ts-node scripts/cleanupLeaveDay.ts YYYY-MM-DD [--stage dev] [--dry-run]');
  process.exit(1);
}

const stage = process.argv.includes('--stage')
  ? process.argv[process.argv.indexOf('--stage') + 1]
  : 'dev';
const dryRun = process.argv.includes('--dry-run');

const client = new DynamoDBClient({ region: 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

function tableName(name: string): string {
  return `grovewars-${stage}-${name}`;
}

async function scanByPrefix(table: string, pkField: string, prefix: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: tableName(table),
      FilterExpression: `begins_with(${pkField}, :prefix)`,
      ExpressionAttributeValues: { ':prefix': prefix },
      ExclusiveStartKey: lastKey,
    }));
    if (result.Items) items.push(...result.Items);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function main() {
  const prefix = `${date}#`;
  console.log(`\n=== Leave Day Cleanup: ${date} (stage: ${stage}) ${dryRun ? '[DRY RUN]' : ''} ===\n`);

  // Step 1: Set quiet mode on daily-config
  console.log('Step 1: Setting quietMode on daily-config...');
  const configResult = await docClient.send(new GetCommand({
    TableName: tableName('daily-config'),
    Key: { date },
  }));
  if (!configResult.Item) {
    console.log('  No daily-config found — creating minimal config with quietMode');
    if (!dryRun) {
      const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
      await docClient.send(new PutCommand({
        TableName: tableName('daily-config'),
        Item: {
          date,
          activeLocationIds: [],
          targetSpace: { name: 'Leave Day', mapOverlayId: '', polygonPoints: [], gridCells: [] },
          qrSecret: '',
          winnerClan: null,
          status: 'active',
          quietMode: true,
        },
      }));
    }
    console.log('  Created daily-config with quietMode = true');
  } else if (configResult.Item.quietMode === true) {
    console.log('  quietMode already set');
  } else {
    if (!dryRun) {
      await docClient.send(new UpdateCommand({
        TableName: tableName('daily-config'),
        Key: { date },
        UpdateExpression: 'SET quietMode = :qm',
        ExpressionAttributeValues: { ':qm': true },
      }));
    }
    console.log('  quietMode set to true');
  }

  // Step 2: Delete space-assignments for today
  console.log('\nStep 2: Deleting space-assignments...');
  const spaceAssignments = await scanByPrefix('space-assignments', 'dateUserId', prefix);
  console.log(`  Found ${spaceAssignments.length} space-assignments`);
  if (!dryRun) {
    for (const item of spaceAssignments) {
      await docClient.send(new DeleteCommand({
        TableName: tableName('space-assignments'),
        Key: { dateUserId: item.dateUserId as string },
      }));
    }
  }
  console.log(`  ${dryRun ? 'Would delete' : 'Deleted'} ${spaceAssignments.length} space-assignments`);

  // Step 3: Delete player-assignments for today
  console.log('\nStep 3: Deleting player-assignments...');
  const playerAssignments = await scanByPrefix('player-assignments', 'dateUserId', prefix);
  console.log(`  Found ${playerAssignments.length} player-assignments`);
  if (!dryRun) {
    for (const item of playerAssignments) {
      await docClient.send(new DeleteCommand({
        TableName: tableName('player-assignments'),
        Key: { dateUserId: item.dateUserId as string },
      }));
    }
  }
  console.log(`  ${dryRun ? 'Would delete' : 'Deleted'} ${playerAssignments.length} player-assignments`);

  console.log(`\n=== Done${dryRun ? ' (dry run — no changes made)' : ''} ===\n`);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
