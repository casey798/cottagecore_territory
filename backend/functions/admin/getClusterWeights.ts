import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem } from '../../shared/db';
import type { ClusterWeightConfig } from '../../shared/types';

const DEFAULT_CONFIG: ClusterWeightConfig = {
  configId: 'current',
  weights: {
    nomad:      { 'Social Hub': 0.5, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 3.0, 'Dead Zone': 3.0, 'Unvisited': 5.0 },
    seeker:     { 'Social Hub': 3.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.0, 'Dead Zone': 0.5, 'Unvisited': 1.0 },
    drifter:    { 'Social Hub': 2.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.5, 'Dead Zone': 0.5, 'Unvisited': 1.0 },
    forced:     { 'Social Hub': 1.5, 'Transit / Forced Stay': 1.5, 'Hidden Gem': 2.0, 'Dead Zone': 1.0, 'Unvisited': 0.5 },
    disengaged: { 'Social Hub': 2.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.0, 'Dead Zone': 0.3, 'Unvisited': 0.3 },
    null:       { 'Social Hub': 1.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.0, 'Dead Zone': 1.0, 'Unvisited': 1.0 },
  },
  badPairings: {
    nomad: [],
    seeker: [],
    drifter: [],
    forced: [],
    disengaged: [],
  },
  assignmentCounts: {
    nomad: 5,
    seeker: 4,
    drifter: 4,
    forced: 4,
    disengaged: 3,
    null: 4,
  },
  updatedAt: '',
  updatedBy: 'default',
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const config = await getItem<ClusterWeightConfig>('cluster-weight-config', {
      configId: 'current',
    });

    return success({ config: config ?? DEFAULT_CONFIG });
  } catch (err) {
    console.error('[getClusterWeights] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to fetch cluster weights', 500);
  }
}
