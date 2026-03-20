import { scan, batchWrite } from './db';
import { User, PlayerAssignment } from './types';

const FALLBACK_COOP_CHANCE = 0.3;
const FALLBACK_ASSIGNMENT_COUNT = 4;
const MAX_COOP_SLOTS_PER_PLAYER = 2;

/**
 * Assign random locations from the active pool to every player for the given date.
 * After solo assignment, randomly designates some assigned locations as co-op
 * based on FALLBACK_COOP_CHANCE (30% per slot, max 2).
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
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const eligibleUsers = allUsers.filter((u) => !UUID_PATTERN.test(u.userId));
  const skipped = allUsers.length - eligibleUsers.length;
  if (skipped > 0) {
    console.log(`Skipped ${skipped} users with non-Firebase userId (not yet migrated)`);
  }

  const assignments: Record<string, unknown>[] = [];

  for (const user of eligibleUsers) {
    const shuffled = [...activeLocationIds].sort(() => Math.random() - 0.5);
    const assigned = shuffled.slice(0, Math.min(FALLBACK_ASSIGNMENT_COUNT, shuffled.length));

    // Designate co-op slots from already-assigned locations
    const coopLocationIds: string[] = [];
    if (FALLBACK_COOP_CHANCE > 0) {
      const coopSlotCount = Math.min(MAX_COOP_SLOTS_PER_PLAYER, assigned.length);
      const coopShuffled = [...assigned].sort(() => Math.random() - 0.5);
      for (const locId of coopShuffled) {
        if (Math.random() < FALLBACK_COOP_CHANCE && coopLocationIds.length < coopSlotCount) {
          coopLocationIds.push(locId);
        }
      }
    }

    console.log('[locationAssignment] fallback path — user', user.userId, 'assigned', assigned.length, 'locations,', coopLocationIds.length, 'designated co-op');
    if (FALLBACK_COOP_CHANCE > 0 && coopLocationIds.length === 0) {
      console.warn('[locationAssignment] FALLBACK_COOP_CHANCE is', FALLBACK_COOP_CHANCE, 'but no co-op slots designated for user', user.userId);
    }

    const assignment: PlayerAssignment = {
      dateUserId: `${date}#${user.userId}`,
      assignedLocationIds: assigned,
      coopLocationIds,
    };
    assignments.push(assignment as unknown as Record<string, unknown>);
  }

  if (assignments.length > 0) {
    await batchWrite('player-assignments', assignments);
  }

  return assignments.length;
}
