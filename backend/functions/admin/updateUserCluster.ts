import { randomUUID } from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, updateItem, putItem } from '../../shared/db';
import type { User, Phase1Cluster } from '../../shared/types';

const VALID_CLUSTERS: (Phase1Cluster | null)[] = ['nomad', 'seeker', 'drifter', 'forced', 'disengaged', null];

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const userId = event.pathParameters?.userId;
    if (!userId) {
      return error(ErrorCode.VALIDATION_ERROR, 'userId path parameter is required', 400);
    }

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const cluster = body.cluster as string | null;

    if (cluster !== null && !VALID_CLUSTERS.includes(cluster as Phase1Cluster)) {
      return error(ErrorCode.VALIDATION_ERROR, `Invalid cluster. Must be one of: ${VALID_CLUSTERS.filter(Boolean).join(', ')}, or null`, 400);
    }

    // Verify user exists
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    const oldCluster = user.phase1Cluster || null;

    // Update
    if (cluster === null) {
      await updateItem(
        'users',
        { userId },
        'REMOVE phase1Cluster',
      );
    } else {
      await updateItem(
        'users',
        { userId },
        'SET phase1Cluster = :cluster',
        { ':cluster': cluster },
      );
    }

    // Audit log
    const adminUserId = authorizer.userId || authorizer.uid || 'unknown';
    await putItem('admin-audit', {
      auditId: randomUUID(),
      action: 'UPDATE_USER_CLUSTER',
      targetUserId: userId,
      adminUserId,
      details: JSON.stringify({ oldCluster, newCluster: cluster }),
      timestamp: new Date().toISOString(),
    });

    return success({ updated: true, newCluster: cluster });
  } catch (err) {
    console.error('[updateUserCluster] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
