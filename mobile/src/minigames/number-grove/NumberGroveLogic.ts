import { BASE_GRIDS } from './baseGrids';

// ── Types ────────────────────────────────────────────────────────────

export interface NumberGrovePuzzle {
  puzzle: number[][];
  solution: number[][];
  timeLimit: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (returns new array). */
function shuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Deep-clone a 2D number array. */
function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

/** Get the box index (0–5) for a cell at (r, c) in a 6×6 grid with 2×3 boxes. */
function boxIndex(r: number, c: number): number {
  const bandRow = Math.floor(r / 2); // 0, 1, 2
  const stackCol = Math.floor(c / 3); // 0, 1
  return bandRow * 2 + stackCol;
}

// ── Validity-preserving shuffles ─────────────────────────────────────

function relabelDigits(grid: number[][]): number[][] {
  const perm = shuffle([1, 2, 3, 4, 5, 6]);
  const mapping = new Map<number, number>();
  for (let i = 0; i < 6; i++) {
    mapping.set(i + 1, perm[i]);
  }
  return grid.map((row) => row.map((v) => mapping.get(v)!));
}

function swapRowsWithinBands(grid: number[][]): number[][] {
  const result = cloneGrid(grid);
  // Band 0: rows 0-1, Band 1: rows 2-3, Band 2: rows 4-5
  for (let band = 0; band < 3; band++) {
    if (Math.random() < 0.5) {
      const r1 = band * 2;
      const r2 = band * 2 + 1;
      [result[r1], result[r2]] = [result[r2], result[r1]];
    }
  }
  return result;
}

function swapColsWithinStacks(grid: number[][]): number[][] {
  const result = cloneGrid(grid);
  // Stack 0: cols 0-2, Stack 1: cols 3-5
  for (let stack = 0; stack < 2; stack++) {
    const colIndices = shuffle([0, 1, 2]);
    const base = stack * 3;
    const originalCols = result.map((row) => [row[base], row[base + 1], row[base + 2]]);
    for (let r = 0; r < 6; r++) {
      for (let ci = 0; ci < 3; ci++) {
        result[r][base + ci] = originalCols[r][colIndices[ci]];
      }
    }
  }
  return result;
}

function swapRowBands(grid: number[][]): number[][] {
  const bands = [
    [grid[0], grid[1]],
    [grid[2], grid[3]],
    [grid[4], grid[5]],
  ];
  const order = shuffle([0, 1, 2]);
  const result: number[][] = [];
  for (const idx of order) {
    result.push([...bands[idx][0]], [...bands[idx][1]]);
  }
  return result;
}

function swapColStacks(grid: number[][]): number[][] {
  const order = shuffle([0, 1]);
  return grid.map((row) => {
    const stacks = [row.slice(0, 3), row.slice(3, 6)];
    return [...stacks[order[0]], ...stacks[order[1]]];
  });
}

// ── Backtracking solver (count up to 2 solutions) ────────────────────

function solveCounting(
  grid: number[][],
  maxSolutions: number,
): number {
  let count = 0;

  // Precompute constraints
  const rowSets: Set<number>[] = Array.from({ length: 6 }, () => new Set());
  const colSets: Set<number>[] = Array.from({ length: 6 }, () => new Set());
  const boxSets: Set<number>[] = Array.from({ length: 6 }, () => new Set());

  const emptyCells: [number, number][] = [];

  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const v = grid[r][c];
      if (v === 0) {
        emptyCells.push([r, c]);
      } else {
        rowSets[r].add(v);
        colSets[c].add(v);
        boxSets[boxIndex(r, c)].add(v);
      }
    }
  }

  function backtrack(idx: number): void {
    if (count >= maxSolutions) return;
    if (idx === emptyCells.length) {
      count++;
      return;
    }

    const [r, c] = emptyCells[idx];
    const bi = boxIndex(r, c);

    for (let d = 1; d <= 6; d++) {
      if (rowSets[r].has(d) || colSets[c].has(d) || boxSets[bi].has(d)) continue;

      rowSets[r].add(d);
      colSets[c].add(d);
      boxSets[bi].add(d);
      grid[r][c] = d;

      backtrack(idx + 1);

      rowSets[r].delete(d);
      colSets[c].delete(d);
      boxSets[bi].delete(d);
      grid[r][c] = 0;
    }
  }

  backtrack(0);
  return count;
}

function hasUniqueSolution(grid: number[][]): boolean {
  return solveCounting(cloneGrid(grid), 2) === 1;
}

// ── Carving with 180° rotational symmetry ────────────────────────────

function carveSymmetric(solution: number[][]): number[][] {
  const puzzle = cloneGrid(solution);
  const TARGET_REMOVALS = 12;
  let removed = 0;

  // Build symmetric pair candidates
  const pairs: [number, number, number, number][] = [];
  const visited = new Set<string>();

  // Shuffle all positions for randomness
  const allPositions: [number, number][] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      allPositions.push([r, c]);
    }
  }
  const shuffled = shuffle(allPositions);

  for (const [r, c] of shuffled) {
    const key = `${r},${c}`;
    if (visited.has(key)) continue;

    const mr = 5 - r;
    const mc = 5 - c;
    const mirrorKey = `${mr},${mc}`;
    visited.add(key);
    visited.add(mirrorKey);

    if (r === mr && c === mc) {
      // Center cell (if 6×6, no exact center) — skip
      continue;
    }

    pairs.push([r, c, mr, mc]);
  }

  for (const [r1, c1, r2, c2] of pairs) {
    if (removed >= TARGET_REMOVALS) break;

    const v1 = puzzle[r1][c1];
    const v2 = puzzle[r2][c2];

    // Try removing both
    puzzle[r1][c1] = 0;
    puzzle[r2][c2] = 0;

    if (hasUniqueSolution(puzzle)) {
      removed += 2;
    } else {
      // Restore
      puzzle[r1][c1] = v1;
      puzzle[r2][c2] = v2;
    }
  }

  return puzzle;
}

// ── Public API ────────────────────────────────────────────────────────

export function generatePuzzle(): NumberGrovePuzzle {
  // 1. Pick random base grid
  let grid = cloneGrid(BASE_GRIDS[Math.floor(Math.random() * BASE_GRIDS.length)]);

  // 2. Apply validity-preserving shuffles
  grid = relabelDigits(grid);
  grid = swapRowsWithinBands(grid);
  grid = swapColsWithinStacks(grid);
  grid = swapRowBands(grid);
  grid = swapColStacks(grid);

  const solution = cloneGrid(grid);

  // 3. Carve cells (target 12 removals → 24 givens)
  const puzzle = carveSymmetric(solution);

  return { puzzle, solution, timeLimit: 120 };
}

export function getConflicts(board: number[][]): Set<string> {
  const conflicts = new Set<string>();

  // Check rows
  for (let r = 0; r < 6; r++) {
    const seen = new Map<number, number[]>();
    for (let c = 0; c < 6; c++) {
      const v = board[r][c];
      if (v === 0) continue;
      if (!seen.has(v)) {
        seen.set(v, []);
      }
      seen.get(v)!.push(c);
    }
    for (const [, cols] of seen) {
      if (cols.length > 1) {
        for (const c of cols) {
          conflicts.add(`${r},${c}`);
        }
      }
    }
  }

  // Check columns
  for (let c = 0; c < 6; c++) {
    const seen = new Map<number, number[]>();
    for (let r = 0; r < 6; r++) {
      const v = board[r][c];
      if (v === 0) continue;
      if (!seen.has(v)) {
        seen.set(v, []);
      }
      seen.get(v)!.push(r);
    }
    for (const [, rows] of seen) {
      if (rows.length > 1) {
        for (const r of rows) {
          conflicts.add(`${r},${c}`);
        }
      }
    }
  }

  // Check boxes (2 rows × 3 cols)
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 2; bc++) {
      const seen = new Map<number, [number, number][]>();
      for (let dr = 0; dr < 2; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const r = br * 2 + dr;
          const c = bc * 3 + dc;
          const v = board[r][c];
          if (v === 0) continue;
          if (!seen.has(v)) {
            seen.set(v, []);
          }
          seen.get(v)!.push([r, c]);
        }
      }
      for (const [, cells] of seen) {
        if (cells.length > 1) {
          for (const [r, c] of cells) {
            conflicts.add(`${r},${c}`);
          }
        }
      }
    }
  }

  return conflicts;
}

export function isComplete(board: number[][], solution: number[][]): boolean {
  // All cells must be non-zero
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (board[r][c] === 0) return false;
    }
  }

  // No conflicts
  if (getConflicts(board).size > 0) return false;

  // Board matches solution
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (board[r][c] !== solution[r][c]) return false;
    }
  }

  return true;
}

export function validateSolution(
  submission: number[][],
  solution: number[][],
): boolean {
  // Every row must have digits 1-6 exactly once
  for (let r = 0; r < 6; r++) {
    const row = new Set(submission[r]);
    if (row.size !== 6) return false;
    for (let d = 1; d <= 6; d++) {
      if (!row.has(d)) return false;
    }
  }

  // Every column must have digits 1-6 exactly once
  for (let c = 0; c < 6; c++) {
    const col = new Set<number>();
    for (let r = 0; r < 6; r++) {
      col.add(submission[r][c]);
    }
    if (col.size !== 6) return false;
    for (let d = 1; d <= 6; d++) {
      if (!col.has(d)) return false;
    }
  }

  // Every box must have digits 1-6 exactly once
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 2; bc++) {
      const box = new Set<number>();
      for (let dr = 0; dr < 2; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          box.add(submission[br * 2 + dr][bc * 3 + dc]);
        }
      }
      if (box.size !== 6) return false;
      for (let d = 1; d <= 6; d++) {
        if (!box.has(d)) return false;
      }
    }
  }

  // All given cells match and board equals solution
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (submission[r][c] !== solution[r][c]) return false;
    }
  }

  return true;
}
