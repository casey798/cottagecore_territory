import {
  createEmptyGrid,
  applyTap,
  isSolved,
  generatePuzzle,
  type Grid,
} from '../PipsLogic';

describe('applyTap', () => {
  it('tapping (2,2) center toggles exactly 5 cells', () => {
    const grid = createEmptyGrid();
    const result = applyTap(grid, 2, 2);

    expect(result[2][2]).toBe(1); // center
    expect(result[1][2]).toBe(1); // up
    expect(result[3][2]).toBe(1); // down
    expect(result[2][1]).toBe(1); // left
    expect(result[2][3]).toBe(1); // right

    // Count total ON cells — should be exactly 5
    let onCount = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (result[r][c] === 1) onCount++;
      }
    }
    expect(onCount).toBe(5);
  });

  it('tapping (0,0) corner toggles exactly 3 cells', () => {
    const grid = createEmptyGrid();
    const result = applyTap(grid, 0, 0);

    expect(result[0][0]).toBe(1);
    expect(result[0][1]).toBe(1);
    expect(result[1][0]).toBe(1);

    let onCount = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (result[r][c] === 1) onCount++;
      }
    }
    expect(onCount).toBe(3);
  });

  it('tapping (0,2) edge toggles exactly 4 cells', () => {
    const grid = createEmptyGrid();
    const result = applyTap(grid, 0, 2);

    expect(result[0][2]).toBe(1); // self
    expect(result[0][1]).toBe(1); // left
    expect(result[0][3]).toBe(1); // right
    expect(result[1][2]).toBe(1); // down

    let onCount = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (result[r][c] === 1) onCount++;
      }
    }
    expect(onCount).toBe(4);
  });

  it('tapping same cell twice returns to original grid', () => {
    const grid = createEmptyGrid();
    const after1 = applyTap(grid, 2, 2);
    const after2 = applyTap(after1, 2, 2);

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        expect(after2[r][c]).toBe(0);
      }
    }
  });

  it('does not mutate the original grid', () => {
    const grid = createEmptyGrid();
    const gridCopy = grid.map((r) => [...r]);
    applyTap(grid, 2, 2);

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        expect(grid[r][c]).toBe(gridCopy[r][c]);
      }
    }
  });
});

describe('isSolved', () => {
  it('all-zero grid returns true', () => {
    expect(isSolved(createEmptyGrid())).toBe(true);
  });

  it('grid with one ON cell returns false', () => {
    const grid = createEmptyGrid();
    grid[3][3] = 1;
    expect(isSolved(grid)).toBe(false);
  });

  it('grid with all ON cells returns false', () => {
    const grid: Grid = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => 1 as const),
    );
    expect(isSolved(grid)).toBe(false);
  });
});

describe('generatePuzzle', () => {
  it('passes all invariants over 50 runs', () => {
    for (let i = 0; i < 50; i++) {
      const { startGrid, solutionTaps, moveLimit } = generatePuzzle();

      // startGrid has at least 8 ON cells
      let onCount = 0;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (startGrid[r][c] === 1) onCount++;
        }
      }
      expect(onCount).toBeGreaterThanOrEqual(8);

      // startGrid is not already solved
      expect(isSolved(startGrid)).toBe(false);

      // moveLimit === solutionTaps.length + 2
      expect(moveLimit).toBe(solutionTaps.length + 2);

      // Replaying solutionTaps solves the puzzle
      let grid: Grid = startGrid.map((r) => [...r]);
      for (const tap of solutionTaps) {
        grid = applyTap(grid, tap.row, tap.col);
      }
      expect(isSolved(grid)).toBe(true);

      // solutionTaps length is between 5 and 8
      expect(solutionTaps.length).toBeGreaterThanOrEqual(5);
      expect(solutionTaps.length).toBeLessThanOrEqual(8);
    }
  });
});

describe('round-trip with known taps', () => {
  it('manually applying 2 taps and replaying solves the grid', () => {
    const tap1 = { row: 0, col: 0 };
    const tap2 = { row: 4, col: 4 };

    let grid = createEmptyGrid();
    grid = applyTap(grid, tap1.row, tap1.col);
    grid = applyTap(grid, tap2.row, tap2.col);

    // Grid should not be solved yet (non-overlapping taps)
    expect(isSolved(grid)).toBe(false);

    // Replay same taps to solve
    grid = applyTap(grid, tap1.row, tap1.col);
    grid = applyTap(grid, tap2.row, tap2.col);
    expect(isSolved(grid)).toBe(true);
  });
});
