import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, updateItem } from '../../shared/db';
import type { LocationMasterConfig } from '../../shared/types';

interface Phase1Entry {
  locationId: string;
  sdtDeficit?: number;
  priorityTier?: string;
  phase1Visits?: number;
  phase1Satisfaction?: number | null;
  phase1DominantCluster?: string | null;
  isNewSpace?: boolean;
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const locations = body.locations;
    if (!Array.isArray(locations)) {
      return error(ErrorCode.VALIDATION_ERROR, 'locations array is required', 400);
    }

    let updated = 0;
    let skipped = 0;

    for (const entry of locations as Phase1Entry[]) {
      if (!entry.locationId || typeof entry.locationId !== 'string') {
        skipped++;
        continue;
      }

      const existing = await getItem<LocationMasterConfig>('location-master-config', {
        locationId: entry.locationId,
      });
      if (!existing) {
        skipped++;
        continue;
      }

      const setParts: string[] = [];
      const expressionValues: Record<string, unknown> = {};
      const expressionNames: Record<string, string> = {};
      let idx = 0;

      if (typeof entry.sdtDeficit === 'number') {
        expressionNames[`#f${idx}`] = 'sdtDeficit';
        expressionValues[`:v${idx}`] = entry.sdtDeficit;
        setParts.push(`#f${idx} = :v${idx}`);
        idx++;
      }
      if (typeof entry.priorityTier === 'string' || entry.priorityTier === null) {
        expressionNames[`#f${idx}`] = 'priorityTier';
        expressionValues[`:v${idx}`] = entry.priorityTier ?? null;
        setParts.push(`#f${idx} = :v${idx}`);
        idx++;
      }
      if (typeof entry.phase1Visits === 'number') {
        expressionNames[`#f${idx}`] = 'phase1Visits';
        expressionValues[`:v${idx}`] = entry.phase1Visits;
        setParts.push(`#f${idx} = :v${idx}`);
        idx++;
      }
      if (entry.phase1Satisfaction !== undefined) {
        expressionNames[`#f${idx}`] = 'phase1Satisfaction';
        expressionValues[`:v${idx}`] = typeof entry.phase1Satisfaction === 'number' ? entry.phase1Satisfaction : null;
        setParts.push(`#f${idx} = :v${idx}`);
        idx++;
      }
      if (entry.phase1DominantCluster !== undefined) {
        expressionNames[`#f${idx}`] = 'phase1DominantCluster';
        expressionValues[`:v${idx}`] = typeof entry.phase1DominantCluster === 'string' ? entry.phase1DominantCluster : null;
        setParts.push(`#f${idx} = :v${idx}`);
        idx++;
      }
      if (typeof entry.isNewSpace === 'boolean') {
        expressionNames[`#f${idx}`] = 'isNewSpace';
        expressionValues[`:v${idx}`] = entry.isNewSpace;
        setParts.push(`#f${idx} = :v${idx}`);
        idx++;
      }

      if (setParts.length === 0) {
        skipped++;
        continue;
      }

      await updateItem(
        'location-master-config',
        { locationId: entry.locationId },
        `SET ${setParts.join(', ')}`,
        expressionValues,
        expressionNames
      );
      updated++;
    }

    return success({ updated, skipped });
  } catch (err) {
    console.error('[importPhase1Data] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
