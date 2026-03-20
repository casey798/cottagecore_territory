import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import type { LocationMasterConfig } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // Full scan — only 30 records
    const allLocations: LocationMasterConfig[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<LocationMasterConfig>('location-master-config', {
        exclusiveStartKey: lastKey,
      });
      allLocations.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    allLocations.sort((a, b) => a.qrNumber - b.qrNumber);

    // Strip large/sensitive fields to reduce response size (~10KB per qrImageBase64)
    const locations = allLocations.map(({ qrImageBase64, qrSecret, ...rest }) => rest);

    return success({ locations });
  } catch (err) {
    console.error('[getLocations] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to fetch locations', 500);
  }
}
