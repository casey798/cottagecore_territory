import { readFileSync } from 'fs';
import { join } from 'path';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { batchWrite } from '../../shared/db';

const CLAN_MAP: Record<string, string> = {
  ember: 'ember',
  tide: 'tide',
  bloom: 'bloom',
  gale: 'gale',
  staff: 'hearth',
  hearth: 'hearth',
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // Try to get CSV from request body first, fall back to bundled file
    let csvContent: string;
    const body = event.body ? JSON.parse(event.body) as Record<string, unknown> : {};

    if (typeof body.csvData === 'string' && body.csvData.trim().length > 0) {
      csvContent = body.csvData;
    } else {
      // Read bundled CSV from the Lambda deployment package
      try {
        csvContent = readFileSync(join(__dirname, 'roster.csv'), 'utf-8');
      } catch {
        return error(
          ErrorCode.VALIDATION_ERROR,
          'No CSV provided in body and no bundled roster.csv found. Send { "csvData": "email,house\\n..." }',
          400,
        );
      }
    }

    const lines = csvContent.trim().split('\n').map((l) => l.trim()).filter(Boolean);

    // Skip header row if it starts with "email"
    const startIdx = lines[0]?.toLowerCase().startsWith('email') ? 1 : 0;

    const rosterItems: Record<string, unknown>[] = [];
    let skipped = 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length < 2) {
        skipped++;
        continue;
      }

      const email = parts[0].toLowerCase();
      const houseRaw = parts[1].toLowerCase();
      const clan = CLAN_MAP[houseRaw];

      if (!clan) {
        console.warn(`Skipping unknown house "${houseRaw}" for ${email}`);
        skipped++;
        continue;
      }

      rosterItems.push({ email, clan });
    }

    // BatchWrite to roster table
    const ROSTER_TABLE = 'roster';
    if (rosterItems.length > 0) {
      await batchWrite(ROSTER_TABLE, rosterItems);
    }

    console.log(`[seedRoster] Seeded ${rosterItems.length} roster entries, skipped ${skipped}`);

    return success({
      imported: rosterItems.length,
      skipped,
    });
  } catch (err) {
    console.error('[seedRoster] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to seed roster', 500);
  }
}
