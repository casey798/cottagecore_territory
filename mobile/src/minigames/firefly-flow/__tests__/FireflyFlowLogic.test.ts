import {
  generatePuzzle,
  validateSolution,
  areCellsEqual,
  isCellInPath,
  getAdjacentCells,
  GRID_SIZE,
  PAIR_COLORS,
  type Cell,
  type Puzzle,
  type PlayerPath,
  type PairColor,
} from '../FireflyFlowLogic';

describe('areCellsEqual', () => {
  it('returns true for identical cells', () => {
    expect(areCellsEqual({ row: 2, col: 3 }, { row: 2, col: 3 })).toBe(true);
  });

  it('returns false for different cells', () => {
    expect(areCellsEqual({ row: 2, col: 3 }, { row: 3, col: 2 })).toBe(false);
  });
});

describe('isCellInPath', () => {
  const path: Cell[] = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 1 },
  ];

  it('returns true when cell is in path', () => {
    expect(isCellInPath({ row: 0, col: 1 }, path)).toBe(true);
  });

  it('returns false when cell is not in path', () => {
    expect(isCellInPath({ row: 3, col: 3 }, path)).toBe(false);
  });
});

describe('getAdjacentCells', () => {
  it('returns 4 neighbors for center cell', () => {
    const adj = getAdjacentCells({ row: 3, col: 3 }, GRID_SIZE);
    expect(adj).toHaveLength(4);
    expect(adj).toContainEqual({ row: 2, col: 3 });
    expect(adj).toContainEqual({ row: 4, col: 3 });
    expect(adj).toContainEqual({ row: 3, col: 2 });
    expect(adj).toContainEqual({ row: 3, col: 4 });
  });

  it('returns 2 neighbors for corner cell (0,0)', () => {
    const adj = getAdjacentCells({ row: 0, col: 0 }, GRID_SIZE);
    expect(adj).toHaveLength(2);
    expect(adj).toContainEqual({ row: 1, col: 0 });
    expect(adj).toContainEqual({ row: 0, col: 1 });
  });

  it('returns 2 neighbors for corner cell (5,5)', () => {
    const adj = getAdjacentCells({ row: 5, col: 5 }, GRID_SIZE);
    expect(adj).toHaveLength(2);
    expect(adj).toContainEqual({ row: 4, col: 5 });
    expect(adj).toContainEqual({ row: 5, col: 4 });
  });

  it('returns 3 neighbors for edge cell (0,3)', () => {
    const adj = getAdjacentCells({ row: 0, col: 3 }, GRID_SIZE);
    expect(adj).toHaveLength(3);
  });
});

describe('generatePuzzle', () => {
  it('returns a puzzle with 4 or 5 pairs', () => {
    const puzzle = generatePuzzle();
    expect(puzzle.pairs.length).toBeGreaterThanOrEqual(4);
    expect(puzzle.pairs.length).toBeLessThanOrEqual(5);
  });

  it('has grid size of 6', () => {
    const puzzle = generatePuzzle();
    expect(puzzle.grid).toBe(6);
  });

  it('uses valid pair colors', () => {
    const puzzle = generatePuzzle();
    for (const pair of puzzle.pairs) {
      expect(PAIR_COLORS).toContain(pair.color);
    }
  });

  it('passes all quality checks over 20 iterations', () => {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle();

      // Correct pair count
      expect(puzzle.pairs.length).toBeGreaterThanOrEqual(4);
      expect(puzzle.pairs.length).toBeLessThanOrEqual(5);

      // Each path has at least 3 cells
      for (const pair of puzzle.pairs) {
        const path = puzzle.solution[pair.color];
        expect(path.length).toBeGreaterThanOrEqual(3);
      }

      // No pair's start and end are adjacent (Manhattan dist >= 2)
      for (const pair of puzzle.pairs) {
        const dist = Math.abs(pair.start.row - pair.end.row) + Math.abs(pair.start.col - pair.end.col);
        expect(dist).toBeGreaterThanOrEqual(2);
      }

      // All selected pair colors are present
      const colors = puzzle.pairs.map((p) => p.color);
      expect(new Set(colors).size).toBe(colors.length); // no duplicates
    }
  });

  it('has exactly 36 cells covered in solution over 20 iterations', () => {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle();
      const allCells = new Set<string>();

      for (const pair of puzzle.pairs) {
        const path = puzzle.solution[pair.color];
        for (const cell of path) {
          allCells.add(`${cell.row},${cell.col}`);
        }
      }

      expect(allCells.size).toBe(36);
    }
  });

  it('has no overlapping paths in solution over 20 iterations', () => {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle();
      const allCells: string[] = [];

      for (const pair of puzzle.pairs) {
        const path = puzzle.solution[pair.color];
        for (const cell of path) {
          allCells.push(`${cell.row},${cell.col}`);
        }
      }

      // No duplicates
      expect(new Set(allCells).size).toBe(allCells.length);
    }
  });
});

describe('validateSolution', () => {
  it('returns true for the puzzle\'s own solution', () => {
    for (let i = 0; i < 10; i++) {
      const puzzle = generatePuzzle();
      expect(validateSolution(puzzle, puzzle.solution)).toBe(true);
    }
  });

  it('returns false if one path is missing', () => {
    const puzzle = generatePuzzle();
    const incomplete: PlayerPath = { ...puzzle.solution };
    // Remove the first pair's path
    delete (incomplete as Record<string, Cell[]>)[puzzle.pairs[0].color];
    expect(validateSolution(puzzle, incomplete)).toBe(false);
  });

  it('returns false if grid is not fully covered', () => {
    const puzzle = generatePuzzle();
    const partial: PlayerPath = { ...puzzle.solution };
    // Trim the first pair's path by one cell
    const firstColor = puzzle.pairs[0].color;
    const path = [...partial[firstColor]];
    if (path.length > 2) {
      path.pop();
      partial[firstColor] = path;
    }
    expect(validateSolution(puzzle, partial)).toBe(false);
  });

  it('returns false if two paths overlap', () => {
    const puzzle = generatePuzzle();
    const overlapping: PlayerPath = { ...puzzle.solution };
    // Make two paths share a cell by copying first cell of path B onto end of path A
    if (puzzle.pairs.length >= 2) {
      const colorA = puzzle.pairs[0].color;
      const colorB = puzzle.pairs[1].color;
      const pathA = [...overlapping[colorA]];
      const pathB = overlapping[colorB];
      if (pathB.length > 0) {
        // Insert a cell from pathB into pathA (makes overlap + breaks coverage)
        pathA.push(pathB[0]);
        overlapping[colorA] = pathA;
      }
    }
    expect(validateSolution(puzzle, overlapping)).toBe(false);
  });

  it('returns false if path does not connect endpoints', () => {
    const puzzle = generatePuzzle();
    const wrong: PlayerPath = { ...puzzle.solution };
    // Reverse only the first path's array but also swap start/end cells to mess up connectivity
    const color = puzzle.pairs[0].color;
    const path = [...wrong[color]];
    // Just remove the last cell — path won't reach endpoint
    if (path.length > 2) {
      path.splice(path.length - 1, 1);
      wrong[color] = path;
    }
    expect(validateSolution(puzzle, wrong)).toBe(false);
  });
});
