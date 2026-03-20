import type { PlayerFeatureVector, ClusteringResult, Phase1Cluster } from './types';

const K = 5;
const MAX_ITERATIONS = 100;
const CONVERGENCE_THRESHOLD = 0.001;
const NUM_FEATURES = 14;

// Feature indices for label mapping (operates on NORMALIZED vectors)
const IDX_VISITS = 0;
const IDX_AVG_DURATION = 1;
const IDX_AVG_SATISFACTION = 2;
const IDX_UNIQUE_SPACES = 3;
// const IDX_SPACE_DIVERSITY = 4;
// const IDX_PCT_MORNING = 5;
const IDX_PCT_HE_SOCIAL = 6;
// const IDX_PCT_HE_PERSONAL = 7;
const IDX_PCT_LE_SOCIAL = 8;
const IDX_PCT_LE_PERSONAL = 9;
const IDX_PCT_SOCIAL_HUB = 10;
const IDX_PCT_TRANSIT = 11;
const IDX_PCT_HIDDEN_GEM = 12;
const IDX_PCT_DEAD_ZONE = 13;

// ── Feature extraction from PlayerFeatureVector to number[] ─────────

function toFeatureArray(p: PlayerFeatureVector): number[] {
  return [
    p.visits,
    p.avg_duration,
    p.avg_satisfaction,
    p.unique_spaces,
    p.space_diversity,
    p.pct_morning,
    p.pct_he_social,
    p.pct_he_personal,
    p.pct_le_social,
    p.pct_le_personal,
    p.pct_social_hub,
    p.pct_transit,
    p.pct_hidden_gem,
    p.pct_dead_zone,
  ];
}

// ── Min-max normalization ───────────────────────────────────────────
// Features at indices 5-13 (pct_*) are already 0-1 ratios.
// Other features need normalization:
//   visits: divide by max in cohort
//   avg_duration: cap at 180, divide by 180
//   avg_satisfaction: already 0-1 (satisfaction scale)
//   unique_spaces: divide by max in cohort (proxy for total active locations)
//   space_diversity: divide by 5

interface NormParams {
  maxVisits: number;
  maxUniqueSpaces: number;
}

function computeNormParams(data: number[][]): NormParams {
  let maxVisits = 0;
  let maxUniqueSpaces = 0;
  for (const row of data) {
    if (row[IDX_VISITS] > maxVisits) maxVisits = row[IDX_VISITS];
    if (row[IDX_UNIQUE_SPACES] > maxUniqueSpaces) maxUniqueSpaces = row[IDX_UNIQUE_SPACES];
  }
  return {
    maxVisits: maxVisits || 1,
    maxUniqueSpaces: maxUniqueSpaces || 1,
  };
}

function normalize(row: number[], params: NormParams): number[] {
  const out = [...row];
  out[IDX_VISITS] = out[IDX_VISITS] / params.maxVisits;
  out[IDX_AVG_DURATION] = Math.min(out[IDX_AVG_DURATION], 180) / 180;
  // avg_satisfaction already 0-1
  out[IDX_UNIQUE_SPACES] = out[IDX_UNIQUE_SPACES] / params.maxUniqueSpaces;
  out[4] = out[4] / 5; // space_diversity / 5
  // indices 5-13 are pct_* — already 0-1
  return out;
}

// ── Distance ────────────────────────────────────────────────────────

function euclideanDistSq(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

// ── K-Means++ Initialization ────────────────────────────────────────

function kMeansPlusPlusInit(data: number[][]): number[][] {
  const n = data.length;
  const centroids: number[][] = [];

  // Pick first centroid randomly
  const firstIdx = Math.floor(Math.random() * n);
  centroids.push([...data[firstIdx]]);

  for (let c = 1; c < K; c++) {
    // Compute D(x)^2 for each point
    const distSq: number[] = new Array(n);
    let totalDistSq = 0;
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const d = euclideanDistSq(data[i], centroid);
        if (d < minDist) minDist = d;
      }
      distSq[i] = minDist;
      totalDistSq += minDist;
    }

    // Sample next centroid proportional to D(x)^2
    let r = Math.random() * totalDistSq;
    let chosen = n - 1;
    for (let i = 0; i < n; i++) {
      r -= distSq[i];
      if (r <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push([...data[chosen]]);
  }

  return centroids;
}

// ── Lloyd's Algorithm ───────────────────────────────────────────────

function lloyds(
  data: number[][],
  initialCentroids: number[][],
): { centroids: number[][]; assignments: number[]; variance: number } {
  let centroids = initialCentroids.map((c) => [...c]);
  const n = data.length;
  let clusterAssignments = new Array<number>(n).fill(0);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // Assign each point to nearest centroid
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < K; c++) {
        const d = euclideanDistSq(data[i], centroids[c]);
        if (d < minDist) {
          minDist = d;
          bestCluster = c;
        }
      }
      clusterAssignments[i] = bestCluster;
    }

    // Recompute centroids
    const newCentroids: number[][] = Array.from({ length: K }, () =>
      new Array(NUM_FEATURES).fill(0),
    );
    const counts = new Array(K).fill(0);

    for (let i = 0; i < n; i++) {
      const c = clusterAssignments[i];
      counts[c]++;
      for (let f = 0; f < NUM_FEATURES; f++) {
        newCentroids[c][f] += data[i][f];
      }
    }

    for (let c = 0; c < K; c++) {
      if (counts[c] > 0) {
        for (let f = 0; f < NUM_FEATURES; f++) {
          newCentroids[c][f] /= counts[c];
        }
      } else {
        // Empty cluster — keep old centroid
        newCentroids[c] = [...centroids[c]];
      }
    }

    // Check convergence (max centroid movement)
    let maxMovement = 0;
    for (let c = 0; c < K; c++) {
      const movement = Math.sqrt(euclideanDistSq(centroids[c], newCentroids[c]));
      if (movement > maxMovement) maxMovement = movement;
    }

    centroids = newCentroids;

    if (maxMovement < CONVERGENCE_THRESHOLD) {
      break;
    }
  }

  // Final assignment pass
  for (let i = 0; i < n; i++) {
    let minDist = Infinity;
    let bestCluster = 0;
    for (let c = 0; c < K; c++) {
      const d = euclideanDistSq(data[i], centroids[c]);
      if (d < minDist) {
        minDist = d;
        bestCluster = c;
      }
    }
    clusterAssignments[i] = bestCluster;
  }

  // Compute within-cluster variance
  let totalVariance = 0;
  for (let i = 0; i < n; i++) {
    totalVariance += euclideanDistSq(data[i], centroids[clusterAssignments[i]]);
  }
  const variance = n > 0 ? totalVariance / n : 0;

  return { centroids, assignments: clusterAssignments, variance };
}

// ── Centroid-to-Label Mapping ───────────────────────────────────────
// Uses NORMALIZED centroid vectors. Rules applied in strict priority order.
// Collision: centroid with stronger driving signal wins the label.

function mapCentroidsToLabels(
  centroids: number[][],
  rawCentroids: number[][],
): Record<number, Phase1Cluster> {
  const mapping: Record<number, Phase1Cluster> = {};
  const assigned = new Set<number>();
  const usedLabels = new Set<Phase1Cluster>();

  const ALL_LABELS: Phase1Cluster[] = ['nomad', 'seeker', 'drifter', 'forced', 'disengaged'];

  // Rule 1: nomad — highest visits AND highest unique_spaces, avg_satisfaction > 0.60
  // Use normalized values for comparison
  let bestNomadIdx = -1;
  let bestNomadVisits = -1;
  for (let c = 0; c < K; c++) {
    if (centroids[c][IDX_AVG_SATISFACTION] > 0.60 &&
        centroids[c][IDX_VISITS] > bestNomadVisits) {
      // Check if this centroid has the highest visits AND unique_spaces
      let isHighestVisits = true;
      let isHighestSpaces = true;
      for (let o = 0; o < K; o++) {
        if (o === c) continue;
        if (centroids[o][IDX_VISITS] > centroids[c][IDX_VISITS]) isHighestVisits = false;
        if (centroids[o][IDX_UNIQUE_SPACES] > centroids[c][IDX_UNIQUE_SPACES]) isHighestSpaces = false;
      }
      if (isHighestVisits && isHighestSpaces) {
        bestNomadIdx = c;
        bestNomadVisits = centroids[c][IDX_VISITS];
      }
    }
  }
  if (bestNomadIdx >= 0) {
    mapping[bestNomadIdx] = 'nomad';
    assigned.add(bestNomadIdx);
    usedLabels.add('nomad');
  }

  // Rule 2: seeker — pct_hidden_gem > 0.70 OR (pct_hidden_gem > 0.50 AND pct_le_personal > 0.30)
  // Use raw centroid values for pct_* since they're already 0-1
  const seekerCandidates: Array<{ idx: number; signal: number }> = [];
  for (let c = 0; c < K; c++) {
    if (assigned.has(c)) continue;
    const hg = rawCentroids[c][IDX_PCT_HIDDEN_GEM];
    const lep = rawCentroids[c][IDX_PCT_LE_PERSONAL];
    if (hg > 0.70 || (hg > 0.50 && lep > 0.30)) {
      seekerCandidates.push({ idx: c, signal: hg });
    }
  }
  if (seekerCandidates.length > 0) {
    seekerCandidates.sort((a, b) => b.signal - a.signal);
    mapping[seekerCandidates[0].idx] = 'seeker';
    assigned.add(seekerCandidates[0].idx);
    usedLabels.add('seeker');
  }

  // Rule 3: forced — pct_transit > 0.80 OR (pct_transit > 0.60 AND avg_duration > 80min)
  // avg_duration in raw centroid is in minutes
  const forcedCandidates: Array<{ idx: number; signal: number }> = [];
  for (let c = 0; c < K; c++) {
    if (assigned.has(c)) continue;
    const tr = rawCentroids[c][IDX_PCT_TRANSIT];
    const dur = rawCentroids[c][IDX_AVG_DURATION];
    if (tr > 0.80 || (tr > 0.60 && dur > 80)) {
      forcedCandidates.push({ idx: c, signal: tr });
    }
  }
  if (forcedCandidates.length > 0) {
    forcedCandidates.sort((a, b) => b.signal - a.signal);
    mapping[forcedCandidates[0].idx] = 'forced';
    assigned.add(forcedCandidates[0].idx);
    usedLabels.add('forced');
  }

  // Rule 4: disengaged — pct_dead_zone > 0.65 AND avg_satisfaction < 0.55
  const disengagedCandidates: Array<{ idx: number; signal: number }> = [];
  for (let c = 0; c < K; c++) {
    if (assigned.has(c)) continue;
    const dz = rawCentroids[c][IDX_PCT_DEAD_ZONE];
    const sat = rawCentroids[c][IDX_AVG_SATISFACTION];
    if (dz > 0.65 && sat < 0.55) {
      disengagedCandidates.push({ idx: c, signal: dz });
    }
  }
  if (disengagedCandidates.length > 0) {
    disengagedCandidates.sort((a, b) => b.signal - a.signal);
    mapping[disengagedCandidates[0].idx] = 'disengaged';
    assigned.add(disengagedCandidates[0].idx);
    usedLabels.add('disengaged');
  }

  // Rule 5: drifter — remaining centroid (expected pct_social_hub dominance)
  for (let c = 0; c < K; c++) {
    if (assigned.has(c)) continue;
    if (!usedLabels.has('drifter')) {
      mapping[c] = 'drifter';
      assigned.add(c);
      usedLabels.add('drifter');
      break;
    }
  }

  // Fallback: if disengaged was never naturally matched, assign to unmatched
  // centroid with lowest avg_satisfaction and highest pct_dead_zone
  if (!usedLabels.has('disengaged')) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let c = 0; c < K; c++) {
      if (assigned.has(c)) continue;
      const score = rawCentroids[c][IDX_PCT_DEAD_ZONE] - rawCentroids[c][IDX_AVG_SATISFACTION];
      if (score > bestScore) {
        bestScore = score;
        bestIdx = c;
      }
    }
    if (bestIdx >= 0) {
      mapping[bestIdx] = 'disengaged';
      assigned.add(bestIdx);
      usedLabels.add('disengaged');
    }
  }

  // Assign remaining unmatched centroids to remaining unused labels
  const remainingLabels = ALL_LABELS.filter((l) => !usedLabels.has(l));
  let labelIdx = 0;
  for (let c = 0; c < K; c++) {
    if (assigned.has(c)) continue;
    if (labelIdx < remainingLabels.length) {
      mapping[c] = remainingLabels[labelIdx++];
      assigned.add(c);
    }
  }

  return mapping;
}

// ── Main Entry Point ────────────────────────────────────────────────

export function computePlayerClusters(
  players: PlayerFeatureVector[],
): ClusteringResult {
  if (players.length < K) {
    // Not enough players for k=5 — assign all to drifter
    const assignments: Record<string, Phase1Cluster> = {};
    for (const p of players) {
      assignments[p.userId] = 'drifter';
    }
    return {
      assignments,
      centroids: [],
      labelMapping: { 0: 'nomad', 1: 'seeker', 2: 'drifter', 3: 'forced', 4: 'disengaged' },
      withinClusterVariance: 0,
    };
  }

  // Convert to raw feature arrays
  const rawData = players.map(toFeatureArray);

  // Compute normalization params and normalize
  const normParams = computeNormParams(rawData);
  const normalizedData = rawData.map((row) => normalize(row, normParams));

  // K-means++ init + Lloyd's
  const initialCentroids = kMeansPlusPlusInit(normalizedData);
  const { centroids, assignments: clusterIndices, variance } = lloyds(
    normalizedData,
    initialCentroids,
  );

  // Compute raw (un-normalized) centroids for label mapping rules
  // that use absolute thresholds (avg_duration > 80 min, etc.)
  const rawCentroids: number[][] = Array.from({ length: K }, () =>
    new Array(NUM_FEATURES).fill(0),
  );
  const counts = new Array(K).fill(0);
  for (let i = 0; i < players.length; i++) {
    const c = clusterIndices[i];
    counts[c]++;
    for (let f = 0; f < NUM_FEATURES; f++) {
      rawCentroids[c][f] += rawData[i][f];
    }
  }
  for (let c = 0; c < K; c++) {
    if (counts[c] > 0) {
      for (let f = 0; f < NUM_FEATURES; f++) {
        rawCentroids[c][f] /= counts[c];
      }
    }
  }

  // Map centroids to labels
  const labelMapping = mapCentroidsToLabels(centroids, rawCentroids);

  // Build userId → label assignments
  const assignments: Record<string, Phase1Cluster> = {};
  for (let i = 0; i < players.length; i++) {
    assignments[players[i].userId] = labelMapping[clusterIndices[i]];
  }

  return {
    assignments,
    centroids,
    labelMapping,
    withinClusterVariance: Math.round(variance * 10000) / 10000,
  };
}

// Re-export for testing
export { kMeansPlusPlusInit, lloyds, mapCentroidsToLabels, toFeatureArray, normalize, computeNormParams };
export type { NormParams };
