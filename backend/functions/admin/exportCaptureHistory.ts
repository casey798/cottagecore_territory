import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import type { CapturedSpace, User, LocationMasterConfig } from '../../shared/types';

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

const CSV_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'text/csv',
};

const CLAN_LABELS: Record<string, string> = {
  ember: 'Ember', tide: 'Tide', bloom: 'Bloom', gale: 'Gale', hearth: 'Hearth',
};
const CLAN_IDS = ['ember', 'tide', 'bloom', 'gale', 'hearth'] as const;

async function scanAll<T>(table: string, opts?: Parameters<typeof scan>[1]): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, { ...opts, exclusiveStartKey: lastKey });
    items.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return items;
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const params = event.queryStringParameters || {};
    const startDate = params.startDate;
    const endDate = params.endDate;

    const captureScanOpts: Parameters<typeof scan>[1] = {};
    if (startDate && endDate) {
      captureScanOpts.filterExpression = 'dateCaptured BETWEEN :start AND :end';
      captureScanOpts.expressionValues = { ':start': startDate, ':end': endDate };
    }

    // Parallel scans
    const [allItems, allUsers, allLocations] = await Promise.all([
      scanAll<CapturedSpace>('captured-spaces', captureScanOpts),
      scanAll<User>('users'),
      scanAll<LocationMasterConfig>('location-master-config'),
    ]);

    // Compute clan roster sizes
    const clanRoster: Record<string, number> = { ember: 0, tide: 0, bloom: 0, gale: 0, hearth: 0 };
    for (const u of allUsers) {
      if (u.clan && clanRoster[u.clan] !== undefined) {
        clanRoster[u.clan]++;
      }
    }

    // Build location name → classification lookup (case-insensitive)
    const locationNameMap = new Map<string, string>();
    for (const loc of allLocations) {
      locationNameMap.set(loc.name.toLowerCase(), loc.classification ?? '');
    }

    // Find season start date (earliest dateCaptured in this dataset)
    let seasonStartDate: string | null = null;
    for (const s of allItems) {
      if (!seasonStartDate || s.dateCaptured < seasonStartDate) {
        seasonStartDate = s.dateCaptured;
      }
    }

    const header = 'spaceId,dateCaptured,dayNumber,clan,winningClanName,spaceName,spaceClassification,season,emberXP,tideXP,bloomXP,galeXP,hearthXP,totalDayXP,emberNormalized,tideNormalized,bloomNormalized,galeNormalized,hearthNormalized';
    const rows = allItems.map((s) => {
      // Day number from season start
      let dayNumber = '';
      if (seasonStartDate) {
        const diff = Math.floor(
          (new Date(s.dateCaptured).getTime() - new Date(seasonStartDate).getTime()) / 86400000
        );
        dayNumber = String(diff + 1);
      }

      // XP snapshot fields (from Tier 1 migration)
      const snapshot = (s as unknown as Record<string, unknown>).clanXpSnapshot as Record<string, number> | undefined;
      const clanXpValues = CLAN_IDS.map(c => snapshot?.[c] ?? '');
      const totalDayXp = (s as unknown as Record<string, unknown>).totalDayXp ?? '';

      // Normalized XP (clan XP / roster size)
      const normalizedValues = CLAN_IDS.map(c => {
        const xp = snapshot?.[c];
        const roster = clanRoster[c];
        if (xp == null || !roster) return '';
        return (xp / roster).toFixed(2);
      });

      // Space classification by name match
      const spaceClassification = locationNameMap.get((s.spaceName ?? '').toLowerCase()) ?? '';

      return csvRow([
        s.spaceId,
        s.dateCaptured,
        dayNumber,
        s.clan,
        CLAN_LABELS[s.clan] ?? s.clan,
        s.spaceName,
        spaceClassification,
        s.season,
        ...clanXpValues,
        totalDayXp,
        ...normalizedValues,
      ]);
    });

    return {
      statusCode: 200,
      headers: CSV_HEADERS,
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportCaptureHistory] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
