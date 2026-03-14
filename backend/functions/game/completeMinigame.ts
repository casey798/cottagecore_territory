import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import crypto from 'crypto';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem, updateItem, query, scan } from '../../shared/db';
import { verifyCompletionHash, verifyClientCompletionHash } from '../../shared/hmac';
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
const DAILY_XP_CAP = 100;
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
): Promise<{ newTodayXp: number; clan: string; xpActuallyAwarded: boolean }> {
  // Award 25 XP using ADD expression with condition to prevent exceeding daily cap
  let xpActuallyAwarded = false;
  let newTodayXp = 0;

  try {
    const updatedUser = await updateItem(
      'users',
      { userId },
      'ADD todayXp :xp, seasonXp :xp, totalWins :one',
      { ':xp': XP_PER_WIN, ':one': 1, ':maxXp': DAILY_XP_CAP - XP_PER_WIN },
      undefined,
      'todayXp <= :maxXp'
    );
    newTodayXp = (updatedUser?.todayXp as number) ?? 0;
    xpActuallyAwarded = true;
  } catch (err: unknown) {
    // ConditionalCheckFailedException means todayXp + 25 > 100 — cap reached
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      const user = await getItem<User>('users', { userId });
      newTodayXp = user?.todayXp ?? 0;
      // Still count the win
      await updateItem('users', { userId }, 'ADD totalWins :one', { ':one': 1 });
    } else {
      throw err;
    }
  }

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

  return { newTodayXp, clan: user?.clan ?? '', xpActuallyAwarded };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const parsed = completeMinigameSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { sessionId, result, completionHash, timeTaken, solutionData } = parsed.data;

    // 1. Session exists and belongs to user
    const session = await getItem<GameSession>('game-sessions', { sessionId });
    if (!session || session.userId !== userId) {
      return error(ErrorCode.SESSION_NOT_FOUND, 'Game session not found', 404);
    }

    // 2. Session not already completed
    if (session.completedAt !== null) {
      return error(ErrorCode.SESSION_COMPLETED, 'Session has already been completed', 400);
    }

    // 3. Verify completion hash — try client-salt hash first, then server-salt hash
    const startedAtMs = new Date(session.startedAt).getTime();
    const nowMs = Date.now();
    const elapsedSeconds = Math.round((nowMs - startedAtMs) / 1000);

    let hashValid = false;

    // Try client-salt hash (sessionId:result:timeTaken with hardcoded salt)
    // Use the client-provided timeTaken directly for verification
    hashValid = verifyClientCompletionHash(completionHash, sessionId, result, timeTaken);

    // Fallback: try server-salt hash (legacy: sessionId:userId:result with per-session salt)
    if (!hashValid && session._salt) {
      hashValid = verifyCompletionHash(completionHash, sessionId, userId, result, session._salt);
    }

    if (!hashValid) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[DEV] completionHash check failed — sessionId:', sessionId, 'result:', result, 'timeTaken:', timeTaken);
      }
      return error(ErrorCode.INVALID_HASH, 'Invalid completion hash', 400);
    }

    // 4. Time validation — use server-side elapsed time for anti-cheat
    const timeLimit = session.timeLimit || 120;

    if (elapsedSeconds > timeLimit + TIME_GRACE_SECONDS) {
      return error(ErrorCode.SUSPICIOUS_TIME, 'Completion time exceeds allowed limit', 400);
    }

    if (elapsedSeconds < MIN_COMPLETION_SECONDS) {
      return error(ErrorCode.SUSPICIOUS_TIME, 'Completion time is suspiciously fast', 400);
    }

    // 5. Query today's sessions (needed for duplicate check and per-location XP cap)
    const today = getTodayISTString();
    let todaySessions: GameSession[] = [];
    if (result === GameResult.Win) {
      const queryResult = await query<GameSession>(
        'game-sessions',
        'userId = :uid AND #d = :date',
        { ':uid': userId, ':date': today },
        {
          indexName: 'UserDateIndex',
          expressionNames: { '#d': 'date' },
          scanIndexForward: false,
          limit: 50,
        }
      );
      todaySessions = queryResult.items;

      const alreadyWon = todaySessions.some(
        (s) =>
          s.sessionId !== sessionId &&
          s.locationId === session.locationId &&
          s.minigameId === session.minigameId &&
          s.result === GameResult.Win &&
          s.completedAt !== null,
      );

      if (alreadyWon) {
        return error(
          ErrorCode.MINIGAME_ALREADY_PLAYED,
          "You've already completed this challenge here today",
          400,
        );
      }
    }

    // No puzzle solution re-validation — solutionData is stored for analytics only.

    const now = new Date().toISOString();
    const gameResult = result as GameResult;

    if (gameResult === GameResult.Win) {
      // --- WIN PATH ---

      // Check if XP was already earned at this location today (per-location XP cap)
      const alreadyEarnedXpHere = todaySessions.some(
        (s) =>
          s.sessionId !== sessionId &&
          s.locationId === session.locationId &&
          s.result === GameResult.Win &&
          s.xpEarned > 0 &&
          s.completedAt !== null,
      );

      const shouldAwardXp = !alreadyEarnedXpHere;
      let xpToAward = 0;
      let newTodayXp = 0;
      let clanTodayXp = 0;
      let clanId = '';
      let capReached = false;
      let chestDrop: ChestDrop = { dropped: false };
      let chestAssetId: string | null = null;
      let chestDropped = false;

      if (shouldAwardXp) {
        // First win at this location — attempt full rewards (cap-safe)
        const xpResult = await awardXpAndStreak(userId, today);
        newTodayXp = xpResult.newTodayXp;
        clanId = xpResult.clan;
        xpToAward = xpResult.xpActuallyAwarded ? XP_PER_WIN : 0;
        capReached = !xpResult.xpActuallyAwarded;

        // Atomic clan XP (only if XP was actually awarded)
        if (clanId && xpToAward > 0) {
          const updatedClan = await updateItem(
            'clans',
            { clanId },
            'SET todayXpTimestamp = :ts ADD todayXp :xp',
            { ':ts': now, ':xp': XP_PER_WIN }
          );
          clanTodayXp = (updatedClan?.todayXp as number) ?? 0;
        }

        // Chest drop (only if XP was actually awarded)
        if (xpToAward > 0) {
          const location = await getItem<Location>('locations', { locationId: session.locationId });
          const chestDropModifier = location?.chestDropModifier ?? 1;
          chestDropped = Math.random() < BASE_CHEST_DROP_RATE * chestDropModifier;

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
        }

        // Co-op: repeat XP/streak for partner
        if (session.coopPartnerId) {
          const coopResult = await awardXpAndStreak(session.coopPartnerId, today);
          if (clanId && coopResult.xpActuallyAwarded) {
            const updatedClan = await updateItem(
              'clans',
              { clanId },
              'SET todayXpTimestamp = :ts ADD todayXp :xp',
              { ':ts': now, ':xp': XP_PER_WIN }
            );
            clanTodayXp = (updatedClan?.todayXp as number) ?? 0;
          }
        }
      } else {
        // Already earned XP here — just get current user XP for response
        const user = await getItem<User>('users', { userId });
        newTodayXp = user?.todayXp ?? 0;
        clanId = user?.clan ?? '';
        capReached = newTodayXp >= DAILY_XP_CAP;
      }

      // Update session (store solutionData for analytics)
      await updateItem(
        'game-sessions',
        { sessionId },
        'SET completedAt = :completedAt, #r = :result, xpEarned = :xp, chestDropped = :chest, chestAssetId = :chestId, completionHash = :hash, solutionData = :sd',
        {
          ':completedAt': now,
          ':result': GameResult.Win,
          ':xp': xpToAward,
          ':chest': chestDropped,
          ':chestId': chestAssetId,
          ':hash': completionHash,
          ':sd': solutionData ?? {},
        },
        { '#r': 'result' }
      );

      // WebSocket broadcast (non-fatal)
      if (xpToAward > 0) {
        const stage = process.env.STAGE || 'dev';
        await broadcastScoreUpdate(stage);
      }

      return success({
        result: GameResult.Win,
        xpEarned: xpToAward,
        xpAwarded: xpToAward > 0,
        newTodayXp,
        clanTodayXp,
        chestDrop,
        capReached,
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
        'SET completedAt = :completedAt, #r = :result, xpEarned = :xp, completionHash = :hash, solutionData = :sd',
        {
          ':completedAt': now,
          ':result': GameResult.Lose,
          ':xp': 0,
          ':hash': completionHash,
          ':sd': solutionData ?? {},
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
