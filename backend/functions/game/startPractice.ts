import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import crypto from 'crypto';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem } from '../../shared/db';
import { MINIGAME_POOL, MINIGAME_IDS } from '../../shared/minigames';
import { generatePuzzle as generatePipsPuzzle } from '../../shared/minigames/pipsGenerator';
import { generatePuzzle as generatePathWeaverPuzzle } from '../../shared/minigames/pathWeaverGenerator';
import { getRandomPuzzle as getRandomMosaicPuzzle } from './mosaic/puzzleLibrary';
import { generatePuzzle as generateGroveEquationsPuzzle } from '../../shared/minigames/groveEquationsGenerator';
import { generateGame as generateBloomSequenceGame } from '../../shared/minigames/bloomSequenceGenerator';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import { GameResult, GameSession, User } from '../../shared/types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const body = JSON.parse(event.body || '{}');
    let minigameId = body.minigameId as string | undefined;

    // If no minigameId provided, pick a random one
    if (!minigameId) {
      minigameId = MINIGAME_IDS[Math.floor(Math.random() * MINIGAME_IDS.length)];
    }

    // Validate minigame ID
    if (!MINIGAME_POOL[minigameId]) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid minigame ID', 400);
    }

    // Verify user exists
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    const meta = MINIGAME_POOL[minigameId];
    const sessionId = crypto.randomUUID();
    const salt = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    const today = getTodayISTString();

    const session: GameSession = {
      sessionId,
      userId,
      locationId: 'practice',
      minigameId,
      date: today,
      startedAt: now,
      completedAt: null,
      result: GameResult.Abandoned,
      xpEarned: 0,
      chestDropped: false,
      chestAssetId: null,
      completionHash: '',
      coopPartnerId: null,
      _salt: salt,
      timeLimit: meta.timeLimit,
      practiceSession: true,
    };

    // Generate puzzle data (same logic as startMinigame.ts)
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
      };
    }

    if (minigameId === 'bloom-sequence') {
      const bsGame = generateBloomSequenceGame();
      (session as unknown as Record<string, unknown>).puzzleSolution = {
        rounds: bsGame.rounds,
      };
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

    await putItem('game-sessions', session as unknown as Record<string, unknown>);

    return success({
      sessionId,
      serverTimestamp: now,
      timeLimit: meta.timeLimit,
      salt,
      puzzleData,
    });
  } catch (err) {
    console.error('startPractice error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
