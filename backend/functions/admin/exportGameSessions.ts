import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import type { GameSession, User, LocationMasterConfig } from '../../shared/types';

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

const MINIGAME_NAMES: Record<string, string> = {
  'grove-words': 'Grove Words',
  'kindred': 'Kindred',
  'stone-pairs': 'Stone Pairs',
  'vine-trail': 'Vine Trail',
  'mosaic': 'Mosaic',
  'pips': 'Pips',
  'cipher-stones': 'Cipher Stones',
  'potion-logic': 'Potion Logic',
  'leaf-sort': 'Leaf Sort',
  'path-weaver': 'Path Weaver',
  'firefly-flow': 'Firefly Flow',
  'grove-equations': 'Grove Equations',
  'bloom-sequence': 'Bloom Sequence',
  'shift-slide': 'Shift & Slide',
  'signal-path': 'Signal Path',
  'number-grove': 'Number Grove',
  'kindred-coop': 'Kindred (Co-op)',
  'cipher-stones-coop': 'Cipher Stones (Co-op)',
  'pips-coop': 'Pips (Co-op)',
  'stone-pairs-coop': 'Stone Pairs (Co-op)',
  'potion-logic-coop': 'Potion Logic (Co-op)',
  'vine-trail-coop': 'Vine Trail (Co-op)',
};

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

    const sessionScanOpts: Parameters<typeof scan>[1] = {};
    if (startDate && endDate) {
      sessionScanOpts.filterExpression = '#d BETWEEN :start AND :end';
      sessionScanOpts.expressionNames = { '#d': 'date' };
      sessionScanOpts.expressionValues = { ':start': startDate, ':end': endDate };
    }

    // Parallel scans: game-sessions, users, location-master-config
    const [allItems, users, locations] = await Promise.all([
      scanAll<GameSession>('game-sessions', sessionScanOpts),
      scanAll<User>('users'),
      scanAll<LocationMasterConfig>('location-master-config'),
    ]);

    const userMap = new Map<string, User>();
    for (const u of users) userMap.set(u.userId, u);

    const locationMap = new Map<string, LocationMasterConfig>();
    for (const l of locations) locationMap.set(l.locationId, l);

    const header = 'sessionId,userId,locationId,locationQRNumber,locationName,locationClassification,minigameId,minigameName,date,startedAt,completedAt,result,xpEarned,chestDropped,chestAssetId,coopPartnerId,coopMode,dwellTimeSeconds,phase1Cluster,practiceSession';
    const rows = allItems.map((s) => {
      const user = userMap.get(s.userId);
      const loc = locationMap.get(s.locationId);
      return csvRow([
        s.sessionId,
        s.userId,
        s.locationId,
        loc?.qrNumber ?? '',
        loc?.name ?? '',
        loc?.classification ?? '',
        s.minigameId,
        MINIGAME_NAMES[s.minigameId] ?? s.minigameId,
        s.date,
        s.startedAt,
        s.completedAt,
        s.result,
        s.xpEarned,
        s.chestDropped,
        s.chestAssetId,
        s.coopPartnerId,
        s.coopPartnerId ? 'yes' : 'no',
        s.dwellTime ?? '',
        user?.phase1Cluster ?? '',
        s.practiceSession ? 'yes' : 'no',
      ]);
    });

    return {
      statusCode: 200,
      headers: CSV_HEADERS,
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportGameSessions] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
