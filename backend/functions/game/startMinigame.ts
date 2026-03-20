import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import crypto from 'crypto';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem, query } from '../../shared/db';
import { MINIGAME_POOL } from '../../shared/minigames';
import { generatePuzzle as generatePipsPuzzle } from '../../shared/minigames/pipsGenerator';
import { generatePuzzle as generatePathWeaverPuzzle } from '../../shared/minigames/pathWeaverGenerator';
import { getRandomPuzzle as getRandomMosaicPuzzle } from './mosaic/puzzleLibrary';
import { generatePuzzle as generateGroveEquationsPuzzle } from '../../shared/minigames/groveEquationsGenerator';
import { generateGame as generateBloomSequenceGame } from '../../shared/minigames/bloomSequenceGenerator';
import { success, error, ErrorCode } from '../../shared/response';
import { startMinigameSchema } from '../../shared/schemas';
import { getTodayISTString } from '../../shared/time';
import { isQuietModeActive } from '../../shared/quietMode';
import {
  COOP_MINIGAME_IDS,
  GameResult,
  GameSession,
  Location,
  PlayerAssignment,
  PlayerLock,
  User,
} from '../../shared/types';

const DAILY_XP_CAP = 100;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const parsed = startMinigameSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    // Quiet mode check — block new minigame starts
    if (await isQuietModeActive()) {
      return error(ErrorCode.QUIET_MODE, 'The game is currently in quiet mode. No new sessions can be started.', 403);
    }

    const { locationId, minigameId, coopPartnerId } = parsed.data;

    // Validate minigame ID
    if (!MINIGAME_POOL[minigameId]) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid minigame ID', 400);
    }

    // Verify location exists
    const location = await getItem<Location>('locations', { locationId });
    if (!location) {
      return error(ErrorCode.NOT_FOUND, 'Location not found', 404);
    }

    // Verify user exists
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    // Check location lock
    const today = getTodayISTString();
    const dateUserLocation = `${today}#${userId}#${locationId}`;
    const lock = await getItem<PlayerLock>('player-locks', { dateUserLocation });
    if (lock) {
      return error(ErrorCode.LOCATION_LOCKED, 'This location is locked for you until tomorrow', 403);
    }

    // Check if player already won this minigame today (across any location)
    const { items: todaySessions } = await query<GameSession>(
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
    const alreadyWon = todaySessions.some(
      (s) => s.minigameId === minigameId && s.result === GameResult.Win && s.completedAt !== null,
    );
    if (alreadyWon) {
      return error(ErrorCode.MINIGAME_ALREADY_WON, 'You have already won this challenge today', 400);
    }

    // Resolve coopOnly from player's daily assignment record
    const dateUserId = `${today}#${userId}`;
    const playerAssignment = await getItem<PlayerAssignment>('player-assignments', { dateUserId });
    const coopOnly = playerAssignment?.coopLocationIds?.includes(locationId) ?? false;

    // Co-op only enforcement
    if (coopOnly && !coopPartnerId) {
      return error(ErrorCode.COOP_REQUIRED, 'This location requires a co-op partner.', 400);
    }
    if (coopOnly && !COOP_MINIGAME_IDS.includes(minigameId)) {
      return error(ErrorCode.VALIDATION_ERROR, 'Solo minigames are not available at this location.', 400);
    }

    // Co-op partner validation
    const stage = process.env.STAGE || 'dev';
    const isDevPartner = stage === 'dev' && coopPartnerId === 'dev-partner';
    let partnerUser: User | undefined;
    let partnerIsGuest = false;
    if (coopPartnerId) {
      if (isDevPartner) {
        console.log('[startMinigame] Dev bypass: using synthetic dev-partner');
        partnerIsGuest = true;
      } else {
        partnerUser = await getItem<User>('users', { userId: coopPartnerId });
        if (!partnerUser) {
          return error(ErrorCode.NOT_FOUND, 'Co-op partner not found', 404);
        }

        // Check partner daily XP cap
        if (partnerUser.todayXp >= DAILY_XP_CAP) {
          return error(ErrorCode.PARTNER_CAP_REACHED, 'Your partner has already reached the daily XP cap', 400);
        }

        // Check partner lock at this location
        const partnerLock = await getItem<PlayerLock>('player-locks', {
          dateUserLocation: `${today}#${coopPartnerId}#${locationId}`,
        });
        if (partnerLock) {
          return error(ErrorCode.PARTNER_LOCATION_LOCKED, 'Your partner is locked at this location today', 400);
        }

        // Check partner already won this minigame today
        const { items: partnerSessions } = await query<GameSession>(
          'game-sessions',
          'userId = :uid AND #d = :date',
          { ':uid': coopPartnerId, ':date': today },
          {
            indexName: 'UserDateIndex',
            expressionNames: { '#d': 'date' },
            scanIndexForward: false,
            limit: 50,
          }
        );
        const partnerAlreadyWon = partnerSessions.some(
          (s) => s.minigameId === minigameId && s.result === GameResult.Win && s.completedAt !== null,
        );
        if (partnerAlreadyWon) {
          return error(ErrorCode.PARTNER_ALREADY_WON, 'Your partner has already won this minigame today', 400);
        }

        // Check if partner has this location in their daily assignment
        const partnerDateUserId = `${today}#${coopPartnerId}`;
        const partnerAssignment = await getItem<PlayerAssignment>('player-assignments', { dateUserId: partnerDateUserId });
        partnerIsGuest = !partnerAssignment || !partnerAssignment.assignedLocationIds.includes(locationId);
      }
    }

    const meta = MINIGAME_POOL[minigameId];
    const sessionId = crypto.randomUUID();
    const salt = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();

    const session: GameSession = {
      sessionId,
      userId,
      locationId,
      minigameId,
      date: today,
      startedAt: now,
      completedAt: null,
      result: GameResult.Abandoned,
      xpEarned: 0,
      chestDropped: false,
      chestAssetId: null,
      completionHash: '',
      coopPartnerId: coopPartnerId ?? null,
      ...(coopPartnerId ? { partnerIsGuest } : {}),
      _salt: salt,
      timeLimit: meta.timeLimit,
    };

    // Generate puzzle data for minigames that need server-side generation
    let puzzleData: Record<string, unknown> = {
      type: minigameId,
    };

    if (minigameId === 'mosaic') {
      const mosaicPuzzle = getRandomMosaicPuzzle();
      (session as unknown as Record<string, unknown>).puzzleId = mosaicPuzzle.id;
      puzzleData = {
        type: minigameId,
        id: mosaicPuzzle.id,
        gridCols: mosaicPuzzle.gridCols,
        gridRows: mosaicPuzzle.gridRows,
        targetCells: mosaicPuzzle.targetCells,
        tiles: mosaicPuzzle.tiles,
        timeLimit: meta.timeLimit,
      };
    }

    if (minigameId === 'path-weaver') {
      const pathWeaverPuzzle = generatePathWeaverPuzzle();
      (session as unknown as Record<string, unknown>).puzzleSolution = pathWeaverPuzzle.solution;
      puzzleData = {
        type: minigameId,
        name: pathWeaverPuzzle.name,
        gridSize: pathWeaverPuzzle.gridSize,
        rowClues: pathWeaverPuzzle.rowClues,
        colClues: pathWeaverPuzzle.colClues,
      };
    }

    if (minigameId === 'grove-equations') {
      const eqPuzzle = generateGroveEquationsPuzzle();
      (session as unknown as Record<string, unknown>).puzzleSolution = {
        solution: eqPuzzle.solution,
        numbers: eqPuzzle.numbers,
        target: eqPuzzle.target,
      };
      puzzleData = {
        type: minigameId,
        numbers: eqPuzzle.numbers,
        target: eqPuzzle.target,
        // solution is NOT sent to client
      };
    }

    if (minigameId === 'bloom-sequence') {
      const bsGame = generateBloomSequenceGame();
      (session as unknown as Record<string, unknown>).puzzleSolution = {
        rounds: bsGame.rounds,
      };
      // Send rounds with correctAnswer — the client needs it for local
      // validation. Server-side validation via stored puzzleSolution is
      // the anti-cheat layer (verifies chosen indices match correct answers).
      puzzleData = {
        type: minigameId,
        rounds: bsGame.rounds,
      };
    }

    if (minigameId === 'shift-slide') {
      const images = [
        'fox-face', 'mushroom-cluster', 'flowers', 'cottage', 'owl',
        'butterfly', 'hedgehog', 'watering-can', 'bird-on-branch', 'sunflower',
      ];
      const imageId = images[Math.floor(Math.random() * images.length)];
      const scrambleSeed = Math.floor(Math.random() * 2_000_000);
      (session as unknown as Record<string, unknown>).puzzleSolution = { scrambleSeed, imageId };
      puzzleData = {
        type: minigameId,
        imageId,
        scrambleSeed,
      };
    }

    if (minigameId === 'pips') {
      const pipsPuzzle = generatePipsPuzzle();
      (session as unknown as Record<string, unknown>).puzzleSolution = {
        solutionTaps: pipsPuzzle.solutionTaps,
        startGrid: pipsPuzzle.startGrid,
      };
      puzzleData = {
        type: minigameId,
        startGrid: pipsPuzzle.startGrid,
        moveLimit: pipsPuzzle.moveLimit,
        timeLimit: 60,
      };
    }

    // Inject partner identity into puzzleData for co-op game components
    if (coopPartnerId && (partnerUser || isDevPartner)) {
      puzzleData.p1Name = user.displayName;
      puzzleData.p1Clan = user.clan;
      puzzleData.p2Name = isDevPartner ? 'Dev Partner' : partnerUser!.displayName;
      puzzleData.p2Clan = isDevPartner ? 'ember' : partnerUser!.clan;
    }

    await putItem('game-sessions', session as unknown as Record<string, unknown>);

    return success({
      sessionId,
      serverTimestamp: now,
      timeLimit: meta.timeLimit,
      salt,
      puzzleData,
    });
  } catch (err) {
    console.error('startMinigame error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
