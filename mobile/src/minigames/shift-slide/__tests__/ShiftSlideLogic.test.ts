import {
  createSolvedBoard,
  getEmptyIndex,
  getValidMoves,
  applyMove,
  isSolved,
  scrambleBoard,
  tileSrcRect,
  tileDestRect,
  type Board,
} from '../ShiftSlideLogic';

describe('ShiftSlideLogic', () => {
  // ---- createSolvedBoard ----
  describe('createSolvedBoard', () => {
    it('returns a board of 9 elements with values 0–8', () => {
      const board = createSolvedBoard();
      expect(board).toHaveLength(9);
      expect(board).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('is in solved state', () => {
      const board = createSolvedBoard();
      expect(isSolved(board)).toBe(true);
    });
  });

  // ---- getValidMoves ----
  describe('getValidMoves', () => {
    it('returns 2 moves when empty slot is in top-left corner (index 0)', () => {
      const board: Board = [8, 0, 1, 2, 3, 4, 5, 6, 7];
      const moves = getValidMoves(board);
      expect(moves).toHaveLength(2);
      // Down (index 3) and Right (index 1)
      expect(moves).toContain(3);
      expect(moves).toContain(1);
    });

    it('returns 2 moves when empty slot is in bottom-right corner (index 8)', () => {
      const board = createSolvedBoard(); // empty at index 8
      const moves = getValidMoves(board);
      expect(moves).toHaveLength(2);
      // Up (index 5) and Left (index 7)
      expect(moves).toContain(5);
      expect(moves).toContain(7);
    });

    it('returns 3 moves when empty slot is on an edge (index 1)', () => {
      // Empty at top edge, middle column
      const board: Board = [0, 8, 1, 2, 3, 4, 5, 6, 7];
      const moves = getValidMoves(board);
      expect(moves).toHaveLength(3);
      // Down (index 4), Left (index 0), Right (index 2)
      expect(moves).toContain(4);
      expect(moves).toContain(0);
      expect(moves).toContain(2);
    });

    it('returns 4 moves when empty slot is in center (index 4)', () => {
      const board: Board = [0, 1, 2, 3, 8, 4, 5, 6, 7];
      const moves = getValidMoves(board);
      expect(moves).toHaveLength(4);
      // Up (1), Down (7), Left (3), Right (5)
      expect(moves).toContain(1);
      expect(moves).toContain(7);
      expect(moves).toContain(3);
      expect(moves).toContain(5);
    });

    it('returns 2 moves when empty slot is in top-right corner (index 2)', () => {
      const board: Board = [0, 1, 8, 2, 3, 4, 5, 6, 7];
      const moves = getValidMoves(board);
      expect(moves).toHaveLength(2);
      // Down (index 5) and Left (index 1)
      expect(moves).toContain(5);
      expect(moves).toContain(1);
    });

    it('returns 3 moves when empty slot is on left edge (index 3)', () => {
      const board: Board = [0, 1, 2, 8, 3, 4, 5, 6, 7];
      const moves = getValidMoves(board);
      expect(moves).toHaveLength(3);
      // Up (0), Down (6), Right (4)
      expect(moves).toContain(0);
      expect(moves).toContain(6);
      expect(moves).toContain(4);
    });
  });

  // ---- applyMove ----
  describe('applyMove', () => {
    it('swaps the tapped tile with the empty slot', () => {
      const board = createSolvedBoard(); // empty at 8
      const newBoard = applyMove(board, 7); // slide tile 7
      expect(newBoard[8]).toBe(7);
      expect(newBoard[7]).toBe(8);
      // Original not mutated
      expect(board[7]).toBe(7);
      expect(board[8]).toBe(8);
    });

    it('throws for an invalid move', () => {
      const board = createSolvedBoard(); // empty at 8
      // Index 0 is not adjacent to 8
      expect(() => applyMove(board, 0)).toThrow('Invalid move');
    });

    it('does not mutate the original board', () => {
      const board = createSolvedBoard();
      const copy = [...board];
      applyMove(board, 7);
      expect(board).toEqual(copy);
    });
  });

  // ---- isSolved ----
  describe('isSolved', () => {
    it('returns true for a solved board', () => {
      expect(isSolved(createSolvedBoard())).toBe(true);
    });

    it('returns false for an unsolved board', () => {
      const board = createSolvedBoard();
      const unsolved = applyMove(board, 7);
      expect(isSolved(unsolved)).toBe(false);
    });
  });

  // ---- scrambleBoard ----
  describe('scrambleBoard', () => {
    it('returns a board of 9 elements', () => {
      const board = scrambleBoard(createSolvedBoard(), 150, 12345);
      expect(board).toHaveLength(9);
    });

    it('contains all values 0–8 exactly once', () => {
      const board = scrambleBoard(createSolvedBoard(), 150, 99999);
      const sorted = [...board].sort((a, b) => a - b);
      expect(sorted).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('differs from the solved state after 150 moves', () => {
      const solved = createSolvedBoard();
      const scrambled = scrambleBoard(solved, 150, 42);
      expect(scrambled).not.toEqual(solved);
    });

    it('is deterministic with the same seed', () => {
      const a = scrambleBoard(createSolvedBoard(), 150, 777);
      const b = scrambleBoard(createSolvedBoard(), 150, 777);
      expect(a).toEqual(b);
    });

    it('produces different results with different seeds', () => {
      const a = scrambleBoard(createSolvedBoard(), 150, 1);
      const b = scrambleBoard(createSolvedBoard(), 150, 2);
      expect(a).not.toEqual(b);
    });

    it('is solvable (generated from solved state via valid moves)', () => {
      const board = scrambleBoard(createSolvedBoard(), 50, 123);
      // Verify it has one empty tile (value 8)
      const emptyCount = board.filter((v) => v === 8).length;
      expect(emptyCount).toBe(1);
      // Verify all tiles present
      const sorted = [...board].sort((a, b) => a - b);
      expect(sorted).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  // ---- tileSrcRect ----
  describe('tileSrcRect', () => {
    it('returns top-left region for tile 0', () => {
      const r = tileSrcRect(0, 300, 300);
      expect(r).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    });

    it('returns correct region for tile 4 (row 1, col 1 — center)', () => {
      const r = tileSrcRect(4, 300, 300);
      expect(r).toEqual({ x: 100, y: 100, width: 100, height: 100 });
    });

    it('returns correct region for tile 7 (row 2, col 1)', () => {
      const r = tileSrcRect(7, 300, 300);
      expect(r).toEqual({ x: 100, y: 200, width: 100, height: 100 });
    });

    it('returns zeroes for tile 8 (empty)', () => {
      const r = tileSrcRect(8, 300, 300);
      expect(r).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('handles non-square images', () => {
      const r = tileSrcRect(2, 600, 300);
      // col=2, row=0 → x=400, y=0, w=200, h=100
      expect(r).toEqual({ x: 400, y: 0, width: 200, height: 100 });
    });
  });

  // ---- tileDestRect ----
  describe('tileDestRect', () => {
    it('returns correct position for index 0', () => {
      const r = tileDestRect(0, 100);
      expect(r).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    });

    it('returns correct position for index 4 (row 1, col 1 — center)', () => {
      const r = tileDestRect(4, 100);
      expect(r).toEqual({ x: 100, y: 100, width: 100, height: 100 });
    });

    it('returns correct position for index 8 (row 2, col 2)', () => {
      const r = tileDestRect(8, 100);
      expect(r).toEqual({ x: 200, y: 200, width: 100, height: 100 });
    });
  });

  // ---- getEmptyIndex ----
  describe('getEmptyIndex', () => {
    it('finds the empty slot', () => {
      const board = createSolvedBoard();
      expect(getEmptyIndex(board)).toBe(8);
    });

    it('finds empty slot when moved', () => {
      const board = applyMove(createSolvedBoard(), 7);
      expect(getEmptyIndex(board)).toBe(7);
    });
  });
});
