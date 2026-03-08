import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem, query } from '../../shared/db';
import { isWithinGeofence } from '../../shared/geo';
import { verifyQrPayload } from '../../shared/hmac';
import { success, error, ErrorCode } from '../../shared/response';
import { scanQrSchema } from '../../shared/schemas';
import { getTodayISTString } from '../../shared/time';
import { MINIGAME_POOL } from '../../shared/minigames';
import {
  DailyConfig,
  Location,
  PlayerAssignment,
  PlayerLock,
  User,
  GameSession,
  AvailableMinigame,
} from '../../shared/types';

const DAILY_XP_CAP = 100;
const COOLDOWN_MS = 300000; // 5 minutes

function pickRandomMinigames(
  count: number,
  excludeIds: string[]
): AvailableMinigame[] {
  const pool = Object.entries(MINIGAME_POOL)
    .filter(([id]) => !excludeIds.includes(id))
    .map(([id, meta]) => ({
      minigameId: id,
      name: meta.name,
      timeLimit: meta.timeLimit,
      description: meta.description,
    }));

  const shuffled = pool.sort(() => Math.random() - 0.5);
  const available = Math.min(count, shuffled.length);
  return shuffled.slice(0, Math.max(available, 3));
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const parsed = scanQrSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { qrData, gpsLat, gpsLng } = parsed.data;
    const today = getTodayISTString();

    // Step 1: Check QR date matches today
    if (qrData.d !== today) {
      return error(ErrorCode.QR_EXPIRED, 'QR code has expired', 400);
    }

    // Step 2: Verify HMAC using daily config's qrSecret
    const dailyConfig = await getItem<DailyConfig>('daily-config', { date: today });
    if (!dailyConfig) {
      return error(ErrorCode.GAME_INACTIVE, 'No daily config found for today', 400);
    }

    const stage = process.env.STAGE || 'dev';
    const isDevBypass = stage === 'dev' && qrData.h === 'dev-bypass';
    if (!isDevBypass && !verifyQrPayload(qrData, dailyConfig.qrSecret)) {
      return error(ErrorCode.QR_INVALID, 'Invalid QR code', 400);
    }

    const locationId = qrData.l;

    // Step 3: GPS within geofence
    const location = await getItem<Location>('locations', { locationId });
    if (!location) {
      return error(ErrorCode.NOT_FOUND, 'Location not found', 400);
    }

    if (!isDevBypass && !isWithinGeofence(gpsLat, gpsLng, location.gpsLat, location.gpsLng, location.geofenceRadius)) {
      return error(ErrorCode.GPS_OUT_OF_RANGE, 'You are not close enough to this location', 400);
    }

    // Step 4: Location in player's assigned set
    const dateUserId = `${today}#${userId}`;
    const assignment = await getItem<PlayerAssignment>('player-assignments', { dateUserId });
    if (!assignment || !assignment.assignedLocationIds.includes(locationId)) {
      // Dev bypass: fall back to checking daily-config activeLocationIds
      if (isDevBypass && dailyConfig.activeLocationIds.includes(locationId)) {
        console.log(`[scanQR] Dev bypass: no assignment but location ${locationId} is in daily-config`);
      } else {
        return error(ErrorCode.NOT_ASSIGNED, 'You are not assigned to this location today', 400);
      }
    }

    // Step 5: Location locked
    const dateUserLocation = `${today}#${userId}#${locationId}`;
    const lock = await getItem<PlayerLock>('player-locks', { dateUserLocation });
    if (lock) {
      return error(ErrorCode.LOCATION_LOCKED, 'This location is locked for you until tomorrow', 403);
    }

    // Step 6: Daily cap reached
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 400);
    }

    if (user.todayXp >= DAILY_XP_CAP) {
      return error(ErrorCode.DAILY_CAP_REACHED, 'You have reached the daily XP cap', 403);
    }

    // Step 7: On cooldown
    const { items: recentSessions } = await query<GameSession>(
      'game-sessions',
      'userId = :uid AND #d = :date',
      { ':uid': userId, ':date': today },
      {
        indexName: 'UserDateIndex',
        expressionNames: { '#d': 'date' },
        scanIndexForward: false,
        limit: 10,
      }
    );

    if (recentSessions.length > 0) {
      // Find sessions with completedAt, sort desc
      const completedSessions = recentSessions
        .filter((s) => s.completedAt)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

      if (completedSessions.length > 0) {
        const lastSession = completedSessions[0];
        const completedTime = new Date(lastSession.completedAt!).getTime();
        const now = Date.now();
        if (now - completedTime < COOLDOWN_MS) {
          const cooldownEndsAt = new Date(completedTime + COOLDOWN_MS).toISOString();
          return error(ErrorCode.ON_COOLDOWN, `On cooldown until ${cooldownEndsAt}`, 429);
        }
      }
    }

    // Exclude minigames already played at this location today
    const playedAtLocation = recentSessions
      .filter((s) => s.locationId === locationId)
      .map((s) => s.minigameId);

    // Success: pick 3-5 random minigames
    const count = Math.floor(Math.random() * 3) + 3; // 3, 4, or 5
    const availableMinigames = pickRandomMinigames(count, playedAtLocation);

    return success({
      locationId,
      locationName: location.name,
      availableMinigames,
    });
  } catch (err) {
    console.error('scanQR error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
