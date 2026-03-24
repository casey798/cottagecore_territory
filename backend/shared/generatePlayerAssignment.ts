import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getItem, query, docClient, tableName } from './db';
import {
  DailyConfig,
  DailyConfigStatus,
  User,
  PlayerAssignment,
  LocationMasterConfig,
  ClusterWeightConfig,
  Phase1Cluster,
  GameSession,
} from './types';
import {
  buildAdjacencyMap,
  scoreLocationForUser,
  assignLocationsWithSpread,
} from './weightedAssignment';
import { ROTATION_HISTORY_WINDOW_DAYS } from './constants';

export type { PlayerAssignment };

// These match locationAssignment.ts fallback constants exactly
const FALLBACK_ASSIGNMENT_COUNT = 4;
const FALLBACK_COOP_CHANCE = 0.3;
const MAX_COOP_SLOTS_PER_PLAYER = 2;

function fallbackAssignLocs(activeLocationIds: string[], userId: string): string[] {
  const shuffled = [...activeLocationIds].sort(() => Math.random() - 0.5);
  const assigned = shuffled.slice(0, Math.min(FALLBACK_ASSIGNMENT_COUNT, shuffled.length));
  console.log(
    '[generatePlayerAssignment] fallback path — user', userId,
    'assigned', assigned.length, 'locations',
  );
  return assigned;
}

function fallbackCoopSlots(assignedLocs: string[]): string[] {
  const coopLocationIds: string[] = [];
  const coopSlotCount = Math.min(MAX_COOP_SLOTS_PER_PLAYER, assignedLocs.length);
  const shuffled = [...assignedLocs].sort(() => Math.random() - 0.5);
  for (const locId of shuffled) {
    if (Math.random() < FALLBACK_COOP_CHANCE && coopLocationIds.length < coopSlotCount) {
      coopLocationIds.push(locId);
    }
  }
  return coopLocationIds;
}

function isConditionalCheckFailed(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'name' in e &&
    (e as { name: string }).name === 'ConditionalCheckFailedException'
  );
}

/**
 * Generate and persist a PlayerAssignment for one player on one date.
 *
 * Uses the identical location-selection and co-op designation logic as
 * dailyReset.ts (weighted path when clusterConfig + locationConfigs are
 * available, simple random fallback otherwise).
 *
 * The DynamoDB write uses ConditionExpression: attribute_not_exists(dateUserId)
 * so concurrent calls are idempotent — the first write wins and subsequent
 * callers receive the record that already exists.
 *
 * Throws if:
 * - daily-config does not exist for the given date
 * - daily-config status is not 'active'
 * - no active locations are configured for the date
 * - user record is not found
 */
export async function generatePlayerAssignment(
  userId: string,
  date: string,
): Promise<PlayerAssignment> {
  // Read daily-config — must be active
  const dailyConfig = await getItem<DailyConfig>('daily-config', { date });
  if (!dailyConfig) {
    throw new Error(`No daily config found for date: ${date}`);
  }
  if (dailyConfig.status !== DailyConfigStatus.Active) {
    throw new Error(`Daily config for ${date} is not active (status: ${dailyConfig.status})`);
  }
  if (dailyConfig.activeLocationIds.length === 0) {
    throw new Error(`No active locations for date: ${date}`);
  }

  // Read user record
  const user = await getItem<User>('users', { userId });
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  let assignedLocs: string[];
  let coopLocationIds: string[] = [];

  const clusterConfig = await getItem<ClusterWeightConfig>('cluster-weight-config', {
    configId: 'current',
  });

  if (clusterConfig) {
    // Fetch LocationMasterConfigs for each active location
    const locationConfigs: LocationMasterConfig[] = [];
    for (const locId of dailyConfig.activeLocationIds) {
      const loc = await getItem<LocationMasterConfig>('location-master-config', {
        locationId: locId,
      });
      if (loc) locationConfigs.push(loc);
    }

    if (locationConfigs.length > 0) {
      const adjacencyMap = buildAdjacencyMap(locationConfigs);

      // Compute 3-day rotation window dates (identical to dailyReset.ts)
      const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
      const windowDates: string[] = [];
      for (let d = 0; d < ROTATION_HISTORY_WINDOW_DAYS; d++) {
        const windowDate = addDays(nowIST, -d);
        const y = windowDate.getFullYear();
        const m = String(windowDate.getMonth() + 1).padStart(2, '0');
        const day = String(windowDate.getDate()).padStart(2, '0');
        windowDates.push(`${y}-${m}-${day}`);
      }

      // Rotation history — per-user GetItem instead of full-table scan
      const rotationCounts = new Map<string, number>(); // locationId → times assigned in window
      const windowAssigned = new Set<string>();           // locationIds assigned on prior days

      for (const dateStr of windowDates) {
        const pa = await getItem<PlayerAssignment>('player-assignments', {
          dateUserId: `${dateStr}#${userId}`,
        });
        if (!pa) continue;
        for (const locId of pa.assignedLocationIds) {
          rotationCounts.set(locId, (rotationCounts.get(locId) ?? 0) + 1);
        }
        if (dateStr !== date) {
          for (const locId of pa.assignedLocationIds) {
            windowAssigned.add(locId);
          }
        }
      }

      // Session pairs for visit-response modifier — query via UserDateIndex GSI
      const sessionPairs = new Set<string>(); // `${userId}#${locationId}`
      for (const dateStr of windowDates) {
        const { items: sessions } = await query<GameSession>(
          'game-sessions',
          'userId = :uid AND #d = :date',
          { ':uid': userId, ':date': dateStr },
          { indexName: 'UserDateIndex', expressionNames: { '#d': 'date' } },
        );
        for (const s of sessions) {
          sessionPairs.add(`${userId}#${s.locationId}`);
        }
      }

      // Bad pairing sets
      const badPairingLocIds = new Map<Phase1Cluster, Set<string>>();
      for (const [cluster, locIds] of Object.entries(clusterConfig.badPairings)) {
        badPairingLocIds.set(cluster as Phase1Cluster, new Set(locIds));
      }

      const clusterKey: Phase1Cluster | 'null' =
        user.computedCluster ?? user.phase1Cluster ?? 'null';
      if (clusterConfig.assignmentCounts[clusterKey] === undefined) {
        console.warn(
          '[generatePlayerAssignment] no assignmentCount configured for cluster:',
          clusterKey, '— defaulting to 4',
        );
      }
      const assignmentCount = clusterConfig.assignmentCounts[clusterKey] ?? 4;
      const coopChance =
        clusterConfig.coopChances?.[clusterKey] ?? clusterConfig.coopChance ?? 0;

      // Score all locations
      const candidates: Array<{ locationId: string; score: number }> = [];
      for (const loc of locationConfigs) {
        const rotCount = rotationCounts.get(loc.locationId) ?? 0;
        const wasAssignedNeverPlayed =
          windowAssigned.has(loc.locationId) &&
          !sessionPairs.has(`${userId}#${loc.locationId}`);
        const score = scoreLocationForUser(
          user, loc, rotCount, wasAssignedNeverPlayed, clusterConfig, badPairingLocIds,
        );
        candidates.push({ locationId: loc.locationId, score });
      }

      assignedLocs = assignLocationsWithSpread(candidates, adjacencyMap, assignmentCount, userId);

      // Designate co-op slots from already-assigned locations (identical to dailyReset.ts)
      if (coopChance > 0) {
        const coopSlotCount = Math.min(MAX_COOP_SLOTS_PER_PLAYER, assignedLocs.length);
        const shuffled = [...assignedLocs].sort(() => Math.random() - 0.5);
        for (const locId of shuffled) {
          if (Math.random() < coopChance && coopLocationIds.length < coopSlotCount) {
            coopLocationIds.push(locId);
          }
        }
      }

      if (coopChance > 0 && coopLocationIds.length === 0) {
        console.warn(
          '[generatePlayerAssignment] coopChance is', coopChance,
          'for cluster', clusterKey,
          'but no co-op slots were designated for user', userId,
          '— assigned location count:', assignedLocs.length,
        );
      }

      if (coopLocationIds.some((id) => !assignedLocs.includes(id))) {
        console.error(
          '[generatePlayerAssignment] co-op location not in assigned set — clearing.',
          'user:', userId,
          'coopLocationIds:', coopLocationIds,
          'assignedLocs:', assignedLocs,
        );
        coopLocationIds = [];
      }
    } else {
      // No location master configs found — fallback to simple random
      assignedLocs = fallbackAssignLocs(dailyConfig.activeLocationIds, userId);
      coopLocationIds = fallbackCoopSlots(assignedLocs);
    }
  } else {
    // No cluster config — fallback to simple random
    assignedLocs = fallbackAssignLocs(dailyConfig.activeLocationIds, userId);
    coopLocationIds = fallbackCoopSlots(assignedLocs);
  }

  const dateUserId = `${date}#${userId}`;
  const record: PlayerAssignment = {
    dateUserId,
    assignedLocationIds: assignedLocs,
    coopLocationIds,
  };

  // Conditional put — first concurrent caller wins, subsequent callers read what already exists
  try {
    await docClient.send(
      new PutCommand({
        TableName: tableName('player-assignments'),
        Item: record as unknown as Record<string, unknown>,
        ConditionExpression: 'attribute_not_exists(dateUserId)',
      }),
    );
  } catch (e) {
    if (isConditionalCheckFailed(e)) {
      // A concurrent call already wrote the record — return that one
      const existing = await getItem<PlayerAssignment>('player-assignments', { dateUserId });
      if (existing) return existing;
    }
    throw e;
  }

  console.log(
    '[generatePlayerAssignment] created assignment for user', userId,
    'date', date,
    '— assigned', assignedLocs.length, 'locations,', coopLocationIds.length, 'co-op',
  );
  return record;
}
