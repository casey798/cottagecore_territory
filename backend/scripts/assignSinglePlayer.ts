/**
 * One-off script: generate player-assignment + space-assignment
 * for a single user on today's date.
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/assignSinglePlayer.ts
 */
import { generatePlayerAssignment } from '../shared/generatePlayerAssignment';
import { generateSpaceAssignment, getActiveSpaceIds } from '../shared/spaceAssignment';
import { getItem, deleteItem, scan } from '../shared/db';
import { getTodayISTString } from '../shared/time';
import { User } from '../shared/types';

const TARGET_EMAIL = 'karthikrajak@student.tce.edu';

async function main() {
  const today = getTodayISTString();
  console.log(`Date: ${today}`);

  // 1. Look up user by email (scan with filter — small table)
  const { items } = await scan<User>('users', {
    filterExpression: 'email = :email',
    expressionValues: { ':email': TARGET_EMAIL },
  });
  if (items.length === 0) {
    console.error(`User not found: ${TARGET_EMAIL}`);
    process.exit(1);
  }
  const user = items[0];
  console.log(`Found user: ${user.displayName ?? user.email} (${user.userId}), clan: ${user.clan}`);

  const dateUserId = `${today}#${user.userId}`;

  // 2. Delete existing player-assignment for today (if any) so we can regenerate
  try {
    await deleteItem('player-assignments', { dateUserId });
    console.log('Deleted existing player-assignment');
  } catch { /* didn't exist */ }

  // 3. Generate weighted player assignment (minigame locations)
  const pa = await generatePlayerAssignment(user.userId, today);
  console.log(`\nPlayer Assignment created:`);
  console.log(`  Locations (${pa.assignedLocationIds.length}):`, pa.assignedLocationIds);
  console.log(`  Co-op locations (${pa.coopLocationIds?.length ?? 0}):`, pa.coopLocationIds ?? []);

  // 4. Delete existing space-assignment for today (if any)
  try {
    await deleteItem('space-assignments', { dateUserId });
    console.log('\nDeleted existing space-assignment');
  } catch { /* didn't exist */ }

  // 5. Generate space assignment (decoration)
  const activeSpaceIds = await getActiveSpaceIds();
  console.log(`Active spaces: ${activeSpaceIds.length}`);
  if (activeSpaceIds.length > 0) {
    const sa = await generateSpaceAssignment(user.userId, today, activeSpaceIds);
    console.log(`Space Assignment created:`);
    console.log(`  Spaces (${sa.assignedSpaceIds.length}):`, sa.assignedSpaceIds);
  } else {
    console.log('No active spaces — skipping space assignment');
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
