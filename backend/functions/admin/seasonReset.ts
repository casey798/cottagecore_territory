import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { success, error, ErrorCode } from '../../shared/response';
import { seasonResetSchema } from '../../shared/schemas';
import { scan, updateItem, getItem, deleteItem, docClient, tableName } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { User, Clan, CapturedSpace, GameSession, CheckIn } from '../../shared/types';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const BUCKET = process.env.ASSETS_BUCKET!;
const PRESIGNED_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const headerLine = headers.join(',');
  const dataLines = rows.map(row => headers.map(h => escapeCsv(row[h])).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// ── S3 helper ────────────────────────────────────────────────────────────────

async function uploadAndSign(key: string, csv: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: csv,
    ContentType: 'text/csv',
  }));
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: PRESIGNED_EXPIRY_SECONDS },
  );
}

// ── Batch delete helper ──────────────────────────────────────────────────────
// Scans the table projecting only the PK, then deletes in BatchWriteItem
// chunks of 25. Fully paginated.

async function batchDeleteTable(logicalName: string, pkAttr: string): Promise<number> {
  const fullTable = tableName(logicalName);
  let count = 0;
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: fullTable,
      ProjectionExpression: pkAttr,
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));

    const items = (result.Items ?? []) as Array<Record<string, unknown>>;
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;

    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [fullTable]: batch.map(item => ({
            DeleteRequest: { Key: { [pkAttr]: item[pkAttr] } },
          })),
        },
      }));
      count += batch.length;
    }
  } while (lastKey);

  return count;
}

// ── Step 0: export all five CSVs to S3 ──────────────────────────────────────

async function runExport(
  currentSeasonNumber: number,
): Promise<Record<string, string>> {
  const prefix = `season-archives/season-${currentSeasonNumber}/`;
  const urls: Record<string, string> = {};

  // File 1: players
  const allUsers: User[] = [];
  let uKey: Record<string, unknown> | undefined;
  do {
    const r = await scan<User>('users', { exclusiveStartKey: uKey });
    allUsers.push(...r.items);
    uKey = r.lastEvaluatedKey;
  } while (uKey);

  const playersCsv = buildCsv(
    ['userId', 'email', 'displayName', 'clan', 'seasonXp', 'totalWins', 'currentStreak', 'bestStreak'],
    allUsers as unknown as Array<Record<string, unknown>>,
  );
  urls.players = await uploadAndSign(
    `${prefix}season-${currentSeasonNumber}-players.csv`,
    playersCsv,
  );

  // File 2: clans
  const allClans: Clan[] = [];
  let cKey: Record<string, unknown> | undefined;
  do {
    const r = await scan<Clan>('clans', { exclusiveStartKey: cKey });
    allClans.push(...r.items);
    cKey = r.lastEvaluatedKey;
  } while (cKey);

  const clansCsv = buildCsv(
    ['clanId', 'seasonXp', 'spacesCaptured', 'todayParticipants'],
    allClans as unknown as Array<Record<string, unknown>>,
  );
  urls.clans = await uploadAndSign(
    `${prefix}season-${currentSeasonNumber}-clans.csv`,
    clansCsv,
  );

  // File 3: captured spaces for this season only
  const allCaptures: CapturedSpace[] = [];
  let csKey: Record<string, unknown> | undefined;
  do {
    const r = await scan<CapturedSpace>('captured-spaces', {
      filterExpression: '#s = :season',
      expressionNames: { '#s': 'season' },
      expressionValues: { ':season': String(currentSeasonNumber) },
      exclusiveStartKey: csKey,
    });
    allCaptures.push(...r.items);
    csKey = r.lastEvaluatedKey;
  } while (csKey);

  const capturesCsv = buildCsv(
    ['spaceId', 'dateCaptured', 'clan', 'spaceName', 'mapOverlayId'],
    allCaptures as unknown as Array<Record<string, unknown>>,
  );
  urls.captures = await uploadAndSign(
    `${prefix}season-${currentSeasonNumber}-captures.csv`,
    capturesCsv,
  );

  // File 4: checkins (all columns present in the type)
  const checkinHeaders = [
    'checkInId', 'userId', 'clanId', 'gpsLat', 'gpsLng', 'pixelX', 'pixelY',
    'pixelAvailable', 'activityCategory', 'satisfaction', 'sentiment', 'floor',
    'durationMinutes', 'activityTime', 'timestamp', 'date',
  ];
  const allCheckins: CheckIn[] = [];
  let ciKey: Record<string, unknown> | undefined;
  do {
    const r = await scan<CheckIn>('checkins', { exclusiveStartKey: ciKey });
    allCheckins.push(...r.items);
    ciKey = r.lastEvaluatedKey;
  } while (ciKey);

  const checkinsCsv = buildCsv(
    checkinHeaders,
    allCheckins as unknown as Array<Record<string, unknown>>,
  );
  urls.checkins = await uploadAndSign(
    `${prefix}season-${currentSeasonNumber}-checkins.csv`,
    checkinsCsv,
  );

  // File 5: game-sessions (key analytical columns)
  const sessionHeaders = [
    'sessionId', 'userId', 'locationId', 'date', 'result', 'xpEarned',
    'minigameId', 'startedAt', 'completedAt', 'chestDropped', 'coopPartnerId', 'practiceSession',
  ];
  const allSessions: GameSession[] = [];
  let gsKey: Record<string, unknown> | undefined;
  do {
    const r = await scan<GameSession>('game-sessions', { exclusiveStartKey: gsKey });
    allSessions.push(...r.items);
    gsKey = r.lastEvaluatedKey;
  } while (gsKey);

  const sessionsCsv = buildCsv(
    sessionHeaders,
    allSessions as unknown as Array<Record<string, unknown>>,
  );
  urls.sessions = await uploadAndSign(
    `${prefix}season-${currentSeasonNumber}-sessions.csv`,
    sessionsCsv,
  );

  return urls;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // Validate input
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const parsed = seasonResetSchema.safeParse(body);
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }
    const { resetTerritories, newSeasonNumber } = parsed.data;

    // Read season-meta upfront — needed for validation and export naming
    const existingMeta = await getItem<Record<string, unknown>>(
      'daily-config',
      { date: 'season-meta' },
    );
    const currentSeasonNumber = (existingMeta?.seasonNumber as number | undefined) ?? 1;

    if (newSeasonNumber < currentSeasonNumber || newSeasonNumber > currentSeasonNumber + 1) {
      return error(
        ErrorCode.VALIDATION_ERROR,
        `newSeasonNumber must be ${currentSeasonNumber} (restart) or ${currentSeasonNumber + 1} (new season). Got ${newSeasonNumber}.`,
        400,
      );
    }

    const today = getTodayISTString();
    const stepErrors: string[] = [];
    let usersReset = 0;

    // ── STEP 0: PRE-WIPE EXPORT ─────────────────────────────────────────────
    let exportUrls: Record<string, string> = {};
    try {
      exportUrls = await runExport(currentSeasonNumber);
      console.log('[Step 0] Export complete:', Object.keys(exportUrls).join(', '));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Step 0] Pre-wipe export failed:', msg);
      stepErrors.push(`Step 0 (export): ${msg}`);
    }

    // ── STEP 1: RESET USER RECORDS ──────────────────────────────────────────
    try {
      let lastUserKey: Record<string, unknown> | undefined;
      do {
        const result = await scan<User>('users', { exclusiveStartKey: lastUserKey });
        lastUserKey = result.lastEvaluatedKey;

        for (let i = 0; i < result.items.length; i += 25) {
          const chunk = result.items.slice(i, i + 25);
          await Promise.all(chunk.map(user =>
            updateItem(
              'users',
              { userId: user.userId },
              'SET seasonXp = :zero, todayXp = :zero, currentStreak = :zero, bestStreak = :zero, totalWins = :zero',
              { ':zero': 0 },
            ),
          ));
          usersReset += chunk.length;
        }
      } while (lastUserKey);
      console.log(`[Step 1] Reset ${usersReset} users`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Step 1] User reset failed:', msg);
      stepErrors.push(`Step 1 (users): ${msg}`);
    }

    // ── STEP 2: RESET CLAN RECORDS ──────────────────────────────────────────
    let clansReset = 0;
    try {
      let lastClanKey: Record<string, unknown> | undefined;
      do {
        const result = await scan<Clan>('clans', { exclusiveStartKey: lastClanKey });
        lastClanKey = result.lastEvaluatedKey;
        for (const clan of result.items) {
          await updateItem(
            'clans',
            { clanId: clan.clanId },
            'SET seasonXp = :zero, todayXp = :zero, spacesCaptured = :zero, todayParticipants = :zero REMOVE todayXpTimestamp',
            { ':zero': 0 },
          );
          clansReset++;
        }
      } while (lastClanKey);
      console.log(`[Step 2] Reset ${clansReset} clans`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Step 2] Clan reset failed:', msg);
      stepErrors.push(`Step 2 (clans): ${msg}`);
    }

    // ── STEP 3: HANDLE CAPTURED SPACES (conditional) ────────────────────────
    let territoriesHandled = 0;
    if (resetTerritories) {
      const isSameSeasonRestart = newSeasonNumber === currentSeasonNumber;
      try {
        let lastSpaceKey: Record<string, unknown> | undefined;
        do {
          const result = await scan<CapturedSpace>('captured-spaces', {
            exclusiveStartKey: lastSpaceKey,
          });
          lastSpaceKey = result.lastEvaluatedKey;
          for (const space of result.items) {
            if (space.season === String(currentSeasonNumber)) {
              if (isSameSeasonRestart) {
                // Same-season restart: delete the row outright
                await deleteItem('captured-spaces', { spaceId: space.spaceId });
              } else {
                // New season: relabel to previous season for archival
                await updateItem(
                  'captured-spaces',
                  { spaceId: space.spaceId },
                  'SET #s = :prevSeason',
                  { ':prevSeason': String(newSeasonNumber - 1) },
                  { '#s': 'season' },
                );
              }
              territoriesHandled++;
            }
          }
        } while (lastSpaceKey);
        console.log(`[Step 3] ${isSameSeasonRestart ? 'Deleted' : 'Archived'} ${territoriesHandled} territories`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[Step 3] Territory handling failed:', msg);
        stepErrors.push(`Step 3 (territories): ${msg}`);
      }
    }

    // ── STEP 4: DELETE player-assignments ───────────────────────────────────
    try {
      const n = await batchDeleteTable('player-assignments', 'dateUserId');
      console.log(`[Step 4] Deleted ${n} player-assignments`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Step 4] player-assignments delete failed:', msg);
      stepErrors.push(`Step 4 (player-assignments): ${msg}`);
    }

    // ── STEP 5: DELETE game-sessions ────────────────────────────────────────
    try {
      const n = await batchDeleteTable('game-sessions', 'sessionId');
      console.log(`[Step 5] Deleted ${n} game-sessions`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Step 5] game-sessions delete failed:', msg);
      stepErrors.push(`Step 5 (game-sessions): ${msg}`);
    }

    // ── STEP 6: DELETE player-locks ─────────────────────────────────────────
    try {
      const n = await batchDeleteTable('player-locks', 'dateUserLocation');
      console.log(`[Step 6] Deleted ${n} player-locks`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Step 6] player-locks delete failed:', msg);
      stepErrors.push(`Step 6 (player-locks): ${msg}`);
    }

    // ── STEP 7: DELETE space-decorations ────────────────────────────────────
    try {
      const n = await batchDeleteTable('space-decorations', 'userSpaceId');
      console.log(`[Step 7] Deleted ${n} space-decorations`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Step 7] space-decorations delete failed:', msg);
      stepErrors.push(`Step 7 (space-decorations): ${msg}`);
    }

    // ── STEP 8: DELETE player-assets ────────────────────────────────────────
    try {
      const n = await batchDeleteTable('player-assets', 'userAssetId');
      console.log(`[Step 8] Deleted ${n} player-assets`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Step 8] player-assets delete failed:', msg);
      stepErrors.push(`Step 8 (player-assets): ${msg}`);
    }

    // ── STEP 9: DELETE checkins ──────────────────────────────────────────────
    try {
      const n = await batchDeleteTable('checkins', 'checkInId');
      console.log(`[Step 9] Deleted ${n} checkins`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Step 9] checkins delete failed:', msg);
      stepErrors.push(`Step 9 (checkins): ${msg}`);
    }

    // ── STEP 10: UPDATE SEASON META ─────────────────────────────────────────
    try {
      // Call A: Close old season with conditional — skip if already closed or missing
      if (existingMeta) {
        try {
          await updateItem(
            'daily-config',
            { date: 'season-meta' },
            'SET seasonEndDate = :endDate, seasonStatus = :complete',
            { ':endDate': today, ':complete': 'complete' },
            undefined,
            'attribute_not_exists(seasonEndDate)',
          );
        } catch (condErr: unknown) {
          if (
            !(condErr instanceof Error &&
              condErr.name === 'ConditionalCheckFailedException')
          ) {
            throw condErr;
          }
          // Already had a seasonEndDate — no action needed
        }
      }

      // Call B: Open new season on the same record (updateItem creates if missing)
      await updateItem(
        'daily-config',
        { date: 'season-meta' },
        'SET seasonNumber = :new, seasonStatus = :active, seasonStartDate = :today, totalPlayers = :total REMOVE seasonEndDate',
        {
          ':new': newSeasonNumber,
          ':active': 'active',
          ':today': today,
          ':total': usersReset,
        },
      );
      console.log(`[Step 10] Season meta updated — now season ${newSeasonNumber}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Step 10] Season meta update failed:', msg);
      stepErrors.push(`Step 10 (season-meta): ${msg}`);
    }

    // ── STEP 11: RETURN RESPONSE ─────────────────────────────────────────────
    return success({
      message: `Season ${newSeasonNumber} started.`,
      exportUrls,
      stepErrors,
    });
  } catch (err) {
    console.error('seasonReset error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
