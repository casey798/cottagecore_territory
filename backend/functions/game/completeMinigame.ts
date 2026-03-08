import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import crypto from 'crypto';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem, updateItem, query, scan } from '../../shared/db';
import { verifyCompletionHash } from '../../shared/hmac';
import { validateSolution } from '../../shared/minigames';
import { success, error, ErrorCode } from '../../shared/response';
import { completeMinigameSchema } from '../../shared/schemas';
import { getTodayISTString, getMidnightISTAsISO, getNext8amISTEpochSeconds } from '../../shared/time';
import { broadcastScoreUpdate } from '../websocket/broadcast';
import {
  AssetCatalog,
  AssetObtainedFrom,
  ChestDrop,
  GameResult,
  GameSession,
  Location,
  PlayerAsset,
  PlayerLock,
  User,
} from '../../shared/types';

const XP_PER_WIN = 25;
const COOLDOWN_MS = 300000; // 5 minutes
const RATE_LIMIT_MS = 240000; // 4 minutes
const BASE_CHEST_DROP_RATE = 0.15;
const TIME_GRACE_SECONDS = 5;
const MIN_COMPLETION_SECONDS = 5;

async function selectWeightedRandomAsset(): Promise<AssetCatalog | null> {
  const { items: catalog } = await scan<AssetCatalog>('asset-catalog');
  if (catalog.length === 0) return null;

  const totalWeight = catalog.reduce((sum, item) => sum + item.dropWeight, 0);
  let random = Math.random() * totalWeight;

  for (const item of catalog) {
    random -= item.dropWeight;
    if (random <= 0) return item;
  }

  return catalog[catalog.length - 1];
}

async function awardXpAndStreak(
  userId: string,
  today: string
): Promise<{ newTodayXp: number; clan: string }> {
  // Award 25 XP using ADD expression for atomic increment
  const updatedUser = await updateItem(
    'users',
    { userId },
    'ADD todayXp :xp, seasonXp :xp, totalWins :one',
    { ':xp': XP_PER_WIN, ':one': 1 }
  );

  const newTodayXp = (updatedUser?.todayXp as number) ?? 0;

  // Get full user for streak check
  const user = await getItem<User>('users', { userId });
  if (user && user.lastActiveDate !== today) {
    const newStreak = (user.lastActiveDate ? user.currentStreak : 0) + 1;
    const newBest = Math.max(newStreak, user.bestStreak);
    await updateItem(
      'users',
      { userId },
      'SET lastActiveDate = :today, currentStreak = :streak, bestStreak = :best',
      { ':today': today, ':streak': newStreak, ':best': newBest }
    );
  }

  return { newTodayXp, clan: user?.clan ?? '' };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const parsed = completeMinigameSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { sessionId, result, completionHash, solutionData } = parsed.data;

    // 1. Session exists and belongs to user
    const session = await getItem<GameSession>('game-sessions', { sessionId });
    if (!session || session.userId !== userId) {
      return error(ErrorCode.SESSION_NOT_FOUND, 'Game session not found', 404);
    }

    // 2. Session not already completed
    if (session.completedAt !== null) {
      return error(ErrorCode.SESSION_COMPLETED, 'Session has already been completed', 400);
    }

    // 3. Verify completion hash
    const salt = session._salt;
    if (!salt || !verifyCompletionHash(completionHash, sessionId, userId, result, salt)) {
      return error(ErrorCode.INVALID_HASH, 'Invalid completion hash', 400);
    }

    // 4 & 5. Time validation
    const startedAtMs = new Date(session.startedAt).getTime();
    const nowMs = Date.now();
    const elapsedSeconds = (nowMs - startedAtMs) / 1000;
    const timeLimit = session.timeLimit || 120;

    if (elapsedSeconds > timeLimit + TIME_GRACE_SECONDS) {
      return error(ErrorCode.SUSPICIOUS_TIME, 'Completion time exceeds allowed limit', 400);
    }

    if (elapsedSeconds < MIN_COMPLETION_SECONDS) {
      return error(ErrorCode.SUSPICIOUS_TIME, 'Completion time is suspiciously fast', 400);
    }

    // 6. Rate limit: last completion was >= 4 minutes ago
    const today = getTodayISTString();
    const { items: todaySessions } = await query<GameSession>(
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

    const completedSessions = todaySessions
      .filter((s) => s.completedAt && s.sessionId !== sessionId)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

    if (completedSessions.length > 0) {
      const lastCompletedMs = new Date(completedSessions[0].completedAt!).getTime();
      if (nowMs - lastCompletedMs < RATE_LIMIT_MS) {
        return error(ErrorCode.RATE_LIMITED, 'Please wait before completing another game', 429);
      }
    }

    // 7. Validate solution
    if (session.puzzleData) {
      const solutionValid = validateSolution(session.puzzleData, solutionData);
      if (!solutionValid && result === GameResult.Win) {
        return error(ErrorCode.VALIDATION_ERROR, 'Invalid solution', 400);
      }
    }

    const now = new Date().toISOString();
    const gameResult = result as GameResult;

    if (gameResult === GameResult.Win) {
      // --- WIN PATH ---

      // 1. Award XP and update streak for player
      const { newTodayXp, clan: clanId } = await awardXpAndStreak(userId, today);

      // 2. Atomic clan XP (ADD expression + SET timestamp)
      let clanTodayXp = 0;
      if (clanId) {
        const updatedClan = await updateItem(
          'clans',
          { clanId },
          'SET todayXpTimestamp = :ts ADD todayXp :xp',
          { ':ts': now, ':xp': XP_PER_WIN }
        );
        clanTodayXp = (updatedClan?.todayXp as number) ?? 0;
      }

      // 3 & 4. Chest drop
      const location = await getItem<Location>('locations', { locationId: session.locationId });
      const chestDropModifier = location?.chestDropModifier ?? 1;
      const chestDropped = Math.random() < BASE_CHEST_DROP_RATE * chestDropModifier;

      let chestDrop: ChestDrop = { dropped: false };
      let chestAssetId: string | null = null;

      if (chestDropped) {
        const asset = await selectWeightedRandomAsset();
        if (asset) {
          const userAssetId = crypto.randomUUID();
          chestAssetId = asset.assetId;

          const playerAsset: PlayerAsset = {
            userAssetId,
            userId,
            assetId: asset.assetId,
            obtainedAt: now,
            obtainedFrom: AssetObtainedFrom.Chest,
            locationId: session.locationId,
            placed: false,
            expiresAt: getMidnightISTAsISO(),
            expired: false,
          };

          await putItem('player-assets', playerAsset as unknown as Record<string, unknown>);

          chestDrop = {
            dropped: true,
            asset: {
              assetId: asset.assetId,
              name: asset.name,
              category: asset.category,
              rarity: asset.rarity,
              imageKey: asset.imageKey,
            },
          };
        }
      }

      // 6. Co-op: repeat XP/streak for partner (single chest roll)
      if (session.coopPartnerId) {
        await awardXpAndStreak(session.coopPartnerId, today);
        // Atomic clan XP for partner (same clan, so same clanId)
        if (clanId) {
          const updatedClan = await updateItem(
            'clans',
            { clanId },
            'SET todayXpTimestamp = :ts ADD todayXp :xp',
            { ':ts': now, ':xp': XP_PER_WIN }
          );
          clanTodayXp = (updatedClan?.todayXp as number) ?? 0;
        }
      }

      // 7. Update session
      await updateItem(
        'game-sessions',
        { sessionId },
        'SET completedAt = :completedAt, #r = :result, xpEarned = :xp, chestDropped = :chest, chestAssetId = :chestId, completionHash = :hash',
        {
          ':completedAt': now,
          ':result': GameResult.Win,
          ':xp': XP_PER_WIN,
          ':chest': chestDropped,
          ':chestId': chestAssetId,
          ':hash': completionHash,
        },
        { '#r': 'result' }
      );

      // 8. Cooldown
      const cooldownEndsAt = new Date(Date.now() + COOLDOWN_MS).toISOString();

      // 9. WebSocket broadcast (non-fatal)
      const stage = process.env.STAGE || 'dev';
      await broadcastScoreUpdate(stage);

      return success({
        result: GameResult.Win,
        xpEarned: XP_PER_WIN,
        newTodayXp,
        clanTodayXp,
        chestDrop,
        cooldownEndsAt,
      });
    } else {
      // --- LOSE PATH ---

      // 1. Create player-lock
      const dateUserLocation = `${today}#${userId}#${session.locationId}`;
      const ttl = getNext8amISTEpochSeconds();

      const playerLock: PlayerLock = {
        dateUserLocation,
        lockedAt: now,
        ttl,
      };

      await putItem('player-locks', playerLock as unknown as Record<string, unknown>);

      // 2. Update session
      await updateItem(
        'game-sessions',
        { sessionId },
        'SET completedAt = :completedAt, #r = :result, xpEarned = :xp, completionHash = :hash',
        {
          ':completedAt': now,
          ':result': GameResult.Lose,
          ':xp': 0,
          ':hash': completionHash,
        },
        { '#r': 'result' }
      );

      return success({
        result: GameResult.Lose,
        xpEarned: 0,
        locationLocked: true,
        chestDrop: { dropped: false },
      });
    }
  } catch (err) {
    console.error('completeMinigame error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
