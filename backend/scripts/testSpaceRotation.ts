/**
 * Test space assignment rotation over 4 days for a single user.
 *
 * Usage:
 *   npx ts-node scripts/testSpaceRotation.ts --userId <userId> [--stage dev]
 *
 * What it does:
 *   1. Fetches active spaces from the spaces table.
 *   2. Deletes any existing space-assignments for the test dates.
 *   3. Calls generateSpaceAssignment for 4 consecutive fake dates.
 *   4. Prints the assigned spaces per day and verifies full coverage.
 *   5. Cleans up the test records.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const args = process.argv.slice(2);
const stage = args.includes('--stage') ? args[args.indexOf('--stage') + 1] : 'dev';
const userId = args.includes('--userId') ? args[args.indexOf('--userId') + 1] : null;

if (!userId) {
  console.error('Usage: npx ts-node scripts/testSpaceRotation.ts --userId <userId> [--stage dev]');
  process.exit(1);
}

// Set env vars before importing shared modules
process.env.STAGE = stage;
process.env.AWS_REGION = 'ap-south-1';

const client = new DynamoDBClient({ region: 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE = `grovewars-${stage}-space-assignments`;
const SPACES_TABLE = `grovewars-${stage}-spaces`;

// Use fake dates far in the future to avoid colliding with real data
const TEST_DATES = ['2099-01-01', '2099-01-02', '2099-01-03', '2099-01-04'];

async function getActiveSpaces(): Promise<Array<{ spaceId: string; name: string }>> {
  const spaces: Array<{ spaceId: string; name: string }> = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: SPACES_TABLE,
      FilterExpression: 'active = :t',
      ExpressionAttributeValues: { ':t': true },
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));
    for (const item of (result.Items ?? [])) {
      spaces.push({ spaceId: item.spaceId as string, name: item.name as string });
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return spaces;
}

async function deleteTestRecords() {
  for (const date of TEST_DATES) {
    const key = `${date}#${userId}`;
    await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { dateUserId: key } })).catch(() => {});
  }
}

async function main() {
  console.log(`\n=== Space Rotation Test ===`);
  console.log(`User: ${userId}`);
  console.log(`Stage: ${stage}\n`);

  const spaces = await getActiveSpaces();
  console.log(`Active spaces (${spaces.length}):`);
  for (const s of spaces) {
    console.log(`  ${s.spaceId.slice(0, 8)}... ${s.name}`);
  }
  const spacesPerDay = Math.ceil(spaces.length / 4);
  console.log(`\nSpaces per day: ${spacesPerDay}`);
  console.log(`Expected full coverage in: 4 days\n`);

  if (spaces.length === 0) {
    console.error('No active spaces found! Create spaces first.');
    process.exit(1);
  }

  // Clean up any existing test records
  await deleteTestRecords();

  // Import the shared module (after env vars are set)
  const { generateSpaceAssignment } = await import('../shared/spaceAssignment');
  const activeSpaceIds = spaces.map(s => s.spaceId);

  const allAssigned: string[][] = [];
  const seenAll = new Set<string>();

  for (let day = 0; day < 4; day++) {
    const date = TEST_DATES[day];
    const assignment = await generateSpaceAssignment(userId!, date, activeSpaceIds);
    allAssigned.push(assignment.assignedSpaceIds);

    const names = assignment.assignedSpaceIds.map(id => {
      const s = spaces.find(sp => sp.spaceId === id);
      return s ? s.name : id.slice(0, 8);
    });

    for (const id of assignment.assignedSpaceIds) seenAll.add(id);

    console.log(`Day ${day + 1} (${date}): [${names.join(', ')}]`);
  }

  // Verify coverage
  console.log(`\n--- Verification ---`);
  console.log(`Total unique spaces assigned: ${seenAll.size} / ${spaces.length}`);

  const missing = spaces.filter(s => !seenAll.has(s.spaceId));
  if (missing.length === 0) {
    console.log(`✓ Full coverage — all ${spaces.length} spaces assigned exactly once across 4 days`);
  } else {
    console.log(`✗ Missing ${missing.length} spaces:`);
    for (const m of missing) console.log(`  ${m.name}`);
  }

  // Check for duplicates
  const allIds = allAssigned.flat();
  const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
  if (dupes.length === 0) {
    console.log(`✓ No duplicates across 4 days`);
  } else {
    console.log(`✗ Duplicates found: ${dupes.length}`);
  }

  // Clean up
  await deleteTestRecords();
  console.log(`\nTest records cleaned up.\n`);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
