import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, putItem } from '../../shared/db';
import type { ClusterWeightConfig, ClusterWeights, LocationMasterConfig } from '../../shared/types';

const VALID_CLUSTERS = ['nomad', 'seeker', 'drifter', 'forced', 'disengaged', 'null'];
const VALID_CLASSIFICATIONS: (keyof ClusterWeights)[] = [
  'Social Hub',
  'Transit / Forced Stay',
  'Hidden Gem',
  'Dead Zone',
  'Unvisited',
];

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const body = JSON.parse(event.body || '{}') as {
      weights?: Record<string, Record<string, number>>;
      badPairings?: Record<string, number[]>;
      assignmentCounts?: Record<string, number>;
    };

    if (!body.weights || !body.badPairings || !body.assignmentCounts) {
      return error(ErrorCode.VALIDATION_ERROR, 'weights, badPairings, and assignmentCounts are required', 400);
    }

    // Validate weights
    for (const [cluster, classWeights] of Object.entries(body.weights)) {
      if (!VALID_CLUSTERS.includes(cluster)) {
        return error(ErrorCode.VALIDATION_ERROR, `Invalid cluster key: ${cluster}`, 400);
      }
      for (const [classification, weight] of Object.entries(classWeights)) {
        if (!VALID_CLASSIFICATIONS.includes(classification as keyof ClusterWeights)) {
          return error(ErrorCode.VALIDATION_ERROR, `Invalid classification: ${classification}`, 400);
        }
        if (typeof weight !== 'number' || weight <= 0) {
          return error(ErrorCode.VALIDATION_ERROR, `Weight must be a positive number for ${cluster}.${classification}`, 400);
        }
      }
    }

    // Validate assignmentCounts
    for (const [cluster, count] of Object.entries(body.assignmentCounts)) {
      if (!VALID_CLUSTERS.includes(cluster)) {
        return error(ErrorCode.VALIDATION_ERROR, `Invalid cluster key in assignmentCounts: ${cluster}`, 400);
      }
      if (typeof count !== 'number' || count < 1 || count > 8 || !Number.isInteger(count)) {
        return error(ErrorCode.VALIDATION_ERROR, `assignmentCounts[${cluster}] must be an integer between 1 and 8`, 400);
      }
    }

    // Validate badPairings qrNumbers
    for (const [cluster, qrNumbers] of Object.entries(body.badPairings)) {
      if (cluster === 'null') continue; // null cluster doesn't have bad pairings
      if (!VALID_CLUSTERS.includes(cluster)) {
        return error(ErrorCode.VALIDATION_ERROR, `Invalid cluster key in badPairings: ${cluster}`, 400);
      }
      if (!Array.isArray(qrNumbers)) {
        return error(ErrorCode.VALIDATION_ERROR, `badPairings[${cluster}] must be an array`, 400);
      }
      for (const qr of qrNumbers) {
        if (typeof qr !== 'number' || qr < 1 || qr > 30 || !Number.isInteger(qr)) {
          return error(ErrorCode.VALIDATION_ERROR, `badPairings qrNumber must be integer 1-30, got ${qr}`, 400);
        }
      }
    }

    // Resolve qrNumbers to locationIds
    const allLocations: LocationMasterConfig[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<LocationMasterConfig>('location-master-config', {
        exclusiveStartKey: lastKey,
      });
      allLocations.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    const qrToLocationId = new Map<number, string>();
    for (const loc of allLocations) {
      qrToLocationId.set(loc.qrNumber, loc.locationId);
    }

    const resolvedBadPairings: Record<string, string[]> = {};
    for (const [cluster, qrNumbers] of Object.entries(body.badPairings)) {
      if (cluster === 'null') continue;
      const locationIds: string[] = [];
      for (const qr of qrNumbers) {
        const locId = qrToLocationId.get(qr);
        if (!locId) {
          return error(ErrorCode.VALIDATION_ERROR, `QR number ${qr} not found in location master config`, 400);
        }
        locationIds.push(locId);
      }
      resolvedBadPairings[cluster] = locationIds;
    }

    // Ensure all clusters have entries
    for (const cluster of ['nomad', 'seeker', 'drifter', 'forced', 'disengaged']) {
      if (!resolvedBadPairings[cluster]) {
        resolvedBadPairings[cluster] = [];
      }
    }

    const adminUserId = authorizer.userId || authorizer.uid || 'unknown';

    const config: ClusterWeightConfig = {
      configId: 'current',
      weights: body.weights as unknown as ClusterWeightConfig['weights'],
      badPairings: resolvedBadPairings as ClusterWeightConfig['badPairings'],
      assignmentCounts: body.assignmentCounts as ClusterWeightConfig['assignmentCounts'],
      updatedAt: new Date().toISOString(),
      updatedBy: adminUserId as string,
    };

    await putItem('cluster-weight-config', config as unknown as Record<string, unknown>);

    return success({ config });
  } catch (err) {
    console.error('[updateClusterWeights] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to update cluster weights', 500);
  }
}
