import {
  deriveClues,
  checkWin,
  validateSubmission,
  getEmptyGrid,
} from '../PathWeaverLogic';
import { IMAGE_GRIDS } from '../image_grids';

// ── deriveClues ────────────────────────────────────────────────────────

describe('deriveClues', () => {
  it('derives correct clues for mushroom grid', () => {
    const mushroom = IMAGE_GRIDS.find((p) => p.name === 'mushroom')!;
    const { rowClues, colClues } = deriveClues(mushroom.grid);
    expect(rowClues).toEqual(mushroom.rowClues);
    expect(colClues).toEqual(mushroom.colClues);
  });

  it('derives correct clues for leaf grid', () => {
    const leaf = IMAGE_GRIDS.find((p) => p.name === 'leaf')!;
    const { rowClues, colClues } = deriveClues(leaf.grid);
    expect(rowClues).toEqual(leaf.rowClues);
    expect(colClues).toEqual(leaf.colClues);
  });

  it('derives correct clues for cat grid', () => {
    const cat = IMAGE_GRIDS.find((p) => p.name === 'cat')!;
    const { rowClues, colClues } = deriveClues(cat.grid);
    expect(rowClues).toEqual(cat.rowClues);
    expect(colClues).toEqual(cat.colClues);
  });

  it('returns [0] for an all-zero row', () => {
    const grid = [
      [0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ];
    const { rowClues, colClues } = deriveClues(grid);
    expect(rowClues[0]).toEqual([0]);
    expect(rowClues[2]).toEqual([0]);
    // Column 0 has a single 1 in row 1
    expect(colClues[0]).toEqual([1]);
  });

  it('returns [0] for an all-zero column', () => {
    const grid = [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ];
    const { colClues } = deriveClues(grid);
    expect(colClues[0]).toEqual([0]);
    expect(colClues[6]).toEqual([0]);
  });

  it('returns [7] for a full row', () => {
    const grid = [
      [1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ];
    const { rowClues } = deriveClues(grid);
    expect(rowClues[0]).toEqual([7]);
  });
});

// ── checkWin ───────────────────────────────────────────────────────────

describe('checkWin', () => {
  it('returns true when grids match exactly', () => {
    const solution = [
      [1, 0, 1],
      [0, 1, 0],
      [1, 0, 1],
    ];
    const current = [
      [1, 0, 1],
      [0, 1, 0],
      [1, 0, 1],
    ];
    expect(checkWin(current, solution)).toBe(true);
  });

  it('returns false when one cell differs', () => {
    const solution = [
      [1, 0, 1],
      [0, 1, 0],
      [1, 0, 1],
    ];
    const current = [
      [1, 0, 1],
      [0, 0, 0], // center cell wrong
      [1, 0, 1],
    ];
    expect(checkWin(current, solution)).toBe(false);
  });

  it('works with full IMAGE_GRIDS puzzles', () => {
    const puzzle = IMAGE_GRIDS[0];
    expect(checkWin(puzzle.grid, puzzle.grid)).toBe(true);

    // Flip one cell
    const modified = puzzle.grid.map((r) => [...r]);
    modified[0][0] = modified[0][0] === 1 ? 0 : 1;
    expect(checkWin(modified, puzzle.grid)).toBe(false);
  });
});

// ── getEmptyGrid ───────────────────────────────────────────────────────

describe('getEmptyGrid', () => {
  it('returns correct dimensions', () => {
    const grid = getEmptyGrid(7);
    expect(grid.length).toBe(7);
    expect(grid[0].length).toBe(7);
  });

  it('returns all zeros', () => {
    const grid = getEmptyGrid(5);
    for (const row of grid) {
      for (const cell of row) {
        expect(cell).toBe(0);
      }
    }
  });

  it('returns independent rows (no shared references)', () => {
    const grid = getEmptyGrid(3);
    grid[0][0] = 1;
    expect(grid[1][0]).toBe(0);
  });
});

// ── validateSubmission ─────────────────────────────────────────────────

describe('validateSubmission', () => {
  it('returns true for matching grids', () => {
    const solution = [
      [1, 0],
      [0, 1],
    ];
    expect(validateSubmission(solution, solution)).toBe(true);
  });

  it('returns false for non-matching grids', () => {
    const solution = [
      [1, 0],
      [0, 1],
    ];
    const submission = [
      [0, 1],
      [1, 0],
    ];
    expect(validateSubmission(solution, submission)).toBe(false);
  });
});
