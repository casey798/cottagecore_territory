import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import crypto from 'crypto';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem, updateItem, query } from '../../shared/db';
import { verifyCompletionHash, verifyClientCompletionHash } from '../../shared/hmac';
import { success, error, ErrorCode } from '../../shared/response';
import { completeMinigameSchema } from '../../shared/schemas';
import { getTodayISTString, getMidnightISTAsISO } from '../../shared/time';
import { LOCK_DURATION_MS } from '../../shared/constants';
import { isQuietModeActive } from '../../shared/quietMode';
import { broadcastScoreUpdate } from '../websocket/broadcast';
import { sendToPlayer } from '../../shared/notifications';
import {
  applyTap as pipsApplyTap,
  isSolved as pipsIsSolved,
  type Grid as PipsGrid,
} from '../../shared/minigames/pipsGenerator';
import { MINIGAME_META, CHEST_RARITY_WEIGHTS, rollRarityTier } from '../../shared/minigames';
import { puzzleLibrary } from './mosaic/puzzleLibrary';
import { validateSolution as validateMosaicSolution } from './mosaic/mosaicLogic';
import { validateSubmission as validatePathWeaverSubmission } from '../../shared/minigames/pathWeaverGenerator';
import { validateSolution as validateGroveEquationsSolution } from '../../shared/minigames/groveEquationsGenerator';
import { validateAnswers as validateBloomSequenceAnswers, type Round as BloomSequenceRound } from '../../shared/minigames/bloomSequenceGenerator';
import { validatePotionLogicSubmission, type PotionLogicSolution } from '../../shared/minigames/potionLogicGenerator';
import type { MosaicTilePlacement } from '../../shared/types';
import {
  AssetCategory,
  AssetObtainedFrom,
  ChestDrop,
  GameResult,
  GameSession,
  PlayerAsset,
  PlayerLock,
  Rarity,
  User,
} from '../../shared/types';

const XP_PER_WIN = 25;
const DAILY_XP_CAP = 100;
const TIME_GRACE_SECONDS = 5;
const MIN_COMPLETION_SECONDS = 5;

// SYNC: keep this in sync with mobile/src/constants/assets.ts DECORATION_ASSETS
interface AssetPoolEntry {
  id: string;
  name: string;
  category: AssetCategory;
  rarity: Rarity;
  dropWeight: number;
  clanLocked?: string;
}

const ASSET_POOL: AssetPoolEntry[] = [
  { id: 'banner_ember',       name: 'Ember Banner',       category: AssetCategory.Banner,    rarity: Rarity.Common,    dropWeight: 30, clanLocked: 'ember'  },
  { id: 'banner_bloom',       name: 'Bloom Banner',       category: AssetCategory.Banner,    rarity: Rarity.Common,    dropWeight: 30, clanLocked: 'bloom'  },
  { id: 'banner_tide',        name: 'Tide Banner',        category: AssetCategory.Banner,    rarity: Rarity.Common,    dropWeight: 30, clanLocked: 'tide'   },
  { id: 'banner_gale',        name: 'Gale Banner',        category: AssetCategory.Banner,    rarity: Rarity.Common,    dropWeight: 30, clanLocked: 'gale'   },
  { id: 'banner_hearth',      name: 'Hearth Banner',      category: AssetCategory.Banner,    rarity: Rarity.Common,    dropWeight: 30, clanLocked: 'hearth' },
  { id: 'statue_fox',         name: 'Stone Fox',          category: AssetCategory.Statue,    rarity: Rarity.Uncommon,  dropWeight: 15 },
  { id: 'statue_owl',         name: 'Mossy Owl',          category: AssetCategory.Statue,    rarity: Rarity.Uncommon,  dropWeight: 15 },
  { id: 'statue_frog',        name: 'Frog on Lily Pad',   category: AssetCategory.Statue,    rarity: Rarity.Uncommon,  dropWeight: 15 },
  { id: 'statue_gnome',       name: 'Garden Gnome',       category: AssetCategory.Statue,    rarity: Rarity.Uncommon,  dropWeight: 15 },
  { id: 'statue_birdbath',    name: 'Bird Bath',          category: AssetCategory.Statue,    rarity: Rarity.Uncommon,  dropWeight: 15 },
  { id: 'statue_mushroom',    name: 'Mushroom Totem',     category: AssetCategory.Statue,    rarity: Rarity.Uncommon,  dropWeight: 15 },
  { id: 'furn_bench',         name: 'Wooden Bench',       category: AssetCategory.Furniture, rarity: Rarity.Common,    dropWeight: 25 },
  { id: 'furn_archway',       name: 'Vine Archway',       category: AssetCategory.Furniture, rarity: Rarity.Common,    dropWeight: 25 },
  { id: 'furn_lantern',       name: 'Lantern Post',       category: AssetCategory.Furniture, rarity: Rarity.Common,    dropWeight: 25 },
  { id: 'furn_flowercart',    name: 'Flower Cart',        category: AssetCategory.Furniture, rarity: Rarity.Common,    dropWeight: 25 },
  { id: 'furn_table',         name: 'Potting Table',      category: AssetCategory.Furniture, rarity: Rarity.Common,    dropWeight: 25 },
  { id: 'furn_books',         name: 'Reading Nook',       category: AssetCategory.Furniture, rarity: Rarity.Common,    dropWeight: 25 },
  { id: 'furn_picnic',        name: 'Picnic Blanket',     category: AssetCategory.Furniture, rarity: Rarity.Common,    dropWeight: 25 },
  { id: 'mural_1',            name: 'Vine Mural',         category: AssetCategory.Mural,     rarity: Rarity.Rare,      dropWeight: 8  },
  { id: 'mural_2',            name: 'Cottage Scene',      category: AssetCategory.Mural,     rarity: Rarity.Rare,      dropWeight: 8  },
  { id: 'mural_3',            name: 'Garden Path',        category: AssetCategory.Mural,     rarity: Rarity.Rare,      dropWeight: 8  },
  { id: 'mural_4',            name: 'Starry Night',       category: AssetCategory.Mural,     rarity: Rarity.Rare,      dropWeight: 8  },
  { id: 'pet_cat',            name: 'Pixel Cat',          category: AssetCategory.Pet,       rarity: Rarity.Rare,      dropWeight: 6  },
  { id: 'pet_fox',            name: 'Baby Fox',           category: AssetCategory.Pet,       rarity: Rarity.Rare,      dropWeight: 6  },
  { id: 'pet_hedgehog',       name: 'Hedgehog',           category: AssetCategory.Pet,       rarity: Rarity.Rare,      dropWeight: 6  },
  { id: 'pet_robin',          name: 'Robin',              category: AssetCategory.Pet,       rarity: Rarity.Rare,      dropWeight: 6  },
  { id: 'pet_butterfly',      name: 'Butterfly',          category: AssetCategory.Pet,       rarity: Rarity.Rare,      dropWeight: 6  },
  { id: 'special_tree',       name: 'Ancient Banyan',     category: AssetCategory.Special,   rarity: Rarity.Legendary, dropWeight: 2  },
  { id: 'special_champion',   name: 'Warrior Statue',     category: AssetCategory.Special,   rarity: Rarity.Legendary, dropWeight: 2  },
  { id: 'special_trophy',     name: 'Golden Trophy',      category: AssetCategory.Special,   rarity: Rarity.Legendary, dropWeight: 2  },
  { id: 'special_fountain',   name: 'Crystal Fountain',   category: AssetCategory.Special,   rarity: Rarity.Legendary, dropWeight: 2  },
];

function pickAssetForClan(
  playerClan: string,
  minigameId: string,
  isCoop: boolean
): AssetPoolEntry {
  const meta = MINIGAME_META[minigameId];
  const difficulty = meta?.difficulty ?? 'easy';
  const mode = isCoop ? 'coop' : 'solo';
  const weights = CHEST_RARITY_WEIGHTS[difficulty][mode];
  const rarity = rollRarityTier(weights);

  const pool = ASSET_POOL.filter(
    a => (a.rarity as string) === rarity && (!a.clanLocked || a.clanLocked === playerClan)
  );

  // Fallback: if no assets exist for this rarity+clan combo, widen to any rarity
  const finalPool = pool.length > 0
    ? pool
    : ASSET_POOL.filter(a => !a.clanLocked || a.clanLocked === playerClan);

  const totalWeight = finalPool.reduce((sum, a) => sum + a.dropWeight, 0);
  let roll = Math.random() * totalWeight;
  for (const asset of finalPool) {
    roll -= asset.dropWeight;
    if (roll <= 0) return asset;
  }
  return finalPool[finalPool.length - 1];
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

    // 2b. Quiet mode check — cancel in-flight session cleanly
    if (await isQuietModeActive()) {
      const now = new Date().toISOString();
      await updateItem(
        'game-sessions',
        { sessionId },
        'SET completedAt = :completedAt, #r = :result, xpEarned = :xp, completionHash = :hash',
        {
          ':completedAt': now,
          ':result': GameResult.Abandoned,
          ':xp': 0,
          ':hash': completionHash,
        },
        { '#r': 'result' }
      );
      return error(
        ErrorCode.QUIET_MODE_ACTIVE,
        'Quiet mode was enabled during your session. No XP has been awarded.',
        403,
      );
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

    // 4b. Practice session — skip all competitive logic
    if (session.practiceSession) {
      const now = new Date().toISOString();
      await updateItem(
        'game-sessions',
        { sessionId },
        'SET completedAt = :completedAt, #r = :result, xpEarned = :xp, completionHash = :hash, solutionData = :sd',
        {
          ':completedAt': now,
          ':result': result,
          ':xp': 0,
          ':hash': completionHash,
          ':sd': solutionData ?? {},
        },
        { '#r': 'result' }
      );

      return success({
        result,
        xpEarned: 0,
        practiceMode: true,
      });
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

    // Pips puzzle solution validation
    if (session.minigameId === 'pips' && result === GameResult.Win) {
      const puzzleSolution = (session as unknown as Record<string, unknown>).puzzleSolution as
        | { solutionTaps: Array<{ row: number; col: number }>; startGrid: PipsGrid }
        | undefined;

      if (!puzzleSolution || !solutionData) {
        return error(ErrorCode.INVALID_HASH, 'Pips solution validation failed', 400);
      }

      const clientTaps = (solutionData as Record<string, unknown>).taps as
        | Array<{ row: number; col: number }>
        | undefined;
      const clientMovesUsed = (solutionData as Record<string, unknown>).movesUsed as
        | number
        | undefined;

      if (
        !clientTaps ||
        clientMovesUsed == null ||
        clientMovesUsed !== clientTaps.length ||
        clientMovesUsed < 1
      ) {
        return error(ErrorCode.INVALID_HASH, 'Pips solution validation failed', 400);
      }

      const sessionMoveLimit = (session as unknown as Record<string, unknown>).puzzleSolution
        ? puzzleSolution.solutionTaps.length + 3
        : 0;
      if (clientMovesUsed > sessionMoveLimit) {
        return error(ErrorCode.INVALID_HASH, 'Pips solution validation failed', 400);
      }

      // Replay client taps from startGrid and verify all cells OFF
      let replayGrid: PipsGrid = puzzleSolution.startGrid.map((r) => [...r]);
      for (const tap of clientTaps) {
        replayGrid = pipsApplyTap(replayGrid, tap.row, tap.col);
      }

      if (!pipsIsSolved(replayGrid)) {
        return error(ErrorCode.INVALID_HASH, 'Pips solution validation failed', 400);
      }
    }

    // Mosaic puzzle solution validation
    if (session.minigameId === 'mosaic' && result === GameResult.Win) {
      const puzzleId = (session as unknown as Record<string, unknown>).puzzleId as string | undefined;
      if (!puzzleId || !solutionData) {
        return error(ErrorCode.INVALID_HASH, 'Mosaic solution validation failed', 400);
      }

      const puzzle = puzzleLibrary.find(p => p.id === puzzleId);
      if (!puzzle) {
        return error(ErrorCode.INVALID_HASH, 'Mosaic puzzle not found', 400);
      }

      const clientPlacements = (solutionData as Record<string, unknown>).placements as
        | MosaicTilePlacement[]
        | undefined;

      if (!clientPlacements || !Array.isArray(clientPlacements)) {
        return error(ErrorCode.INVALID_HASH, 'Mosaic solution validation failed', 400);
      }

      if (!validateMosaicSolution(puzzle, clientPlacements)) {
        return error(ErrorCode.INVALID_HASH, 'Mosaic solution validation failed', 400);
      }
    }

    // Grove Equations puzzle solution validation
    if (session.minigameId === 'grove-equations' && result === GameResult.Win) {
      const puzzleSolution = (session as unknown as Record<string, unknown>).puzzleSolution as
        | { solution: string[]; numbers: number[]; target: number }
        | undefined;

      if (!puzzleSolution || !solutionData) {
        return error(ErrorCode.INVALID_HASH, 'Grove Equations solution validation failed', 400);
      }

      const clientOperators = (solutionData as Record<string, unknown>).operators as
        | string[]
        | undefined;

      if (!clientOperators || !Array.isArray(clientOperators) || clientOperators.length !== 3) {
        return error(ErrorCode.INVALID_HASH, 'Grove Equations solution validation failed', 400);
      }

      if (!validateGroveEquationsSolution(puzzleSolution.numbers, clientOperators as Parameters<typeof validateGroveEquationsSolution>[1], puzzleSolution.target)) {
        return error(ErrorCode.INVALID_HASH, 'Grove Equations solution validation failed', 400);
      }
    }

    // Bloom Sequence puzzle solution validation
    if (session.minigameId === 'bloom-sequence' && result === GameResult.Win) {
      const puzzleSolution = (session as unknown as Record<string, unknown>).puzzleSolution as
        | { rounds: BloomSequenceRound[] }
        | undefined;

      if (!puzzleSolution || !solutionData) {
        return error(ErrorCode.INVALID_HASH, 'Bloom Sequence solution validation failed', 400);
      }

      const clientAnswers = (solutionData as Record<string, unknown>).answers as
        | number[]
        | undefined;

      if (!clientAnswers || !Array.isArray(clientAnswers) || clientAnswers.length !== 3) {
        return error(ErrorCode.INVALID_HASH, 'Bloom Sequence solution validation failed', 400);
      }

      if (!validateBloomSequenceAnswers(puzzleSolution.rounds, clientAnswers)) {
        return error(ErrorCode.INVALID_HASH, 'Bloom Sequence solution validation failed', 400);
      }
    }

    // Path Weaver puzzle solution validation
    if (session.minigameId === 'path-weaver' && result === GameResult.Win) {
      const storedSolution = (session as unknown as Record<string, unknown>).puzzleSolution as
        | number[][]
        | undefined;

      if (!storedSolution || !solutionData) {
        return error(ErrorCode.INVALID_HASH, 'Path Weaver solution validation failed', 400);
      }

      const clientGrid = (solutionData as Record<string, unknown>).grid as
        | number[][]
        | undefined;

      if (!clientGrid || !Array.isArray(clientGrid)) {
        return error(ErrorCode.INVALID_HASH, 'Path Weaver solution validation failed', 400);
      }

      if (!validatePathWeaverSubmission(storedSolution, clientGrid)) {
        return error(ErrorCode.INVALID_HASH, 'Path Weaver solution validation failed', 400);
      }
    }

    // Shift & Slide puzzle solution validation
    if (session.minigameId === 'shift-slide' && result === GameResult.Win) {
      if (!solutionData) {
        return error(ErrorCode.INVALID_HASH, 'Shift & Slide solution validation failed', 400);
      }

      const finalBoard = (solutionData as Record<string, unknown>).finalBoard as number[] | undefined;
      const moveCount = (solutionData as Record<string, unknown>).moveCount as number | undefined;

      if (!Array.isArray(finalBoard) || finalBoard.length !== 9) {
        return error(ErrorCode.INVALID_HASH, 'Shift & Slide solution validation failed', 400);
      }

      const boardIsSolved = finalBoard.every((val: number, i: number) => val === i);
      const plausibleMoves = typeof moveCount === 'number' && moveCount >= 1 && moveCount <= 2000;

      if (!boardIsSolved || !plausibleMoves) {
        return error(ErrorCode.INVALID_HASH, 'Shift & Slide solution validation failed', 400);
      }
    }

    // Potion Logic puzzle solution validation
    if ((session.minigameId === 'potion-logic' || session.minigameId === 'potion-logic-coop') && result === GameResult.Win) {
      const puzzleSolution = (session as unknown as Record<string, unknown>).puzzleSolution as
        | PotionLogicSolution
        | undefined;

      if (!puzzleSolution || !solutionData) {
        return error(ErrorCode.INVALID_HASH, 'Potion Logic solution validation failed', 400);
      }

      const playerIngredients = (solutionData as Record<string, unknown>).playerIngredients as
        | Record<string, string>
        | undefined;
      const playerEffects = (solutionData as Record<string, unknown>).playerEffects as
        | Record<string, string>
        | undefined;

      if (!playerIngredients || !playerEffects) {
        return error(ErrorCode.INVALID_HASH, 'Potion Logic solution validation failed', 400);
      }

      if (!validatePotionLogicSubmission(puzzleSolution, playerIngredients, playerEffects)) {
        return error(ErrorCode.INVALID_HASH, 'Potion Logic solution validation failed', 400);
      }
    }

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
      let partnerChestDrop: ChestDrop = { dropped: false };

      if (shouldAwardXp) {
        // First win at this location — attempt full rewards (cap-safe)
        const xpResult = await awardXpAndStreak(userId, today);
        newTodayXp = xpResult.newTodayXp;
        clanId = xpResult.clan;
        xpToAward = xpResult.xpActuallyAwarded ? XP_PER_WIN : 0;
        capReached = !xpResult.xpActuallyAwarded;

        // Atomic clan XP (only if XP was actually awarded)
        if (clanId && xpToAward > 0) {
          // First win of the day: todayXp went from 0 → 25, so increment todayParticipants
          const isFirstWinToday = newTodayXp === XP_PER_WIN;
          const clanUpdateExpr = isFirstWinToday
            ? 'SET todayXpTimestamp = :ts ADD todayXp :xp, todayParticipants :one'
            : 'SET todayXpTimestamp = :ts ADD todayXp :xp';
          const clanUpdateValues = isFirstWinToday
            ? { ':ts': now, ':xp': XP_PER_WIN, ':one': 1 }
            : { ':ts': now, ':xp': XP_PER_WIN };
          const updatedClan = await updateItem(
            'clans',
            { clanId },
            clanUpdateExpr,
            clanUpdateValues
          );
          clanTodayXp = (updatedClan?.todayXp as number) ?? 0;
        }

        // Chest drop — 100% on XP-earning wins, weighted random from ASSET_POOL
        if (xpToAward === XP_PER_WIN) {
          const pickedAsset = pickAssetForClan(clanId, session.minigameId, session.coopPartnerId !== null);
          chestDropped = true;
          const userAssetId = crypto.randomUUID();
          chestAssetId = pickedAsset.id;

          const playerAsset: PlayerAsset = {
            userAssetId,
            userId,
            assetId: pickedAsset.id,
            obtainedAt: now,
            obtainedFrom: AssetObtainedFrom.Chest,
            locationId: session.locationId,
            placed: false,
            expiresAt: getMidnightISTAsISO(),
            expired: false,
            permanent: false,
          };

          await putItem('player-assets', playerAsset as unknown as Record<string, unknown>);

          chestDrop = {
            dropped: true,
            asset: {
              assetId: pickedAsset.id,
              name: pickedAsset.name,
              category: pickedAsset.category,
              rarity: pickedAsset.rarity,
              imageKey: pickedAsset.id,
            },
          };
        }

        // Co-op: repeat XP/streak for partner + independent chest roll + cross-clan XP
        if (session.coopPartnerId && session.coopPartnerId !== 'dev-partner') {
          const coopResult = await awardXpAndStreak(session.coopPartnerId, today);
          const partnerClanId = coopResult.clan;

          // Credit partner's own clan (cross-clan support)
          if (partnerClanId && coopResult.xpActuallyAwarded) {
            const coopIsFirstWin = coopResult.newTodayXp === XP_PER_WIN;
            const coopClanExpr = coopIsFirstWin
              ? 'SET todayXpTimestamp = :ts ADD todayXp :xp, todayParticipants :one'
              : 'SET todayXpTimestamp = :ts ADD todayXp :xp';
            const coopClanValues = coopIsFirstWin
              ? { ':ts': now, ':xp': XP_PER_WIN, ':one': 1 }
              : { ':ts': now, ':xp': XP_PER_WIN };
            await updateItem(
              'clans',
              { clanId: partnerClanId },
              coopClanExpr,
              coopClanValues
            );
          }

          // Independent chest roll for partner
          if (coopResult.xpActuallyAwarded) {
            const partnerPickedAsset = pickAssetForClan(partnerClanId, session.minigameId, true);
            const partnerUserAssetId = crypto.randomUUID();
            const partnerPlayerAsset: PlayerAsset = {
              userAssetId: partnerUserAssetId,
              userId: session.coopPartnerId,
              assetId: partnerPickedAsset.id,
              obtainedAt: now,
              obtainedFrom: AssetObtainedFrom.Chest,
              locationId: session.locationId,
              placed: false,
              expiresAt: getMidnightISTAsISO(),
              expired: false,
              permanent: false,
            };
            await putItem('player-assets', partnerPlayerAsset as unknown as Record<string, unknown>);

            partnerChestDrop = {
              dropped: true,
              asset: {
                assetId: partnerPickedAsset.id,
                name: partnerPickedAsset.name,
                category: partnerPickedAsset.category,
                rarity: partnerPickedAsset.rarity,
                imageKey: partnerPickedAsset.id,
              },
            };
          }

          // Fire-and-forget push notification to partner about their chest
          if (partnerChestDrop.dropped && session.coopPartnerId) {
            sendToPlayer(session.coopPartnerId, {
              notification: {
                title: 'Co-op reward!',
                body: 'Your partner won — you earned XP and a chest!',
              },
              data: {
                type: 'PARTNER_CHEST',
              },
            }).catch(console.error);
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
        partnerChestDrop,
        capReached,
      });
    } else {
      // --- LOSE PATH ---

      // 1. Create player-lock (1-hour duration)
      const dateUserLocation = `${today}#${userId}#${session.locationId}`;
      const lockExpiryMs = Date.now() + LOCK_DURATION_MS;
      const lockedUntil = new Date(lockExpiryMs).toISOString();
      const ttl = Math.floor(lockExpiryMs / 1000);

      const playerLock: PlayerLock = {
        dateUserLocation,
        lockedAt: now,
        lockedUntil,
        ttl,
      };

      await putItem('player-locks', playerLock as unknown as Record<string, unknown>);

      // 1b. Lock partner only if they are NOT a guest (i.e. location was in their assignment)
      if (session.coopPartnerId && session.coopPartnerId !== 'dev-partner' && session.partnerIsGuest === false) {
        const partnerLock: PlayerLock = {
          dateUserLocation: `${today}#${session.coopPartnerId}#${session.locationId}`,
          lockedAt: now,
          lockedUntil,
          ttl,
        };
        await putItem('player-locks', partnerLock as unknown as Record<string, unknown>);
      }

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
        lockedUntil,
        chestDrop: { dropped: false },
      });
    }
  } catch (err) {
    console.error('completeMinigame error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
