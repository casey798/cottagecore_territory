import { scan, batchWrite } from './db';
import { User, PlayerAssignment } from './types';

/**
 * Assign 3-5 random locations from the active pool to every player for the given date.
 * Overwrites any existing assignments for that date.
 * Returns the number of players assigned.
 */
export async function assignLocationsForAllPlayers(
  date: string,
  activeLocationIds: string[],
): Promise<number> {
  if (activeLocationIds.length === 0) return 0;

  // Scan all users
  const allUsers: User[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<User>('users', { exclusiveStartKey: lastKey });
    allUsers.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  if (allUsers.length === 0) return 0;

  // Skip users whose userId looks like a UUID (not yet migrated to Firebase UID).
  // Firebase UIDs are 28-char alphanumeric; UUIDs are 36-char with dashes (8-4-4-4-12).
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const eligibleUsers = allUsers.filter((u) => !UUID_PATTERN.test(u.userId));
  const skipped = allUsers.length - eligibleUsers.length;
  if (skipped > 0) {
    console.log(`Skipped ${skipped} users with non-Firebase userId (not yet migrated)`);
  }

  const assignments: Record<string, unknown>[] = [];

  for (const user of eligibleUsers) {
    const count = Math.floor(Math.random() * 3) + 3; // 3-5 locations
    const shuffled = [...activeLocationIds].sort(() => Math.random() - 0.5);
    const assigned = shuffled.slice(0, Math.min(count, shuffled.length));

    const assignment: PlayerAssignment = {
      dateUserId: `${date}#${user.userId}`,
      assignedLocationIds: assigned,
    };
    assignments.push(assignment as unknown as Record<string, unknown>);
  }

  if (assignments.length > 0) {
    await batchWrite('player-assignments', assignments);
  }

  return assignments.length;
}
