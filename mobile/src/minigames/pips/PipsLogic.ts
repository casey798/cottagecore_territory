import { PIPS_MOVE_BUFFER } from '@/constants/config';

export type CellState = 0 | 1;
export type Grid = CellState[][];

export const GRID_SIZE = 5;

export function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => 0 as CellState),
  );
}

/**
 * Toggle cell (row,col) and its orthogonal neighbors.
 * 0 becomes 1, 1 becomes 0. Out-of-bounds neighbors ignored.
 * Returns a NEW grid — never mutates the input.
 */
export function applyTap(grid: Grid, row: number, col: number): Grid {
  const newGrid = grid.map((r) => [...r]);
  const cells = [
    [row, col],
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];
  for (const [r, c] of cells) {
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
    newGrid[r][c] = newGrid[r][c] === 0 ? 1 : 0;
  }
  return newGrid;
}

/**
 * Solved when every cell is OFF (0).
 */
export function isSolved(grid: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] !== 0) return false;
    }
  }
  return true;
}

export interface PipsPuzzle {
  startGrid: Grid;
  solutionTaps: Array<{ row: number; col: number }>;
  moveLimit: number;
}

/**
 * Generate a puzzle by applying 5–8 random taps to an empty grid.
 * Replaying the same taps returns to all-OFF, guaranteeing solvability.
 * Duplicate taps on the same cell are deduplicated (even count = remove,
 * odd count = keep one) so moveLimit reflects true minimum moves.
 */
export function generatePuzzle(): PipsPuzzle {
  for (let attempt = 0; attempt < 200; attempt++) {
    const numTaps = Math.floor(Math.random() * 4) + 5; // 5–8
    const taps: Array<{ row: number; col: number }> = [];
    const posCount = new Map<string, number>();

    for (let i = 0; i < numTaps; i++) {
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      const key = `${row},${col}`;
      const count = posCount.get(key) ?? 0;
      // Avoid more than 2 of the exact same position
      if (count >= 2) {
        i--;
        continue;
      }
      posCount.set(key, count + 1);
      taps.push({ row, col });
    }

    let grid = createEmptyGrid();
    for (const tap of taps) {
      grid = applyTap(grid, tap.row, tap.col);
    }

    // Reject if scramble cancelled itself out
    if (isSolved(grid)) continue;

    // Reject if too few ON cells (trivial)
    let onCount = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === 1) onCount++;
      }
    }
    if (onCount < 8) continue;

    // Deduplicate: two taps on the same cell cancel out (Lights Out is self-inverse).
    // Keep exactly one entry per cell if count is odd; remove all if even.
    const deduplicatedTaps: Array<{ row: number; col: number }> = [];
    const seen = new Set<string>();
    for (const [key, count] of posCount.entries()) {
      if (count % 2 === 1) {
        const [r, c] = key.split(',').map(Number);
        deduplicatedTaps.push({ row: r, col: c });
        seen.add(key);
      }
    }

    return {
      startGrid: grid,
      solutionTaps: deduplicatedTaps,
      moveLimit: deduplicatedTaps.length + PIPS_MOVE_BUFFER,
    };
  }

  throw new Error('Failed to generate valid Pips puzzle');
}
