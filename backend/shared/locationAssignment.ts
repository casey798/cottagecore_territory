import { scan, batchWrite, getItem } from './db';
import { User, Location, PlayerAssignment } from './types';

/**
 * Assign 3-5 random locations from the active pool to every player for the given date.
 * Co-op locations get guaranteed slots (1-2) if present; remaining filled from solo pool.
 * Overwrites any existing assignments for that date.
 * Returns the number of players assigned.
 */
export async function assignLocationsForAllPlayers(
  date: string,
  activeLocationIds: string[],
): Promise<number> {
  if (activeLocationIds.length === 0) return 0;

  // Fetch full Location objects to read coopOnly flag
  const locationMap = new Map<string, Location>();
  for (const locId of activeLocationIds) {
    const loc = await getItem<Location>('locations', { locationId: locId });
    if (loc) locationMap.set(locId, loc);
  }

  const coopPool = activeLocationIds.filter((id) => locationMap.get(id)?.coopOnly === true);
  const soloPool = activeLocationIds.filter((id) => !locationMap.get(id)?.coopOnly);

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
    const totalCount = Math.floor(Math.random() * 2) + 5; // 5 or 6 locations

    const assigned: string[] = [];

    // Guarantee co-op slots if available
    if (coopPool.length > 0) {
      const coopCount = Math.min(coopPool.length >= 2 ? 2 : 1, coopPool.length);
      const shuffledCoop = [...coopPool].sort(() => Math.random() - 0.5);
      assigned.push(...shuffledCoop.slice(0, coopCount));
    }

    // Fill remaining from solo pool
    const remaining = totalCount - assigned.length;
    if (remaining > 0 && soloPool.length > 0) {
      const shuffledSolo = [...soloPool].sort(() => Math.random() - 0.5);
      assigned.push(...shuffledSolo.slice(0, Math.min(remaining, shuffledSolo.length)));
    }

    // Fisher-Yates shuffle the final combined list
    for (let i = assigned.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [assigned[i], assigned[j]] = [assigned[j], assigned[i]];
    }

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
