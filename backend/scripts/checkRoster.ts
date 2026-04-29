import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const stage = process.argv.includes('--stage')
  ? process.argv[process.argv.indexOf('--stage') + 1]
  : 'dev';

const client = new DynamoDBClient({ region: 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

interface RosterEntry {
  email: string;
  name?: string;
  [key: string]: unknown;
}

interface UserEntry {
  userId: string;
  email?: string;
  clan?: string;
  displayName?: string;
  [key: string]: unknown;
}

async function scanAll<T>(tableName: string): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...((result.Items ?? []) as T[]));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return items;
}

async function main() {
  const rosterTable = `grovewars-${stage}-roster`;
  const usersTable = `grovewars-${stage}-users`;

  console.log(`\n=== GroveWars Roster Check (${stage}) ===\n`);

  // 1. Scan both tables
  const roster = await scanAll<RosterEntry>(rosterTable);
  const users = await scanAll<UserEntry>(usersTable);

  console.log(`Roster entries:  ${roster.length}`);
  console.log(`User records:    ${users.length}`);

  // Build lookup by email
  const usersByEmail = new Map<string, UserEntry>();
  for (const u of users) {
    if (u.email) usersByEmail.set(u.email.toLowerCase(), u);
  }

  // 2. Roster → user match
  let matchedCount = 0;
  const unmatchedRoster: string[] = [];
  for (const r of roster) {
    if (usersByEmail.has(r.email.toLowerCase())) {
      matchedCount++;
    } else {
      unmatchedRoster.push(r.email);
    }
  }

  console.log(`\nRoster with user record:    ${matchedCount}`);
  console.log(`Roster without user record: ${unmatchedRoster.length}`);

  // 3. Clan stats
  const CLANS = ['ember', 'tide', 'bloom', 'gale', 'hearth'] as const;
  const clanCounts: Record<string, number> = {};
  for (const c of CLANS) clanCounts[c] = 0;

  const withClan: UserEntry[] = [];
  const missingClan: UserEntry[] = [];

  for (const u of users) {
    if (u.clan && CLANS.includes(u.clan as typeof CLANS[number])) {
      clanCounts[u.clan]++;
      withClan.push(u);
    } else {
      missingClan.push(u);
    }
  }

  console.log(`\nUsers with clan:    ${withClan.length}`);
  console.log(`Users missing clan: ${missingClan.length}`);

  console.log(`\n── Clan Distribution ──`);
  for (const c of CLANS) {
    const bar = '█'.repeat(Math.ceil(clanCounts[c] / 2));
    console.log(`  ${c.padEnd(8)} ${String(clanCounts[c]).padStart(3)}  ${bar}`);
  }
  console.log(`  ${'total'.padEnd(8)} ${String(withClan.length).padStart(3)}`);

  // 4. List users with missing clan
  if (missingClan.length > 0) {
    console.log(`\n── Users Missing Clan ──`);
    for (const u of missingClan) {
      const clan = u.clan ? `"${u.clan}"` : '(empty)';
      console.log(`  ${(u.email ?? u.userId).padEnd(40)} clan=${clan}  name=${u.displayName ?? '(none)'}`);
    }
  }

  // 5. Roster entries with no signup
  if (unmatchedRoster.length > 0 && unmatchedRoster.length <= 30) {
    console.log(`\n── Roster Without Signup ──`);
    for (const email of unmatchedRoster) {
      console.log(`  ${email}`);
    }
  } else if (unmatchedRoster.length > 30) {
    console.log(`\n── Roster Without Signup (showing first 30 of ${unmatchedRoster.length}) ──`);
    for (const email of unmatchedRoster.slice(0, 30)) {
      console.log(`  ${email}`);
    }
  }

  console.log('');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
