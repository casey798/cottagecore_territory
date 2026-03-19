// Pips puzzle generator — mirrors mobile/src/minigames/pips/PipsLogic.ts exactly.

export type CellState = 0 | 1;
export type Grid = CellState[][];

const GRID_SIZE = 5;

export function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => 0 as CellState),
  );
}

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

    if (isSolved(grid)) continue;

    let onCount = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === 1) onCount++;
      }
    }
    if (onCount < 8) continue;

    return {
      startGrid: grid,
      solutionTaps: taps,
      moveLimit: taps.length + 2,
    };
  }

  throw new Error('Failed to generate valid Pips puzzle');
}
