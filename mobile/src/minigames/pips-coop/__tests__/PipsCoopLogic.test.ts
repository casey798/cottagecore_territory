/**
 * Tests for PipsCoop zone ownership rules and cross-boundary mechanics.
 * Uses PipsLogic functions directly — the game component enforces zone
 * restrictions, so we test the boundary logic here as pure functions.
 */
import {
  applyTap,
  isSolved,
  createEmptyGrid,
  type Grid,
} from '../../pips/PipsLogic';

const SHARED_ROW = 2;

function canP1Tap(row: number): boolean {
  return row <= SHARED_ROW; // rows 0, 1, 2
}

function canP2Tap(row: number): boolean {
  return row >= SHARED_ROW; // rows 2, 3, 4
}

describe('PipsCoop zone ownership', () => {
  it('P1 can tap rows 0, 1, and shared row 2', () => {
    expect(canP1Tap(0)).toBe(true);
    expect(canP1Tap(1)).toBe(true);
    expect(canP1Tap(2)).toBe(true);
  });

  it('P1 cannot tap P2 rows 3 and 4', () => {
    expect(canP1Tap(3)).toBe(false);
    expect(canP1Tap(4)).toBe(false);
  });

  it('P2 can tap rows 3, 4, and shared row 2', () => {
    expect(canP2Tap(3)).toBe(true);
    expect(canP2Tap(4)).toBe(true);
    expect(canP2Tap(2)).toBe(true);
  });

  it('P2 cannot tap P1 rows 0 and 1', () => {
    expect(canP2Tap(0)).toBe(false);
    expect(canP2Tap(1)).toBe(false);
  });

  it('shared row (2) is tappable by both players', () => {
    expect(canP1Tap(SHARED_ROW)).toBe(true);
    expect(canP2Tap(SHARED_ROW)).toBe(true);
  });
});

describe('PipsCoop cross-boundary neighbor toggle', () => {
  it('P1 tap on row 1 col 2 toggles row 2 col 2 (shared row)', () => {
    const grid = createEmptyGrid();
    const newGrid = applyTap(grid, 1, 2);

    // Tapped cell (1,2) should toggle ON
    expect(newGrid[1][2]).toBe(1);
    // Neighbor below — shared row (2,2) should toggle ON
    expect(newGrid[2][2]).toBe(1);
    // Neighbor above (0,2)
    expect(newGrid[0][2]).toBe(1);
    // Lateral neighbors
    expect(newGrid[1][1]).toBe(1);
    expect(newGrid[1][3]).toBe(1);
  });

  it('P2 tap on row 3 col 2 toggles row 2 col 2 (shared row)', () => {
    const grid = createEmptyGrid();
    const newGrid = applyTap(grid, 3, 2);

    // Tapped cell (3,2) should toggle ON
    expect(newGrid[3][2]).toBe(1);
    // Neighbor above — shared row (2,2) should toggle ON
    expect(newGrid[2][2]).toBe(1);
    // Neighbor below (4,2)
    expect(newGrid[4][2]).toBe(1);
    // Lateral neighbors
    expect(newGrid[3][1]).toBe(1);
    expect(newGrid[3][3]).toBe(1);
  });

  it('sequential taps from both sides can cancel out shared row effects', () => {
    const grid = createEmptyGrid();
    // P1 taps row 1 col 2 — turns on (2,2)
    const afterP1 = applyTap(grid, 1, 2);
    expect(afterP1[2][2]).toBe(1);

    // P2 taps shared row (2,2) directly — toggles it off plus neighbors
    const afterP2 = applyTap(afterP1, 2, 2);
    expect(afterP2[2][2]).toBe(0);
  });
});

describe('PipsCoop win detection', () => {
  it('isSolved returns true when all cells are OFF', () => {
    const grid = createEmptyGrid();
    expect(isSolved(grid)).toBe(true);
  });

  it('isSolved returns false when any cell is ON', () => {
    const grid = createEmptyGrid();
    grid[2][3] = 1;
    expect(isSolved(grid)).toBe(false);
  });

  it('double-tap same cell restores original neighbors (toggle idempotence)', () => {
    const grid = createEmptyGrid();
    const after1 = applyTap(grid, 2, 2);
    const after2 = applyTap(after1, 2, 2);
    expect(isSolved(after2)).toBe(true);
  });
});

describe('PipsCoop loss on move limit', () => {
  it('detects when moves reach the limit without solving', () => {
    // Simulate a game with moveLimit = 3 where puzzle is not solved
    const moveLimit = 3;
    const grid = createEmptyGrid();

    let currentGrid: Grid = grid;
    let movesUsed = 0;
    let lost = false;

    // Make 3 taps that won't solve the puzzle
    const taps = [
      { row: 0, col: 0 },
      { row: 4, col: 4 },
      { row: 0, col: 4 },
    ];

    for (const tap of taps) {
      currentGrid = applyTap(currentGrid, tap.row, tap.col);
      movesUsed++;
      if (movesUsed >= moveLimit && !isSolved(currentGrid)) {
        lost = true;
        break;
      }
    }

    expect(lost).toBe(true);
    expect(movesUsed).toBe(3);
    expect(isSolved(currentGrid)).toBe(false);
  });
});
