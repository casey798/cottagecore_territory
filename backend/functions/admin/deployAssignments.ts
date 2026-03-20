import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, scan, query, putItem } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import {
  buildAdjacencyMap,
  scoreLocationForUser,
  assignLocationsWithSpread,
} from '../../shared/weightedAssignment';
import { ROTATION_HISTORY_WINDOW_DAYS } from '../../shared/constants';
import {
  DailyLocationPool,
  LocationMasterConfig,
  User,
  ClusterWeightConfig,
  PlayerAssignment,
  GameSession,
  Phase1Cluster,
} from '../../shared/types';
import { isQuietModeActive } from '../../shared/quietMode';
import { addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// ── Paginated helpers ────────────────────────────────────────────────

async function scanAll<T>(table: string, options?: Parameters<typeof scan>[1]): Promise<T[]> {
  const all: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, { ...options, exclusiveStartKey: lastKey });
    all.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return all;
}

async function queryAll<T>(
  table: string,
  keyCondition: string,
  values: Record<string, unknown>,
  options?: { indexName?: string; filterExpression?: string; expressionNames?: Record<string, string> },
): Promise<T[]> {
  const all: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await query<T>(table, keyCondition, values, {
      ...options,
      exclusiveStartKey: lastKey,
    });
    all.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return all;
}

// ── Compute window dates ─────────────────────────────────────────────

function getWindowDates(today: string): string[] {
  const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
  const dates: string[] = [];
  for (let d = 0; d < ROTATION_HISTORY_WINDOW_DAYS; d++) {
    const date = addDays(nowIST, -d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

// ── Handler ──────────────────────────────────────────────────────────

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const today = getTodayISTString();
    const windowDates = getWindowDates(today);
    const windowDateSet = new Set(windowDates);

    // 1. Read today's config
    const pool = await getItem<DailyLocationPool>('daily-config', { date: today });
    if (!pool) {
      return error(ErrorCode.NOT_FOUND, 'No daily config found for today', 404);
    }
    if (!pool.activeLocationIds || pool.activeLocationIds.length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'No active locations in today\'s config', 400);
    }

    // 2. Read LocationMasterConfig for active locations
    const locationConfigs: LocationMasterConfig[] = [];
    for (const locId of pool.activeLocationIds) {
      const loc = await getItem<LocationMasterConfig>('location-master-config', { locationId: locId });
      if (loc) locationConfigs.push(loc);
    }

    if (locationConfigs.length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'No location master configs found for active locations', 400);
    }

    // 3. Build adjacency map
    const adjacencyMap = buildAdjacencyMap(locationConfigs);

    // 4. Read all users
    const allUsers = await scanAll<User>('users');

    // 5. Read ClusterWeightConfig
    const clusterConfig = await getItem<ClusterWeightConfig>('cluster-weight-config', { configId: 'current' });
    if (!clusterConfig) {
      return error(ErrorCode.NOT_FOUND, 'Cluster weight config not found. Run seed:cluster-weights first.', 404);
    }

    // 6. Read player-assignments within the 3-day window only
    // player-assignments PK is dateUserId (YYYY-MM-DD#userId), hash key only.
    // Scan with FilterExpression on begins_with for each window date.
    const windowAssignments: PlayerAssignment[] = [];
    for (const dateStr of windowDates) {
      const dateAssignments = await scanAll<PlayerAssignment>('player-assignments', {
        filterExpression: 'begins_with(dateUserId, :prefix)',
        expressionValues: { ':prefix': `${dateStr}#` },
      });
      windowAssignments.push(...dateAssignments);
    }

    // Build rotation counts: userId → locationId → count (within window only)
    const rotationCounts = new Map<string, Map<string, number>>();
    for (const assignment of windowAssignments) {
      const userId = assignment.dateUserId.split('#')[1];
      if (!userId) continue;
      if (!rotationCounts.has(userId)) {
        rotationCounts.set(userId, new Map());
      }
      const userMap = rotationCounts.get(userId)!;
      for (const locId of assignment.assignedLocationIds) {
        userMap.set(locId, (userMap.get(locId) || 0) + 1);
      }
    }

    // 7. Read game-sessions within the 3-day window (for visit-response modifier)
    // Use UserDateIndex GSI: query per user with date >= windowStart
    // More efficient approach: scan with filter on date field for the window dates
    const windowSessions: GameSession[] = [];
    for (const dateStr of windowDates) {
      const dateSessions = await scanAll<GameSession>('game-sessions', {
        filterExpression: '#d = :dateVal',
        expressionValues: { ':dateVal': dateStr },
        expressionNames: { '#d': 'date' },
      });
      windowSessions.push(...dateSessions);
    }

    // Build session pairs within window: userId#locationId → played
    const sessionPairs = new Set<string>();
    for (const session of windowSessions) {
      sessionPairs.add(`${session.userId}#${session.locationId}`);
    }

    // Build set of locationIds each user was assigned in window (excluding today)
    const windowAssigned = new Map<string, Set<string>>();
    for (const assignment of windowAssignments) {
      const [assignDate, userId] = assignment.dateUserId.split('#');
      if (!userId || assignDate === today) continue;
      if (!windowAssigned.has(userId)) {
        windowAssigned.set(userId, new Set());
      }
      for (const locId of assignment.assignedLocationIds) {
        windowAssigned.get(userId)!.add(locId);
      }
    }

    // Build bad pairing locationId sets per cluster
    const badPairingLocIds = new Map<Phase1Cluster, Set<string>>();
    for (const [cluster, locIds] of Object.entries(clusterConfig.badPairings)) {
      badPairingLocIds.set(cluster as Phase1Cluster, new Set(locIds));
    }

    // 8. Process users in batches of 50
    const MAX_COOP_SLOTS_PER_PLAYER = 2;
    const USER_BATCH_SIZE = 50;
    let assigned = 0;
    let failed = 0;

    for (let i = 0; i < allUsers.length; i += USER_BATCH_SIZE) {
      const batch = allUsers.slice(i, i + USER_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (user) => {
          const clusterKey: Phase1Cluster | 'null' =
            user.computedCluster ?? user.phase1Cluster ?? 'null';
          const assignmentCount = clusterConfig.assignmentCounts[clusterKey] ?? 4;
          const coopChance = clusterConfig.coopChances?.[clusterKey]
            ?? clusterConfig.coopChance ?? 0;

          const userRotation = rotationCounts.get(user.userId);
          const userWindowAssigned = windowAssigned.get(user.userId);

          // Score each candidate location
          const candidates: Array<{ locationId: string; score: number }> = [];
          const weightsUsed: Record<string, number> = {};

          for (const loc of locationConfigs) {
            const rotationCount = userRotation?.get(loc.locationId) ?? 0;
            // Visit-response: assigned in window but never played in window
            const wasAssignedNeverPlayed =
              (userWindowAssigned?.has(loc.locationId) ?? false) &&
              !sessionPairs.has(`${user.userId}#${loc.locationId}`);

            const finalScore = scoreLocationForUser(
              user,
              loc,
              rotationCount,
              wasAssignedNeverPlayed,
              clusterConfig,
              badPairingLocIds,
            );

            candidates.push({ locationId: loc.locationId, score: finalScore });
            weightsUsed[loc.locationId] = finalScore;
          }

          // Assign with spatial spread
          const assignedLocations = assignLocationsWithSpread(
            candidates,
            adjacencyMap,
            assignmentCount,
            user.userId,
          );

          // Designate co-op slots from already-assigned locations
          const coopLocationIds: string[] = [];
          if (coopChance > 0 && assignedLocations.length > 0) {
            const shuffled = [...assignedLocations].sort(() => Math.random() - 0.5);
            for (const locId of shuffled) {
              if (coopLocationIds.length >= MAX_COOP_SLOTS_PER_PLAYER) break;
              if (Math.random() < coopChance) {
                coopLocationIds.push(locId);
              }
            }
          }

          if (coopChance > 0 && coopLocationIds.length === 0) {
            console.warn('[deployAssignments] coopChance is', coopChance, 'for cluster', clusterKey, 'but no co-op slots designated for user', user.userId);
          }

          // Write PlayerAssignment
          const assignment: PlayerAssignment = {
            dateUserId: `${today}#${user.userId}`,
            assignedLocationIds: assignedLocations,
            coopLocationIds,
            weightsUsed,
          };

          await putItem('player-assignments', assignment as unknown as Record<string, unknown>);
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          assigned++;
        } else {
          failed++;
          console.error('[deployAssignments] User assignment failed:', result.reason);
        }
      }
    }

    const quietActive = await isQuietModeActive();
    console.log(`[deployAssignments] ${today}: assigned=${assigned}, failed=${failed}, total=${allUsers.length}, window=${ROTATION_HISTORY_WINDOW_DAYS}d, quietMode=${quietActive}`);

    return success({
      totalUsers: allUsers.length,
      assigned,
      failed,
      date: today,
      ...(quietActive ? {
        quietModeWarning: true,
        message: 'Assignments deployed but quiet mode is active — players cannot scan until quiet mode is disabled',
      } : {}),
    });
  } catch (err) {
    console.error('[deployAssignments] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to deploy assignments', 500);
  }
}
