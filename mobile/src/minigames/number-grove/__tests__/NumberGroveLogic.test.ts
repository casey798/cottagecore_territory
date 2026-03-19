import {
  generatePuzzle,
  getConflicts,
  isComplete,
  validateSolution,
} from '../NumberGroveLogic';

// ── Helper: count givens (non-zero cells) in a puzzle grid ───────────

function countGivens(grid: number[][]): number {
  let count = 0;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (grid[r][c] !== 0) count++;
    }
  }
  return count;
}

// ── Helper: verify a complete grid is valid 6×6 sudoku ───────────────

function isValidComplete(grid: number[][]): boolean {
  // Rows
  for (let r = 0; r < 6; r++) {
    const row = new Set(grid[r]);
    if (row.size !== 6) return false;
    for (let d = 1; d <= 6; d++) {
      if (!row.has(d)) return false;
    }
  }
  // Cols
  for (let c = 0; c < 6; c++) {
    const col = new Set<number>();
    for (let r = 0; r < 6; r++) col.add(grid[r][c]);
    if (col.size !== 6) return false;
    for (let d = 1; d <= 6; d++) {
      if (!col.has(d)) return false;
    }
  }
  // Boxes (2×3)
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 2; bc++) {
      const box = new Set<number>();
      for (let dr = 0; dr < 2; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          box.add(grid[br * 2 + dr][bc * 3 + dc]);
        }
      }
      if (box.size !== 6) return false;
      for (let d = 1; d <= 6; d++) {
        if (!box.has(d)) return false;
      }
    }
  }
  return true;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('NumberGroveLogic', () => {
  describe('generatePuzzle', () => {
    it('returns a valid solution grid', () => {
      const { solution } = generatePuzzle();
      expect(solution.length).toBe(6);
      expect(solution[0].length).toBe(6);
      expect(isValidComplete(solution)).toBe(true);
    });

    it('returns a puzzle with exactly 24 givens', () => {
      const { puzzle } = generatePuzzle();
      expect(countGivens(puzzle)).toBe(24);
    });

    it('has givens that match the solution', () => {
      const { puzzle, solution } = generatePuzzle();
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if (puzzle[r][c] !== 0) {
            expect(puzzle[r][c]).toBe(solution[r][c]);
          }
        }
      }
    });

    it('has timeLimit of 120', () => {
      const { timeLimit } = generatePuzzle();
      expect(timeLimit).toBe(120);
    });

    it('has 180-degree rotational symmetry of empty cells', () => {
      const { puzzle } = generatePuzzle();
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          const isEmpty = puzzle[r][c] === 0;
          const mirrorEmpty = puzzle[5 - r][5 - c] === 0;
          expect(isEmpty).toBe(mirrorEmpty);
        }
      }
    });
  });

  describe('getConflicts', () => {
    it('returns empty set for a valid complete board', () => {
      const { solution } = generatePuzzle();
      const conflicts = getConflicts(solution);
      expect(conflicts.size).toBe(0);
    });

    it('detects row conflict', () => {
      const board = [
        [1, 1, 3, 4, 5, 6],
        [4, 5, 6, 1, 2, 3],
        [2, 3, 1, 5, 6, 4],
        [5, 6, 4, 2, 3, 1],
        [3, 4, 2, 6, 1, 5],
        [6, 2, 5, 3, 4, 0],
      ];
      const conflicts = getConflicts(board);
      // row 0 has two 1s at (0,0) and (0,1)
      expect(conflicts.has('0,0')).toBe(true);
      expect(conflicts.has('0,1')).toBe(true);
    });

    it('detects column conflict', () => {
      const board = [
        [1, 2, 3, 4, 5, 6],
        [1, 5, 6, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ];
      const conflicts = getConflicts(board);
      // col 0 has two 1s at (0,0) and (1,0)
      expect(conflicts.has('0,0')).toBe(true);
      expect(conflicts.has('1,0')).toBe(true);
    });

    it('detects box conflict', () => {
      const board = [
        [1, 2, 3, 0, 0, 0],
        [0, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ];
      const conflicts = getConflicts(board);
      // box 0 (rows 0-1, cols 0-2) has two 1s at (0,0) and (1,2)
      expect(conflicts.has('0,0')).toBe(true);
      expect(conflicts.has('1,2')).toBe(true);
    });

    it('marks both duplicates as conflicting', () => {
      const board = [
        [3, 2, 3, 4, 5, 6],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ];
      const conflicts = getConflicts(board);
      expect(conflicts.has('0,0')).toBe(true);
      expect(conflicts.has('0,2')).toBe(true);
    });

    it('does not flag zero cells', () => {
      const board = [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ];
      const conflicts = getConflicts(board);
      expect(conflicts.size).toBe(0);
    });
  });

  describe('isComplete', () => {
    it('returns true when board matches solution with no conflicts', () => {
      const { solution } = generatePuzzle();
      expect(isComplete(solution, solution)).toBe(true);
    });

    it('returns false when board has empty cells', () => {
      const { puzzle, solution } = generatePuzzle();
      expect(isComplete(puzzle, solution)).toBe(false);
    });

    it('returns false when board has conflicts', () => {
      const { solution } = generatePuzzle();
      const bad = solution.map((row) => [...row]);
      // Swap two cells in the same row to create a conflict
      const tmp = bad[0][0];
      bad[0][0] = bad[0][1];
      bad[0][1] = tmp;
      expect(isComplete(bad, solution)).toBe(false);
    });

    it('returns false when board does not match solution', () => {
      const { solution } = generatePuzzle();
      const wrong = solution.map((row) => [...row]);
      // Change a cell to a different valid-looking value
      wrong[0][0] = wrong[0][0] === 1 ? 2 : 1;
      expect(isComplete(wrong, solution)).toBe(false);
    });
  });

  describe('validateSolution', () => {
    it('accepts correct solution', () => {
      const { solution } = generatePuzzle();
      expect(validateSolution(solution, solution)).toBe(true);
    });

    it('rejects board with row duplicate', () => {
      const { solution } = generatePuzzle();
      const bad = solution.map((row) => [...row]);
      bad[0][0] = bad[0][1]; // create duplicate in row 0
      expect(validateSolution(bad, solution)).toBe(false);
    });

    it('rejects board that does not match solution', () => {
      const { solution } = generatePuzzle();
      const other = solution.map((row) => [...row]);
      // Swap two cells in row — might still be "valid sudoku" but won't match solution
      const tmp = other[2][0];
      other[2][0] = other[2][1];
      other[2][1] = tmp;
      expect(validateSolution(other, solution)).toBe(false);
    });

    it('rejects incomplete board', () => {
      const { puzzle, solution } = generatePuzzle();
      expect(validateSolution(puzzle, solution)).toBe(false);
    });
  });
});
