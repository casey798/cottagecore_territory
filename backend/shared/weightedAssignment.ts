import type {
  User,
  LocationMasterConfig,
  ClusterWeightConfig,
  ClusterWeights,
  Phase1Cluster,
  PlayerAssignment,
} from './types';
import {
  ADJACENCY_EXCLUSION_RADIUS_METERS,
  ROTATION_MODIFIER_COUNT_0,
  ROTATION_MODIFIER_COUNT_1,
  ROTATION_MODIFIER_COUNT_2,
  ROTATION_MODIFIER_COUNT_3_PLUS,
} from './constants';

// ── Haversine ────────────────────────────────────────────────────────

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Adjacency Map ────────────────────────────────────────────────────

export function buildAdjacencyMap(
  locations: LocationMasterConfig[],
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
        other.gpsLat, other.gpsLng,
      );
      if (dist <= ADJACENCY_EXCLUSION_RADIUS_METERS) {
        adjacency[loc.locationId].push(other.locationId);
      }
    }
  }

  return adjacency;
}

// ── Weighted Random Pick ─────────────────────────────────────────────

function weightedRandomPick(
  candidates: Array<{ locationId: string; score: number }>,
): { locationId: string; score: number } {
  const totalWeight = candidates.reduce((sum, c) => sum + c.score, 0);
  let r = Math.random() * totalWeight;
  for (const c of candidates) {
    r -= c.score;
    if (r <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

// ── Score a single location for a user ──────────────────────────────

export function scoreLocationForUser(
  user: User,
  loc: LocationMasterConfig,
  rotationCount: number,
  wasAssignedNeverPlayed: boolean,
  clusterWeights: ClusterWeightConfig,
  badPairingLocIds: Map<Phase1Cluster, Set<string>>,
): number {
  // Cluster key: prefer computedCluster, fallback to phase1Cluster, then 'null'
  const clusterKey: Phase1Cluster | 'null' =
    user.computedCluster ?? user.phase1Cluster ?? 'null';

  const weights: ClusterWeights =
    clusterWeights.weights[clusterKey] ?? clusterWeights.weights['null'];

  const classification = loc.classification as keyof ClusterWeights;
  const baseWeight = weights[classification] ?? 1.0;

  // Rotation modifier — shallow stepped decay within 3-day window
  let rotationMod: number;
  if (rotationCount === 0) rotationMod = ROTATION_MODIFIER_COUNT_0;
  else if (rotationCount === 1) rotationMod = ROTATION_MODIFIER_COUNT_1;
  else if (rotationCount === 2) rotationMod = ROTATION_MODIFIER_COUNT_2;
  else rotationMod = ROTATION_MODIFIER_COUNT_3_PLUS;

  // Visit-response modifier
  const visitResponseMod = wasAssignedNeverPlayed ? 0.5 : 1.0;

  // Bad pairing modifier
  const userBadPairings =
    clusterKey !== 'null'
      ? badPairingLocIds.get(clusterKey as Phase1Cluster)
      : undefined;
  const badPairingMod = userBadPairings?.has(loc.locationId) ? 0.1 : 1.0;

  return baseWeight * rotationMod * visitResponseMod * badPairingMod;
}

// ── Assign locations with spatial spread ─────────────────────────────

export function assignLocationsWithSpread(
  candidates: Array<{ locationId: string; score: number }>,
  adjacencyByLocationId: Record<string, string[]>,
  count: number,
  userId?: string,
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
    pool = pool.filter((c) => !excluded.has(c.locationId));
  }

  // Fallback: pool exhausted before count reached
  if (selected.length < count) {
    const selectedSet = new Set(selected);

    // Collect all adjacent locationIds of already-selected locations
    const allAdjacentToSelected = new Set<string>();
    for (const selId of selected) {
      for (const adjId of (adjacencyByLocationId[selId] ?? [])) {
        allAdjacentToSelected.add(adjId);
      }
    }

    // Step 1: Try non-adjacent unselected candidates (weighted random)
    const nonAdjacentFallback = candidates.filter(
      (c) => !selectedSet.has(c.locationId) && !allAdjacentToSelected.has(c.locationId),
    );

    while (selected.length < count && nonAdjacentFallback.length > 0) {
      const picked = weightedRandomPick(nonAdjacentFallback);
      selected.push(picked.locationId);
      selectedSet.add(picked.locationId);

      // Update adjacency exclusions for next iteration
      for (const adjId of (adjacencyByLocationId[picked.locationId] ?? [])) {
        allAdjacentToSelected.add(adjId);
      }

      // Remove picked and newly-adjacent from fallback pool
      const newExcluded = new Set([
        picked.locationId,
        ...(adjacencyByLocationId[picked.locationId] ?? []),
      ]);
      const idx = nonAdjacentFallback.findIndex((c) => c.locationId === picked.locationId);
      if (idx >= 0) nonAdjacentFallback.splice(idx, 1);
      for (let i = nonAdjacentFallback.length - 1; i >= 0; i--) {
        if (newExcluded.has(nonAdjacentFallback[i].locationId)) {
          nonAdjacentFallback.splice(i, 1);
        }
      }
    }

    // Step 2: Last resort — no valid non-adjacent candidate exists.
    // Pick highest-scoring remaining candidate regardless of adjacency.
    if (selected.length < count) {
      const lastResort = candidates
        .filter((c) => !selectedSet.has(c.locationId))
        .sort((a, b) => b.score - a.score);

      while (selected.length < count && lastResort.length > 0) {
        const picked = lastResort.shift()!;
        console.warn(
          `[assignLocationsWithSpread] Last resort adjacency override: ` +
          `user=${userId ?? 'unknown'} picked=${picked.locationId} ` +
          `adjacent to already-selected=[${selected.filter(
            (s) => (adjacencyByLocationId[s] ?? []).includes(picked.locationId) ||
                   (adjacencyByLocationId[picked.locationId] ?? []).includes(s),
          ).join(',')}]`,
        );
        selected.push(picked.locationId);
        selectedSet.add(picked.locationId);
      }
    }
  }

  return selected;
}

// ── Co-op Slot Injection ────────────────────────────────────────────

const MAX_COOP_SLOTS_PER_PLAYER = 2;

/**
 * @deprecated Co-op slots are now designated post-assignment in dailyReset.ts.
 * Retained for the fallback path in locationAssignment.ts.
 *
 * After the normal weighted assignment, optionally replace one solo slot
 * with a co-op location. Returns a new array (does not mutate input).
 *
 * @param assignedIds - the locations already assigned by weighted selection
 * @param coopPool - locationIds where coopOnly === true
 * @param coopChance - probability 0.0–1.0 to trigger a co-op swap
 * @param coopCountSoFar - how many co-op slots this user already has today
 * @param maxTotal - maximum total assignment count (default 4)
 * @returns { assignedIds: string[]; coopCount: number }
 */
export function injectCoopSlots(
  assignedIds: string[],
  coopPool: string[],
  coopChance: number,
  coopCountSoFar: number,
  maxTotal: number,
): { assignedIds: string[]; coopCount: number } {
  let coopCount = coopCountSoFar;

  if (
    coopChance <= 0 ||
    coopPool.length === 0 ||
    coopCount >= MAX_COOP_SLOTS_PER_PLAYER
  ) {
    return { assignedIds: [...assignedIds], coopCount };
  }

  if (Math.random() >= coopChance) {
    return { assignedIds: [...assignedIds], coopCount };
  }

  // Pick a random co-op location not already in the assignment
  const assignedSet = new Set(assignedIds);
  const available = coopPool.filter((id) => !assignedSet.has(id));
  if (available.length === 0) {
    return { assignedIds: [...assignedIds], coopCount };
  }

  const picked = available[Math.floor(Math.random() * available.length)];
  const result = [...assignedIds];

  if (result.length >= maxTotal) {
    // Replace the last solo slot
    result[result.length - 1] = picked;
  } else {
    result.push(picked);
  }

  coopCount++;
  return { assignedIds: result, coopCount };
}
