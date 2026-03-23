/**
 * Firefly Flow — Pure puzzle generation and validation logic.
 * No React dependencies.
 *
 * The puzzle is a 6×6 grid where 4–5 colored pairs of endpoints must be
 * connected by non-overlapping paths that cover every cell.
 */

import { CLAN_COLORS } from '@/constants/colors';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Cell {
  row: number;
  col: number;
}

export type PairColor = 'ember' | 'tide' | 'bloom' | 'gale' | 'hearth';

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

export const PAIR_COLORS: PairColor[] = ['ember', 'tide', 'bloom', 'gale', 'hearth'];

const HEARTH_COLOR = '#9B59B6';

export const COLOR_HEX: Record<PairColor, string> = {
  ember: CLAN_COLORS.ember,
  tide: CLAN_COLORS.tide,
  bloom: CLAN_COLORS.bloom,
  gale: CLAN_COLORS.gale,
  hearth: HEARTH_COLOR,
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

  for (let attempt = 0; attempt < 200; attempt++) {
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
      // Path must be at least 5 cells
      if (path.length < 5) {
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

  // Fallback: pick from hand-authored puzzles
  return pickFallbackPuzzle();
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

// ─── Hand-authored fallback puzzles ─────────────────────────────────────────

interface FallbackDef {
  paths: Array<{ color: PairColor; cells: Array<[number, number]> }>;
}

const FALLBACK_PUZZLES: FallbackDef[] = [
  // Puzzle 1 — 4 pairs, 9 cells each, S-curve quadrants
  {
    paths: [
      { color: 'ember', cells: [[0,0],[0,1],[0,2],[1,2],[1,1],[1,0],[2,0],[2,1],[2,2]] },
      { color: 'tide',  cells: [[0,3],[0,4],[0,5],[1,5],[1,4],[1,3],[2,3],[2,4],[2,5]] },
      { color: 'bloom', cells: [[3,5],[3,4],[3,3],[4,3],[4,4],[4,5],[5,5],[5,4],[5,3]] },
      { color: 'gale',  cells: [[3,2],[3,1],[3,0],[4,0],[4,1],[4,2],[5,2],[5,1],[5,0]] },
    ],
  },
  // Puzzle 2 — 5 pairs, vertical zigzag columns
  {
    paths: [
      { color: 'ember',  cells: [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[5,1],[4,1]] },
      { color: 'tide',   cells: [[3,1],[2,1],[1,1],[0,1],[0,2],[1,2],[2,2]] },
      { color: 'bloom',  cells: [[3,2],[4,2],[5,2],[5,3],[4,3],[3,3],[2,3]] },
      { color: 'gale',   cells: [[1,3],[0,3],[0,4],[1,4],[2,4],[3,4],[4,4]] },
      { color: 'hearth', cells: [[0,5],[1,5],[2,5],[3,5],[4,5],[5,5],[5,4]] },
    ],
  },
  // Puzzle 3 — 4 pairs, interleaved serpentine
  {
    paths: [
      { color: 'ember', cells: [[0,0],[1,0],[2,0],[2,1],[1,1],[0,1],[0,2],[1,2],[2,2]] },
      { color: 'tide',  cells: [[0,3],[1,3],[2,3],[2,4],[1,4],[0,4],[0,5],[1,5],[2,5]] },
      { color: 'bloom', cells: [[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[4,5],[4,4],[4,3]] },
      { color: 'gale',  cells: [[4,0],[5,0],[5,1],[4,1],[4,2],[5,2],[5,3],[5,4],[5,5]] },
    ],
  },
  // Puzzle 4 — 5 pairs, winding columns with cross-over
  {
    paths: [
      { color: 'ember',  cells: [[0,0],[0,1],[1,1],[1,0],[2,0],[2,1],[3,1],[3,0]] },
      { color: 'tide',   cells: [[0,2],[0,3],[1,3],[1,2],[2,2],[2,3],[3,3]] },
      { color: 'bloom',  cells: [[0,4],[0,5],[1,5],[1,4],[2,4],[2,5],[3,5]] },
      { color: 'gale',   cells: [[3,2],[4,2],[4,1],[4,0],[5,0],[5,1],[5,2]] },
      { color: 'hearth', cells: [[3,4],[4,4],[4,3],[5,3],[5,4],[5,5],[4,5]] },
    ],
  },
];

function pickFallbackPuzzle(): Puzzle {
  const def = FALLBACK_PUZZLES[Math.floor(Math.random() * FALLBACK_PUZZLES.length)];

  const pairs: Pair[] = [];
  const solution: Record<string, Cell[]> = {};

  for (const p of def.paths) {
    const cells: Cell[] = p.cells.map(([row, col]) => ({ row, col }));
    solution[p.color] = cells;
    pairs.push({
      color: p.color,
      start: cells[0],
      end: cells[cells.length - 1],
    });
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
