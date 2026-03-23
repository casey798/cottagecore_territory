import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, getItem } from '../../shared/db';
import type { User, Clan, CapturedSpace, GameSession, CheckIn } from '../../shared/types';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const BUCKET = process.env.ASSETS_BUCKET!;
const PRESIGNED_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

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

export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // Read current season number from season-meta
    const meta = await getItem<Record<string, unknown>>(
      'daily-config',
      { date: 'season-meta' },
    );
    const currentSeasonNumber = (meta?.seasonNumber as number | undefined) ?? 1;

    const prefix = `season-archives/season-${currentSeasonNumber}/`;
    const exportUrls: Record<string, string> = {};

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
    exportUrls.players = await uploadAndSign(
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
    exportUrls.clans = await uploadAndSign(
      `${prefix}season-${currentSeasonNumber}-clans.csv`,
      clansCsv,
    );

    // File 3: captured spaces for current season only
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
    exportUrls.captures = await uploadAndSign(
      `${prefix}season-${currentSeasonNumber}-captures.csv`,
      capturesCsv,
    );

    // File 4: checkins (all columns from CheckIn type)
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
    exportUrls.checkins = await uploadAndSign(
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
    exportUrls.sessions = await uploadAndSign(
      `${prefix}season-${currentSeasonNumber}-sessions.csv`,
      sessionsCsv,
    );

    console.log(`seasonExport: exported season ${currentSeasonNumber} data`);
    return success({ exportUrls });
  } catch (err) {
    console.error('seasonExport error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
