// Pure logic for the Shift & Slide (3×3 sliding tile puzzle) minigame.
// No React or React Native imports — pure TypeScript only.

const GRID_COLS = 3;
const GRID_SIZE = GRID_COLS * GRID_COLS; // 9
const EMPTY_TILE = 8;

/** 0–7 = image tile, 8 = empty slot */
export type TileIndex = number;

/** Flat array of 9 — position i holds which tile is there */
export type Board = TileIndex[];

export function createSolvedBoard(): Board {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8];
}

export function getEmptyIndex(board: Board): number {
  return board.indexOf(EMPTY_TILE);
}

export function getValidMoves(board: Board): number[] {
  const emptyIdx = getEmptyIndex(board);
  const emptyRow = Math.floor(emptyIdx / GRID_COLS);
  const emptyCol = emptyIdx % GRID_COLS;
  const moves: number[] = [];

  // Up
  if (emptyRow > 0) moves.push(emptyIdx - GRID_COLS);
  // Down
  if (emptyRow < GRID_COLS - 1) moves.push(emptyIdx + GRID_COLS);
  // Left
  if (emptyCol > 0) moves.push(emptyIdx - 1);
  // Right
  if (emptyCol < GRID_COLS - 1) moves.push(emptyIdx + 1);

  return moves;
}

export function applyMove(board: Board, tileIndex: number): Board {
  const validMoves = getValidMoves(board);
  if (!validMoves.includes(tileIndex)) {
    throw new Error(`Invalid move: tile at index ${tileIndex} cannot slide`);
  }

  const emptyIdx = getEmptyIndex(board);
  const newBoard = [...board];
  newBoard[emptyIdx] = newBoard[tileIndex];
  newBoard[tileIndex] = EMPTY_TILE;
  return newBoard;
}

export function scrambleBoard(board: Board, moveCount: number, seed: number): Board {
  let current = [...board];
  let rng = seed >>> 0; // ensure unsigned 32-bit
  let prevEmptyIdx = -1;

  for (let i = 0; i < moveCount; i++) {
    // LCG step
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;

    const emptyIdx = getEmptyIndex(current);
    let moves = getValidMoves(current);

    // Never reverse the immediately preceding move
    if (prevEmptyIdx >= 0) {
      moves = moves.filter((m) => m !== prevEmptyIdx);
    }

    const chosenIdx = moves[rng % moves.length];
    prevEmptyIdx = emptyIdx;
    current = applyMove(current, chosenIdx);
  }

  return current;
}

export function isSolved(board: Board): boolean {
  for (let i = 0; i < GRID_SIZE; i++) {
    if (board[i] !== i) return false;
  }
  return true;
}

export function tileSrcRect(
  tileValue: TileIndex,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; width: number; height: number } {
  if (tileValue === EMPTY_TILE) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const tileW = imageWidth / GRID_COLS;
  const tileH = imageHeight / GRID_COLS;
  const col = tileValue % GRID_COLS;
  const row = Math.floor(tileValue / GRID_COLS);

  return {
    x: col * tileW,
    y: row * tileH,
    width: tileW,
    height: tileH,
  };
}

export function tileDestRect(
  boardIndex: number,
  cellSize: number,
): { x: number; y: number; width: number; height: number } {
  const col = boardIndex % GRID_COLS;
  const row = Math.floor(boardIndex / GRID_COLS);

  return {
    x: col * cellSize,
    y: row * cellSize,
    width: cellSize,
    height: cellSize,
  };
}
