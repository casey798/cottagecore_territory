import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, updateItem } from '../../shared/db';
import type { LocationMasterConfig } from '../../shared/types';

interface SpaceMapping {
  locationId: string;
  phase1Visits: number;
  phase1Satisfaction: number | null;
  phase1DominantCluster: string | null;
  classification: string;
  sdtDeficit: number;
  isNewSpace: boolean;
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
    const mappings = body.mappings as SpaceMapping[] | undefined;

    if (!Array.isArray(mappings) || mappings.length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'mappings array is required', 400);
    }

    let updated = 0;
    let notFound = 0;
    let invalid = 0;
    const errors: string[] = [];

    for (let i = 0; i < mappings.length; i++) {
      const m = mappings[i];

      if (!m.locationId) {
        invalid++;
        errors.push(`Row ${i + 1}: missing locationId`);
        continue;
      }

      // Verify location exists
      const existing = await getItem<LocationMasterConfig>('location-master-config', { locationId: m.locationId });
      if (!existing) {
        notFound++;
        errors.push(`Row ${i + 1}: locationId "${m.locationId}" not found`);
        continue;
      }

      await updateItem(
        'location-master-config',
        { locationId: m.locationId },
        'SET phase1Visits = :visits, phase1Satisfaction = :sat, phase1DominantCluster = :cluster, classification = :cls, sdtDeficit = :sdt, isNewSpace = :isNew',
        {
          ':visits': m.phase1Visits ?? 0,
          ':sat': m.phase1Satisfaction ?? null,
          ':cluster': m.phase1DominantCluster ?? null,
          ':cls': m.classification ?? 'TBD',
          ':sdt': m.sdtDeficit ?? 0,
          ':isNew': m.isNewSpace ?? false,
        },
      );
      updated++;
    }

    return success({ updated, notFound, invalid, errors });
  } catch (err) {
    console.error('[importSpaceMetadata] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
