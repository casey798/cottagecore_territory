import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, getItem } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { LocationMasterConfig, LocationClassification, DailyClusteringRun, ClusterWeightConfig, Phase1Cluster } from '../../shared/types';

// SDT deficit weight: higher deficit = more important to activate
function sdtWeight(deficit: number): number {
  if (deficit >= 8) return 2.0;
  if (deficit >= 6) return 1.5;
  if (deficit >= 4) return 1.0;
  return 0.5;
}

// Classification balance weight
const CLASSIFICATION_WEIGHT: Record<LocationClassification, number> = {
  'Dead Zone': 1.8,
  'Unvisited': 1.6,
  'Hidden Gem': 1.2,
  'Transit / Forced Stay': 0.8,
  'Social Hub': 1.0,
  'TBD': 0.5,
};

// Activation need based on rolling 3-day visit data
function activationNeed(last3DaysVisits: [number, number, number]): number {
  const recentVisits = last3DaysVisits[0] + last3DaysVisits[1] + last3DaysVisits[2];
  const dailyAverage = recentVisits / 3;

  if (dailyAverage === 0) return 1.5;   // no traffic recently — needs attention
  if (dailyAverage < 3)  return 1.2;   // light traffic
  if (dailyAverage < 7)  return 1.0;   // moderate — maintain
  return 0.6;                           // well-visited — can cool off
}

// Priority tier boost
function priorityBoost(tier: LocationMasterConfig['priorityTier']): number {
  switch (tier) {
    case 'P1-Critical': return 1.5;
    case 'P1-Seed':     return 1.3;
    case 'P2-High':     return 1.1;
    case 'P3-Medium':   return 1.0;
    default:            return 0.8;
  }
}

interface ScoredLocation {
  locationId: string;
  qrNumber: number;
  name: string;
  classification: LocationClassification;
  score: number;
  included: boolean;
  warning?: string;
  recentDailyAverage: number;
  last3DaysVisits: [number, number, number];
  clusterDemand?: Record<string, number>;
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const today = getTodayISTString();

    // Fetch all active locations from master config
    const allLocations: LocationMasterConfig[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<LocationMasterConfig>('location-master-config', {
        exclusiveStartKey: lastKey,
      });
      allLocations.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    const activeLocations = allLocations.filter((l) => l.active);

    // Load today's clustering run and cluster weights (if available) for demand scoring
    const clusteringRun = await getItem<DailyClusteringRun>('clustering-runs', { date: today });
    const clusterConfig = await getItem<ClusterWeightConfig>('cluster-weight-config', { configId: 'current' });

    // Compute raw cluster demand scores per location
    const ALL_CLUSTERS: Phase1Cluster[] = ['nomad', 'seeker', 'drifter', 'forced', 'disengaged'];
    const rawDemandScores = new Map<string, number>();
    const clusterDemandDetails = new Map<string, Record<string, number>>();

    if (clusteringRun && clusterConfig) {
      const totalPlayers = clusteringRun.totalPlayers + clusteringRun.noDataPlayers;

      for (const loc of activeLocations) {
        const classification = loc.classification as keyof typeof clusterConfig.weights.nomad;
        let demandSum = 0;
        const demandPerCluster: Record<string, number> = {};

        for (const cluster of ALL_CLUSTERS) {
          const count = clusteringRun.clusterCounts[cluster] ?? 0;
          const weight = clusterConfig.weights[cluster]?.[classification] ?? 1.0;
          const contribution = count * weight;
          demandSum += contribution;
          demandPerCluster[cluster] = Math.round(count * weight);
        }
        // Add null cluster contribution
        const nullCount = clusteringRun.noDataPlayers;
        const nullWeight = clusterConfig.weights['null']?.[classification] ?? 1.0;
        demandSum += nullCount * nullWeight;

        const normalizedDemand = totalPlayers > 0 ? demandSum / totalPlayers : 1.0;
        rawDemandScores.set(loc.locationId, normalizedDemand);
        clusterDemandDetails.set(loc.locationId, demandPerCluster);
      }

      // Normalize demand scores to 0.5–1.5 range using min-max
      let minDemand = Infinity;
      let maxDemand = -Infinity;
      for (const d of rawDemandScores.values()) {
        if (d < minDemand) minDemand = d;
        if (d > maxDemand) maxDemand = d;
      }
      const demandRange = maxDemand - minDemand;
      if (demandRange > 0) {
        for (const [locId, d] of rawDemandScores) {
          rawDemandScores.set(locId, 0.5 + ((d - minDemand) / demandRange));
        }
      } else {
        for (const locId of rawDemandScores.keys()) {
          rawDemandScores.set(locId, 1.0);
        }
      }
    }

    // Score each location
    const scored: ScoredLocation[] = activeLocations.map((loc) => {
      const visits = loc.last3DaysVisits ?? [0, 0, 0] as [number, number, number];
      const recentVisits = visits[0] + visits[1] + visits[2];
      const dailyAverage = recentVisits / 3;

      const sdt = sdtWeight(loc.sdtDeficit);
      const classWeight = CLASSIFICATION_WEIGHT[loc.classification] ?? 1.0;
      const activation = activationNeed(visits);
      const priority = priorityBoost(loc.priorityTier);
      const clusterDemandScore = rawDemandScores.get(loc.locationId) ?? 1.0;

      const score = sdt * classWeight * activation * priority * clusterDemandScore;

      let warning: string | undefined;
      if (dailyAverage === 0 && !loc.isNewSpace) {
        warning = 'Zero visits in last 3 days';
      } else if (dailyAverage >= 10) {
        warning = 'Very high recent traffic — consider cooling off';
      }

      return {
        locationId: loc.locationId,
        qrNumber: loc.qrNumber,
        name: loc.name,
        classification: loc.classification,
        score: Math.round(score * 10) / 10,
        included: false,
        warning,
        recentDailyAverage: Math.round(dailyAverage * 10) / 10,
        last3DaysVisits: visits,
        clusterDemand: clusterDemandDetails.get(loc.locationId),
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Top 10 are included by default (admin can override)
    const TARGET_POOL_SIZE = 10;
    for (let i = 0; i < Math.min(TARGET_POOL_SIZE, scored.length); i++) {
      scored[i].included = true;
    }

    return success({
      date: today,
      suggestions: scored,
    });
  } catch (err) {
    console.error('[suggestDailyPool] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to suggest daily pool', 500);
  }
}
