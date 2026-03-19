import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, scan, query, putItem } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import {
  DailyLocationPool,
  LocationMasterConfig,
  User,
  ClusterWeightConfig,
  PlayerAssignment,
  GameSession,
  Phase1Cluster,
  LocationClassification,
  ClusterWeights,
} from '../../shared/types';

// ── Haversine ────────────────────────────────────────────────────────

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Adjacency Map ────────────────────────────────────────────────────

const ADJACENCY_RADIUS_METERS = 15;

function buildAdjacencyMap(
  locations: LocationMasterConfig[]
): Record<string, string[]> {
  const adjacency: Record<string, string[]> = {};

  for (const loc of locations) {
    adjacency[loc.locationId] = [];

    if (loc.gpsLat === 0 && loc.gpsLng === 0) continue;

    for (const other of locations) {
      if (other.locationId === loc.locationId) continue;
      if (other.gpsLat === 0 && other.gpsLng === 0) continue;

      const dist = haversineDistance(
        loc.gpsLat, loc.gpsLng,
        other.gpsLat, other.gpsLng
      );
      if (dist <= ADJACENCY_RADIUS_METERS) {
        adjacency[loc.locationId].push(other.locationId);
      }
    }
  }

  return adjacency;
}

// ── Weighted Random Pick ─────────────────────────────────────────────

function weightedRandomPick(
  candidates: Array<{ locationId: string; score: number }>
): { locationId: string; score: number } {
  const totalWeight = candidates.reduce((sum, c) => sum + c.score, 0);
  let r = Math.random() * totalWeight;
  for (const c of candidates) {
    r -= c.score;
    if (r <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

// ── Spatial Spread Assignment ────────────────────────────────────────

function assignLocationsWithSpread(
  candidates: Array<{ locationId: string; score: number }>,
  adjacencyByLocationId: Record<string, string[]>,
  count: number
): string[] {
  const selected: string[] = [];
  let pool = [...candidates];

  while (selected.length < count && pool.length > 0) {
    const picked = weightedRandomPick(pool);
    selected.push(picked.locationId);

    const excluded = new Set([
      picked.locationId,
      ...(adjacencyByLocationId[picked.locationId] ?? []),
    ]);
    pool = pool.filter(c => !excluded.has(c.locationId));
  }

  // Fallback: pool exhausted before count reached
  if (selected.length < count) {
    const selectedSet = new Set(selected);
    const fallback = candidates
      .filter(c => !selectedSet.has(c.locationId))
      .sort((a, b) => b.score - a.score);
    while (selected.length < count && fallback.length > 0) {
      selected.push(fallback.shift()!.locationId);
    }
  }

  return selected;
}

// ── Paginated scan helper ────────────────────────────────────────────

async function scanAll<T>(table: string): Promise<T[]> {
  const all: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, { exclusiveStartKey: lastKey });
    all.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return all;
}

// ── Paginated query helper ───────────────────────────────────────────

async function queryAll<T>(
  table: string,
  keyConditionExpression: string,
  expressionValues: Record<string, unknown>,
  options?: { indexName?: string }
): Promise<T[]> {
  const all: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await query<T>(table, keyConditionExpression, expressionValues, {
      ...options,
      exclusiveStartKey: lastKey,
    });
    all.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return all;
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

    // 1. Read today's DailyLocationPool
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

    // Build lookup maps
    const locById = new Map<string, LocationMasterConfig>();
    const locIdByQrNumber = new Map<number, string>();
    for (const loc of locationConfigs) {
      locById.set(loc.locationId, loc);
      locIdByQrNumber.set(loc.qrNumber, loc.locationId);
    }

    // 3. Build adjacency map
    const adjacencyMap = buildAdjacencyMap(locationConfigs);

    // 4. Read all users (paginated)
    const allUsers = await scanAll<User>('users');

    // 5. Read ClusterWeightConfig
    const clusterConfig = await getItem<ClusterWeightConfig>('cluster-weight-config', { configId: 'current' });
    if (!clusterConfig) {
      return error(ErrorCode.NOT_FOUND, 'Cluster weight config not found. Run seed:cluster-weights first.', 404);
    }

    // 6. Read all existing PlayerAssignments this season (for rotation history)
    const allAssignments = await scanAll<PlayerAssignment>('player-assignments');

    // Build rotation counts: userId → locationId → count
    const rotationCounts = new Map<string, Map<string, number>>();
    for (const assignment of allAssignments) {
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

    // 7. Read all GameSessions (for visit-response modifier)
    //    Build set of userId#locationId pairs that have sessions
    const allSessions = await scanAll<GameSession>('game-sessions');
    const sessionPairs = new Set<string>();
    for (const session of allSessions) {
      sessionPairs.add(`${session.userId}#${session.locationId}`);
    }

    // Build set of locationIds each user was ever assigned
    const everAssigned = new Map<string, Set<string>>();
    for (const assignment of allAssignments) {
      const assignDate = assignment.dateUserId.split('#')[0];
      if (assignDate === today) continue; // Skip today's (being replaced)
      const userId = assignment.dateUserId.split('#')[1];
      if (!userId) continue;
      if (!everAssigned.has(userId)) {
        everAssigned.set(userId, new Set());
      }
      const userSet = everAssigned.get(userId)!;
      for (const locId of assignment.assignedLocationIds) {
        userSet.add(locId);
      }
    }

    // Build bad pairing locationId sets per cluster
    const badPairingLocIds = new Map<Phase1Cluster, Set<string>>();
    for (const [cluster, qrNumbers] of Object.entries(clusterConfig.badPairings)) {
      const locIds = new Set<string>();
      for (const idStr of qrNumbers) {
        // badPairings values are locationId strings (resolved from QR numbers at seed time)
        locIds.add(idStr);
      }
      badPairingLocIds.set(cluster as Phase1Cluster, locIds);
    }

    // 8. Process users in batches of 50
    const USER_BATCH_SIZE = 50;
    let assigned = 0;
    let failed = 0;

    for (let i = 0; i < allUsers.length; i += USER_BATCH_SIZE) {
      const batch = allUsers.slice(i, i + USER_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (user) => {
          const clusterKey: Phase1Cluster | 'null' = user.phase1Cluster ?? 'null';
          const weights: ClusterWeights = clusterConfig.weights[clusterKey]
            ?? clusterConfig.weights['null'];
          const assignmentCount = clusterConfig.assignmentCounts[clusterKey] ?? 4;

          const userRotation = rotationCounts.get(user.userId);
          const userEverAssigned = everAssigned.get(user.userId);
          const userBadPairings = clusterKey !== 'null'
            ? badPairingLocIds.get(clusterKey as Phase1Cluster)
            : undefined;

          // Score each candidate location
          const candidates: Array<{ locationId: string; score: number }> = [];
          const weightsUsed: Record<string, number> = {};

          for (const loc of locationConfigs) {
            const classification = loc.classification as keyof ClusterWeights;
            const baseWeight = weights[classification] ?? 1.0;

            // Rotation modifier
            const timesAssigned = userRotation?.get(loc.locationId) ?? 0;
            let rotationMod: number;
            if (timesAssigned === 0) rotationMod = 3.0;
            else if (timesAssigned === 1) rotationMod = 1.5;
            else if (timesAssigned === 2) rotationMod = 1.0;
            else rotationMod = 0.7;

            // Visit-response modifier
            let visitResponseMod = 1.0;
            if (
              userEverAssigned?.has(loc.locationId) &&
              !sessionPairs.has(`${user.userId}#${loc.locationId}`)
            ) {
              visitResponseMod = 0.5;
            }

            // Bad pairing modifier
            const badPairingMod =
              userBadPairings?.has(loc.locationId) ? 0.1 : 1.0;

            const finalScore = baseWeight * rotationMod * visitResponseMod * badPairingMod;
            candidates.push({ locationId: loc.locationId, score: finalScore });
            weightsUsed[loc.locationId] = finalScore;
          }

          // Assign with spatial spread
          const assignedLocations = assignLocationsWithSpread(
            candidates,
            adjacencyMap,
            assignmentCount
          );

          // Write PlayerAssignment
          const assignment: PlayerAssignment = {
            dateUserId: `${today}#${user.userId}`,
            assignedLocationIds: assignedLocations,
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

    console.log(`[deployAssignments] ${today}: assigned=${assigned}, failed=${failed}, total=${allUsers.length}`);

    return success({
      totalUsers: allUsers.length,
      assigned,
      failed,
      date: today,
    });
  } catch (err) {
    console.error('[deployAssignments] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to deploy assignments', 500);
  }
}
