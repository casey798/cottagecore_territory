/**
 * Tests for VineTrailCoop — word ownership classification, zone tap
 * restrictions, boundary word mechanics, and game flow.
 */
import {
  isAdjacent,
  type CellCoord,
} from '../../vine-trail/VineTrailLogic';
import {
  classifyWordOwnership,
  canPlayerTapRow,
  validateBoundaryPaths,
  type WordOwner,
} from '../VineTrailCoopGame';

// ── Word ownership classification ──────────────────────────────────

describe('classifyWordOwnership', () => {
  it('classifies word entirely in rows 0–3 as p1', () => {
    const words = [
      { canonicalPath: [[0, 0], [0, 1], [1, 1], [2, 1]] as CellCoord[] },
    ];
    const result = classifyWordOwnership(words);
    expect(result[0]).toBe('p1');
  });

  it('classifies word entirely in rows 4–7 as p2', () => {
    const words = [
      { canonicalPath: [[4, 0], [5, 0], [6, 0], [7, 0]] as CellCoord[] },
    ];
    const result = classifyWordOwnership(words);
    expect(result[0]).toBe('p2');
  });

  it('classifies word spanning rows 3 and 4 as boundary', () => {
    const words = [
      { canonicalPath: [[2, 0], [3, 0], [4, 0], [5, 0]] as CellCoord[] },
    ];
    const result = classifyWordOwnership(words);
    expect(result[0]).toBe('boundary');
  });

  it('classifies multiple words correctly in a single call', () => {
    const words = [
      { canonicalPath: [[0, 0], [1, 0]] as CellCoord[] },           // p1
      { canonicalPath: [[6, 0], [7, 0]] as CellCoord[] },           // p2
      { canonicalPath: [[3, 0], [4, 0]] as CellCoord[] },           // boundary
      { canonicalPath: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]] as CellCoord[] }, // boundary (spangram-like)
    ];
    const result = classifyWordOwnership(words);
    expect(result).toEqual(['p1', 'p2', 'boundary', 'boundary']);
  });

  it('word with all cells at row 3 boundary is still p1', () => {
    const words = [
      { canonicalPath: [[3, 0], [3, 1], [3, 2]] as CellCoord[] },
    ];
    const result = classifyWordOwnership(words);
    expect(result[0]).toBe('p1');
  });

  it('word with all cells at row 4 is p2', () => {
    const words = [
      { canonicalPath: [[4, 0], [4, 1], [4, 2]] as CellCoord[] },
    ];
    const result = classifyWordOwnership(words);
    expect(result[0]).toBe('p2');
  });
});

// ── Zone tap restrictions ──────────────────────────────────────────

describe('canPlayerTapRow', () => {
  it('P1 can tap rows 0–3', () => {
    expect(canPlayerTapRow('p1', 0)).toBe(true);
    expect(canPlayerTapRow('p1', 1)).toBe(true);
    expect(canPlayerTapRow('p1', 2)).toBe(true);
    expect(canPlayerTapRow('p1', 3)).toBe(true);
  });

  it('P1 cannot tap rows 4–7', () => {
    expect(canPlayerTapRow('p1', 4)).toBe(false);
    expect(canPlayerTapRow('p1', 5)).toBe(false);
    expect(canPlayerTapRow('p1', 6)).toBe(false);
    expect(canPlayerTapRow('p1', 7)).toBe(false);
  });

  it('P2 can tap rows 4–7', () => {
    expect(canPlayerTapRow('p2', 4)).toBe(true);
    expect(canPlayerTapRow('p2', 5)).toBe(true);
    expect(canPlayerTapRow('p2', 6)).toBe(true);
    expect(canPlayerTapRow('p2', 7)).toBe(true);
  });

  it('P2 cannot tap rows 0–3', () => {
    expect(canPlayerTapRow('p2', 0)).toBe(false);
    expect(canPlayerTapRow('p2', 1)).toBe(false);
    expect(canPlayerTapRow('p2', 2)).toBe(false);
    expect(canPlayerTapRow('p2', 3)).toBe(false);
  });
});

// ── Boundary word mechanics ────────────────────────────────────────

describe('validateBoundaryPaths', () => {
  it('requires both paths to be non-empty', () => {
    const result1 = validateBoundaryPaths([], [[4, 0]]);
    expect(result1.valid).toBe(false);

    const result2 = validateBoundaryPaths([[3, 0]], []);
    expect(result2.valid).toBe(false);

    const result3 = validateBoundaryPaths([], []);
    expect(result3.valid).toBe(false);
  });

  it('validates adjacent connection P1-end to P2-start', () => {
    const p1Path: CellCoord[] = [[2, 0], [3, 0]];
    const p2Path: CellCoord[] = [[4, 0], [5, 0]];
    // (3,0) and (4,0) are adjacent (differ by 1 row)
    const result = validateBoundaryPaths(p1Path, p2Path);
    expect(result.valid).toBe(true);
    expect(result.combinedPath).toEqual([[2, 0], [3, 0], [4, 0], [5, 0]]);
  });

  it('validates adjacent connection P2-end to P1-start', () => {
    const p1Path: CellCoord[] = [[3, 0]];
    const p2Path: CellCoord[] = [[5, 0], [4, 0]];
    // P2 ends at (4,0), P1 starts at (3,0) — adjacent
    const result = validateBoundaryPaths(p1Path, p2Path);
    expect(result.valid).toBe(true);
    expect(result.combinedPath).toEqual([[5, 0], [4, 0], [3, 0]]);
  });

  it('rejects non-adjacent boundary connection', () => {
    const p1Path: CellCoord[] = [[1, 0], [2, 0]];
    const p2Path: CellCoord[] = [[5, 0], [6, 0]];
    // (2,0) and (5,0) are NOT adjacent (differ by 3 rows)
    // (6,0) and (1,0) are NOT adjacent either
    const result = validateBoundaryPaths(p1Path, p2Path);
    expect(result.valid).toBe(false);
  });

  it('validates diagonal adjacency at boundary', () => {
    const p1Path: CellCoord[] = [[3, 0]];
    const p2Path: CellCoord[] = [[4, 1]];
    // (3,0) and (4,1) are diagonally adjacent
    const result = validateBoundaryPaths(p1Path, p2Path);
    expect(result.valid).toBe(true);
  });

  it('combined path preserves all cells from both players', () => {
    const p1Path: CellCoord[] = [[2, 1], [3, 1]];
    const p2Path: CellCoord[] = [[4, 1], [5, 1], [6, 1]];
    const result = validateBoundaryPaths(p1Path, p2Path);
    expect(result.valid).toBe(true);
    expect(result.combinedPath.length).toBe(5);
  });
});

// ── isAdjacent at boundary ─────────────────────────────────────────

describe('isAdjacent at zone boundary', () => {
  it('row 3 and row 4 same col are adjacent', () => {
    expect(isAdjacent([3, 2], [4, 2])).toBe(true);
  });

  it('row 3 and row 4 diagonal are adjacent', () => {
    expect(isAdjacent([3, 2], [4, 3])).toBe(true);
    expect(isAdjacent([3, 3], [4, 2])).toBe(true);
  });

  it('row 3 and row 5 are NOT adjacent', () => {
    expect(isAdjacent([3, 2], [5, 2])).toBe(false);
  });

  it('same cell is NOT adjacent to itself', () => {
    expect(isAdjacent([3, 2], [3, 2])).toBe(false);
  });
});

// ── Non-boundary word ownership ────────────────────────────────────

describe('non-boundary word submitted by owning player only', () => {
  it('P1 word cells are all in rows 0–3', () => {
    const p1Word: CellCoord[] = [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1]];
    // All rows < 4
    const allInP1Zone = p1Word.every(([r]) => canPlayerTapRow('p1', r));
    expect(allInP1Zone).toBe(true);
    // None in P2 zone
    const anyInP2Zone = p1Word.some(([r]) => canPlayerTapRow('p2', r));
    expect(anyInP2Zone).toBe(false);
  });

  it('P2 word cells are all in rows 4–7', () => {
    const p2Word: CellCoord[] = [[4, 0], [5, 0], [6, 0], [7, 0]];
    const allInP2Zone = p2Word.every(([r]) => canPlayerTapRow('p2', r));
    expect(allInP2Zone).toBe(true);
    const anyInP1Zone = p2Word.some(([r]) => canPlayerTapRow('p1', r));
    expect(anyInP1Zone).toBe(false);
  });

  it('P1 cannot physically trace P2 word (canPlayerTapRow blocks)', () => {
    const p2Cells: CellCoord[] = [[5, 0], [6, 0]];
    for (const [r] of p2Cells) {
      expect(canPlayerTapRow('p1', r)).toBe(false);
    }
  });
});

// ── Timeout triggers loss ──────────────────────────────────────────

describe('timeout triggers loss', () => {
  it('tickTimer sets gameOver when timeElapsed reaches timeLimit', () => {
    // Import tickTimer to verify behavior
    const { tickTimer } = require('../../vine-trail/VineTrailLogic');
    const { initGame } = require('../../vine-trail/VineTrailLogic');
    const { vineTrailPacks } = require('../../vine-trail/vineTrailPacks');

    const pack = vineTrailPacks[0];
    let state = initGame(pack);
    state = { ...state, timeElapsed: 119 }; // 1 second before limit

    const newState = tickTimer(state, 120);
    expect(newState.timeElapsed).toBe(120);
    expect(newState.gameOver).toBe(true);
  });

  it('tickTimer does not set gameOver before timeLimit', () => {
    const { tickTimer } = require('../../vine-trail/VineTrailLogic');
    const { initGame } = require('../../vine-trail/VineTrailLogic');
    const { vineTrailPacks } = require('../../vine-trail/vineTrailPacks');

    const pack = vineTrailPacks[0];
    let state = initGame(pack);
    state = { ...state, timeElapsed: 50 };

    const newState = tickTimer(state, 120);
    expect(newState.timeElapsed).toBe(51);
    expect(newState.gameOver).toBe(false);
  });
});
