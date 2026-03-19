import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { query, updateItem } from '../../shared/db';
import type { User } from '../../shared/types';

const VALID_CLUSTERS = new Set(['nomad', 'drifter', 'forced', 'seeker', 'disengaged']);

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const rows = body.rows as Array<{ email: string; cluster: string }> | undefined;

    if (!Array.isArray(rows) || rows.length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'rows array is required', 400);
    }

    let matched = 0;
    let notInRoster = 0;
    let invalid = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const email = (row.email ?? '').toString().trim().toLowerCase();
      const cluster = (row.cluster ?? '').toString().trim().toLowerCase();

      if (!email) {
        invalid++;
        errors.push(`Row ${i + 1}: empty email`);
        continue;
      }

      if (!VALID_CLUSTERS.has(cluster)) {
        invalid++;
        errors.push(`Row ${i + 1}: invalid cluster "${cluster}" for ${email}`);
        continue;
      }

      // Look up user by email via EmailIndex
      const result = await query<User>(
        'users',
        'email = :email',
        { ':email': email },
        { indexName: 'EmailIndex', limit: 1 },
      );

      if (result.items.length === 0) {
        notInRoster++;
        errors.push(`Row ${i + 1}: ${email} not found in roster`);
        continue;
      }

      const user = result.items[0];
      await updateItem(
        'users',
        { userId: user.userId },
        'SET phase1Cluster = :cluster',
        { ':cluster': cluster },
      );
      matched++;
    }

    return success({ matched, notInRoster, invalid, errors });
  } catch (err) {
    console.error('[importClusters] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
