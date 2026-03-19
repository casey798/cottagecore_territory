import { IMAGE_GRIDS, type NonogramPuzzle } from './image_grids';

// ── Types ──────────────────────────────────────────────────────────────

export interface PathWeaverPuzzle {
  name: string;
  gridSize: number;
  rowClues: number[][];
  colClues: number[][];
  solution: number[][];
}

/** What gets sent to the client — no solution included. */
export interface PathWeaverConfig {
  name: string;
  gridSize: number;
  rowClues: number[][];
  colClues: number[][];
}

// ── Pure functions ─────────────────────────────────────────────────────

/**
 * Derive row and column clues from a binary grid.
 * Each row/col clue is an array of consecutive run lengths of 1s.
 * An entirely-empty line yields [0].
 */
export function deriveClues(grid: number[][]): { rowClues: number[][]; colClues: number[][] } {
  const size = grid.length;

  const lineClues = (cells: number[]): number[] => {
    const runs: number[] = [];
    let count = 0;
    for (const cell of cells) {
      if (cell === 1) {
        count++;
      } else if (count > 0) {
        runs.push(count);
        count = 0;
      }
    }
    if (count > 0) runs.push(count);
    return runs.length > 0 ? runs : [0];
  };

  const rowClues = grid.map((row) => lineClues(row));

  const colClues: number[][] = [];
  for (let col = 0; col < (grid[0]?.length ?? 0); col++) {
    const column: number[] = [];
    for (let row = 0; row < size; row++) {
      column.push(grid[row][col]);
    }
    colClues.push(lineClues(column));
  }

  return { rowClues, colClues };
}

/**
 * Randomly select a puzzle from the image grid library.
 * Returns full puzzle including solution (for server-side storage).
 */
export function generatePuzzle(): PathWeaverPuzzle {
  const entry: NonogramPuzzle = IMAGE_GRIDS[Math.floor(Math.random() * IMAGE_GRIDS.length)];
  return {
    name: entry.name,
    gridSize: entry.grid.length,
    rowClues: entry.rowClues,
    colClues: entry.colClues,
    solution: entry.grid,
  };
}

/**
 * Check if the current grid matches the solution exactly.
 */
export function checkWin(current: number[][], solution: number[][]): boolean {
  for (let r = 0; r < solution.length; r++) {
    for (let c = 0; c < solution[r].length; c++) {
      if ((current[r]?.[c] ?? 0) !== solution[r][c]) return false;
    }
  }
  return true;
}

/**
 * Backend-side validation — identical to checkWin.
 */
export function validateSubmission(solution: number[][], submission: number[][]): boolean {
  return checkWin(submission, solution);
}

/**
 * Create a size×size grid of all zeros.
 */
export function getEmptyGrid(size: number): number[][] {
  return Array.from({ length: size }, () => Array<number>(size).fill(0));
}
