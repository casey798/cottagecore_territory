/**
 * Firefly Flow — Pure puzzle generation and validation logic.
 * No React dependencies.
 *
 * The puzzle is a 6×6 grid where 4–5 colored pairs of endpoints must be
 * connected by non-overlapping paths that cover every cell.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Cell {
  row: number;
  col: number;
}

export type PairColor = 'ember' | 'tide' | 'bloom' | 'gale' | 'lavender';

export interface Pair {
  color: PairColor;
  start: Cell;
  end: Cell;
}

export interface Puzzle {
  grid: 6;
  pairs: Pair[];
  solution: Record<PairColor, Cell[]>;
}

export type PlayerPath = Record<PairColor, Cell[]>;

// ─── Constants ──────────────────────────────────────────────────────────────

export const GRID_SIZE = 6;

export const PAIR_COLORS: PairColor[] = ['ember', 'tide', 'bloom', 'gale', 'lavender'];

export const COLOR_HEX: Record<PairColor, string> = {
  ember: '#C0392B',
  tide: '#2980B9',
  bloom: '#F1C40F',
  gale: '#27AE60',
  lavender: '#9B59B6',
};

// ─── Utility helpers ────────────────────────────────────────────────────────

export function areCellsEqual(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isCellInPath(cell: Cell, path: Cell[]): boolean {
  return path.some((c) => areCellsEqual(c, cell));
}

export function getAdjacentCells(cell: Cell, gridSize: number): Cell[] {
  const adj: Cell[] = [];
  if (cell.row > 0) adj.push({ row: cell.row - 1, col: cell.col });
  if (cell.row < gridSize - 1) adj.push({ row: cell.row + 1, col: cell.col });
  if (cell.col > 0) adj.push({ row: cell.row, col: cell.col - 1 });
  if (cell.col < gridSize - 1) adj.push({ row: cell.row, col: cell.col + 1 });
  return adj;
}

// ─── Puzzle generation ──────────────────────────────────────────────────────

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

/**
 * Generate a puzzle by filling the 6×6 grid with non-crossing paths using
 * a recursive backtracker. Each attempt:
 *   1. Pick 4 or 5 pairs randomly
 *   2. Fill the entire grid with paths (one color at a time)
 *   3. Run quality checks
 */
export function generatePuzzle(): Puzzle {
  const totalCells = GRID_SIZE * GRID_SIZE; // 36

  for (let attempt = 0; attempt < 50; attempt++) {
    const numPairs = Math.random() < 0.5 ? 4 : 5;
    const shuffled = [...PAIR_COLORS].sort(() => Math.random() - 0.5);
    const colors = shuffled.slice(0, numPairs);

    // Target cells per path: distribute 36 cells among numPairs paths
    const baseCells = Math.floor(totalCells / numPairs);
    const remainder = totalCells % numPairs;
    const targetLengths = colors.map((_, i) => baseCells + (i < remainder ? 1 : 0));

    // Occupied grid tracker
    const occupied: (PairColor | null)[][] = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => null),
    );

    const solution: Record<string, Cell[]> = {};
    let success = true;

    for (let pi = 0; pi < colors.length; pi++) {
      const color = colors[pi];
      const targetLen = targetLengths[pi];

      const path = buildPath(occupied, targetLen, pi === colors.length - 1);
      if (!path) {
        success = false;
        break;
      }

      // Mark cells
      for (const cell of path) {
        occupied[cell.row][cell.col] = color;
      }
      solution[color] = path;
    }

    if (!success) continue;

    // Verify full coverage
    let coveredCount = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (occupied[r][c] !== null) coveredCount++;
      }
    }
    if (coveredCount !== totalCells) continue;

    // Quality checks
    let quality = true;
    const pairs: Pair[] = [];

    for (const color of colors) {
      const path = solution[color];
      // Path must be at least 3 cells
      if (path.length < 3) {
        quality = false;
        break;
      }
      const start = path[0];
      const end = path[path.length - 1];
      // Manhattan distance between endpoints must be >= 2
      const dist = Math.abs(start.row - end.row) + Math.abs(start.col - end.col);
      if (dist < 2) {
        quality = false;
        break;
      }
      pairs.push({ color: color as PairColor, start, end });
    }

    if (!quality) continue;
    if (pairs.length !== numPairs) continue;

    return {
      grid: 6,
      pairs,
      solution: solution as Record<PairColor, Cell[]>,
    };
  }

  // Fallback: should rarely happen, but generate a simpler puzzle
  return generateFallbackPuzzle();
}

/**
 * Build a single path of target length through unoccupied cells using
 * a randomized DFS with backtracking.
 */
function buildPath(
  occupied: (PairColor | null)[][],
  targetLen: number,
  isLast: boolean,
): Cell[] | null {
  // Collect unoccupied cells
  const freeCells: Cell[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (occupied[r][c] === null) freeCells.push({ row: r, col: c });
    }
  }

  if (freeCells.length < targetLen) return null;

  // If this is the last path, it must use ALL remaining free cells
  const mustUseAll = isLast;

  // Try multiple starting positions
  const shuffledStarts = [...freeCells].sort(() => Math.random() - 0.5);
  const maxStarts = Math.min(shuffledStarts.length, 20);

  for (let si = 0; si < maxStarts; si++) {
    const start = shuffledStarts[si];
    const visited = new Set<string>();
    visited.add(cellKey(start.row, start.col));

    const path: Cell[] = [start];
    if (dfsExtend(path, visited, occupied, targetLen, mustUseAll ? freeCells.length : targetLen)) {
      return path;
    }
  }

  return null;
}

function dfsExtend(
  path: Cell[],
  visited: Set<string>,
  occupied: (PairColor | null)[][],
  targetLen: number,
  requiredLen: number,
): boolean {
  if (path.length === targetLen && path.length >= requiredLen) return true;
  if (path.length >= targetLen) return path.length >= requiredLen;

  const current = path[path.length - 1];
  const neighbors = getAdjacentCells(current, GRID_SIZE).sort(() => Math.random() - 0.5);

  for (const next of neighbors) {
    const key = cellKey(next.row, next.col);
    if (visited.has(key)) continue;
    if (occupied[next.row][next.col] !== null) continue;

    // Connectivity heuristic: don't strand remaining free cells.
    // Only check when we have more than a few cells left to place.
    const remaining = targetLen - path.length - 1;
    if (remaining > 2 && !hasEnoughReachable(next, visited, occupied, remaining)) continue;

    visited.add(key);
    path.push(next);

    if (dfsExtend(path, visited, occupied, targetLen, requiredLen)) return true;

    path.pop();
    visited.delete(key);
  }

  return false;
}

/**
 * Quick reachability check: from `start`, can we reach at least `needed`
 * unoccupied, unvisited cells via BFS?
 */
function hasEnoughReachable(
  start: Cell,
  visited: Set<string>,
  occupied: (PairColor | null)[][],
  needed: number,
): boolean {
  const queue: Cell[] = [start];
  const seen = new Set<string>([cellKey(start.row, start.col)]);
  let count = 0;

  while (queue.length > 0 && count < needed) {
    const cell = queue.shift()!;
    count++;
    if (count >= needed) return true;

    for (const adj of getAdjacentCells(cell, GRID_SIZE)) {
      const key = cellKey(adj.row, adj.col);
      if (seen.has(key) || visited.has(key)) continue;
      if (occupied[adj.row][adj.col] !== null) continue;
      seen.add(key);
      queue.push(adj);
    }
  }

  return count >= needed;
}

/**
 * Fallback puzzle generator: creates a known-good snake pattern.
 */
function generateFallbackPuzzle(): Puzzle {
  const colors = [...PAIR_COLORS].sort(() => Math.random() - 0.5);
  const numPairs = Math.random() < 0.5 ? 4 : 5;
  const selected = colors.slice(0, numPairs);

  // Create a Hamiltonian snake path through the grid
  const snake: Cell[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < GRID_SIZE; c++) snake.push({ row: r, col: c });
    } else {
      for (let c = GRID_SIZE - 1; c >= 0; c--) snake.push({ row: r, col: c });
    }
  }

  const totalCells = GRID_SIZE * GRID_SIZE;
  const baseCells = Math.floor(totalCells / numPairs);
  const rem = totalCells % numPairs;

  const solution: Record<string, Cell[]> = {};
  const pairs: Pair[] = [];
  let offset = 0;

  for (let i = 0; i < numPairs; i++) {
    const len = baseCells + (i < rem ? 1 : 0);
    const path = snake.slice(offset, offset + len);
    solution[selected[i]] = path;
    pairs.push({
      color: selected[i],
      start: path[0],
      end: path[path.length - 1],
    });
    offset += len;
  }

  return {
    grid: 6,
    pairs,
    solution: solution as Record<PairColor, Cell[]>,
  };
}

// ─── Validation ─────────────────────────────────────────────────────────────

export function validateSolution(puzzle: Puzzle, playerPaths: PlayerPath): boolean {
  const totalCells = GRID_SIZE * GRID_SIZE;
  const usedCells = new Set<string>();

  for (const pair of puzzle.pairs) {
    const path = playerPaths[pair.color];
    if (!path || path.length === 0) return false;

    // Path must start/end at pair endpoints (in either order)
    const pathStart = path[0];
    const pathEnd = path[path.length - 1];

    const matchForward =
      areCellsEqual(pathStart, pair.start) && areCellsEqual(pathEnd, pair.end);
    const matchReverse =
      areCellsEqual(pathStart, pair.end) && areCellsEqual(pathEnd, pair.start);

    if (!matchForward && !matchReverse) return false;

    // Path must be contiguous (each consecutive pair is adjacent)
    for (let i = 1; i < path.length; i++) {
      const dr = Math.abs(path[i].row - path[i - 1].row);
      const dc = Math.abs(path[i].col - path[i - 1].col);
      if (dr + dc !== 1) return false;
    }

    // No duplicate cells within this path and no overlap with other paths
    for (const cell of path) {
      const key = cellKey(cell.row, cell.col);
      if (usedCells.has(key)) return false;
      usedCells.add(key);
    }
  }

  // All 36 cells must be covered
  return usedCells.size === totalCells;
}
