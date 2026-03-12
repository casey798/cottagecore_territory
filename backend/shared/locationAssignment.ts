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

  const assignments: Record<string, unknown>[] = [];

  for (const user of allUsers) {
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
