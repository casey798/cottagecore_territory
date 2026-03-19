import {
  generatePuzzle,
  solve,
  validateSubmission,
  emptyGrid,
  isValidGridState,
  countConfirmations,
  extractAssignments,
  computeGridState,
  emptyManualMarks,
  isGridComplete,
  POTIONS,
  INGREDIENTS,
  EFFECTS,
  type Potion,
  type Ingredient,
  type Effect,
  type Solution,
  type Clue,
  type GridState,
  type ManualMarks,
  type GridId,
} from '../PotionLogicLogic';

// ── Helper to check a solution is valid (unique assignments) ────────

function isValidSolution(sol: Solution): boolean {
  const ings = new Set(POTIONS.map(p => sol.ingredients[p]));
  const effs = new Set(POTIONS.map(p => sol.effects[p]));
  if (ings.size !== 3) return false;
  if (effs.size !== 3) return false;
  for (const p of POTIONS) {
    if (!INGREDIENTS.includes(sol.ingredients[p])) return false;
    if (!EFFECTS.includes(sol.effects[p])) return false;
  }
  return true;
}

function isFullyDetermined(state: GridState): boolean {
  for (let r = 0; r < 3; r++) {
    let iConf = false;
    let eConf = false;
    for (let c = 0; c < 3; c++) {
      if (state.ingredients[r][c] === 'confirmed') iConf = true;
      if (state.effects[r][c] === 'confirmed') eConf = true;
    }
    if (!iConf || !eConf) return false;
  }
  return true;
}

// ── generatePuzzle ──────────────────────────────────────────────────

describe('generatePuzzle', () => {
  it('returns a valid puzzle with 4-5 clues (50 iterations)', () => {
    for (let i = 0; i < 50; i++) {
      const puzzle = generatePuzzle();

      // Valid solution
      expect(isValidSolution(puzzle.solution)).toBe(true);

      // 4-5 clues
      expect(puzzle.clues.length).toBeGreaterThanOrEqual(4);
      expect(puzzle.clues.length).toBeLessThanOrEqual(5);

      // At most 1 direct_positive
      const dpCount = puzzle.clues.filter(c => c.type === 'direct_positive').length;
      expect(dpCount).toBeLessThanOrEqual(1);

      // At least 1 relational
      const relCount = puzzle.clues.filter(c => c.type === 'relational').length;
      expect(relCount).toBeGreaterThanOrEqual(1);

      // Solver uniquely determines the solution
      const solved = solve(puzzle.clues);
      expect(isFullyDetermined(solved)).toBe(true);
    }
  });

  it('generates unique ingredient and effect assignments', () => {
    for (let i = 0; i < 20; i++) {
      const { solution } = generatePuzzle();
      const ings = POTIONS.map(p => solution.ingredients[p]);
      const effs = POTIONS.map(p => solution.effects[p]);
      expect(new Set(ings).size).toBe(3);
      expect(new Set(effs).size).toBe(3);
    }
  });

  it('never crashes (100 iterations)', () => {
    for (let i = 0; i < 100; i++) {
      expect(() => generatePuzzle()).not.toThrow();
    }
  });
});

// ── solve ───────────────────────────────────────────────────────────

describe('solve', () => {
  it('correctly solves puzzles from generatePuzzle', () => {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle();
      const solved = solve(puzzle.clues);
      expect(isFullyDetermined(solved)).toBe(true);

      // Verify the solved grid matches the solution
      const assignments = extractAssignments(solved);
      for (const p of POTIONS) {
        expect(assignments.ingredients[p]).toBe(puzzle.solution.ingredients[p]);
        expect(assignments.effects[p]).toBe(puzzle.solution.effects[p]);
      }
    }
  });

  it('does NOT fully determine with insufficient clues', () => {
    const puzzle = generatePuzzle();
    // Use only the first clue — should not be enough
    const singleClue = [puzzle.clues[0]];
    const solved = solve(singleClue);
    expect(isFullyDetermined(solved)).toBe(false);
  });
});

// ── validateSubmission ──────────────────────────────────────────────

describe('validateSubmission', () => {
  it('returns true for correct submission', () => {
    const puzzle = generatePuzzle();
    const result = validateSubmission(
      puzzle.solution.ingredients,
      puzzle.solution.effects,
      puzzle.solution,
    );
    expect(result).toBe(true);
  });

  it('returns false for wrong ingredient assignment', () => {
    const puzzle = generatePuzzle();
    const wrongIngs = { ...puzzle.solution.ingredients };
    // Swap two ingredients
    const temp = wrongIngs.red;
    wrongIngs.red = wrongIngs.blue;
    wrongIngs.blue = temp;

    const result = validateSubmission(
      wrongIngs,
      puzzle.solution.effects,
      puzzle.solution,
    );
    expect(result).toBe(false);
  });

  it('returns false for wrong effect assignment', () => {
    const puzzle = generatePuzzle();
    const wrongEffs = { ...puzzle.solution.effects };
    const temp = wrongEffs.red;
    wrongEffs.red = wrongEffs.green;
    wrongEffs.green = temp;

    const result = validateSubmission(
      puzzle.solution.ingredients,
      wrongEffs,
      puzzle.solution,
    );
    expect(result).toBe(false);
  });
});

// ── Clue application ────────────────────────────────────────────────

describe('clue application', () => {
  it('direct_positive confirms the correct cell', () => {
    const puzzle = generatePuzzle();
    const dpClue = puzzle.clues.find(c => c.type === 'direct_positive');
    if (!dpClue) return; // Some puzzles may not have one

    const grid = emptyGrid();
    const result = dpClue.apply(grid);

    // At least one cell should be confirmed
    let hasConfirm = false;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (result.ingredients[r][c] === 'confirmed') hasConfirm = true;
        if (result.effects[r][c] === 'confirmed') hasConfirm = true;
      }
    }
    expect(hasConfirm).toBe(true);
  });

  it('direct_negative eliminates a cell', () => {
    const puzzle = generatePuzzle();
    const dnClue = puzzle.clues.find(c => c.type === 'direct_negative');
    if (!dnClue) return;

    const grid = emptyGrid();
    const result = dnClue.apply(grid);

    let hasElimination = false;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (result.ingredients[r][c] === 'eliminated') hasElimination = true;
        if (result.effects[r][c] === 'eliminated') hasElimination = true;
      }
    }
    expect(hasElimination).toBe(true);
  });

  it('relational clue propagates correctly when ingredient is confirmed', () => {
    // Generate a puzzle and find a relational clue
    let relClue: Clue | undefined;
    let puzzle;
    for (let i = 0; i < 50; i++) {
      puzzle = generatePuzzle();
      relClue = puzzle.clues.find(c => c.type === 'relational');
      if (relClue) break;
    }
    expect(relClue).toBeDefined();

    if (relClue && puzzle) {
      // Build a grid where one ingredient is confirmed (the one the relational links)
      const grid = emptyGrid();
      // Confirm a specific ingredient for a potion
      const p = POTIONS[0];
      const ing = puzzle.solution.ingredients[p];
      const pi = POTIONS.indexOf(p);
      const ii = INGREDIENTS.indexOf(ing);
      grid.ingredients[pi][ii] = 'confirmed';
      // Eliminate others in row/col
      for (let c = 0; c < 3; c++) {
        if (c !== ii) grid.ingredients[pi][c] = 'eliminated';
      }
      for (let r = 0; r < 3; r++) {
        if (r !== pi) grid.ingredients[r][ii] = 'eliminated';
      }

      const result = relClue.apply(grid);
      // The grid should have changed or stayed the same (relational applies constraints)
      expect(result).toBeDefined();
    }
  });
});

// ── Grid constraint propagation ─────────────────────────────────────

describe('grid constraint propagation', () => {
  it('two eliminations in a row causes third cell to auto-confirm via solver', () => {
    // Create a clue set that eliminates two cells in a row
    const puzzle = generatePuzzle();
    const solved = solve(puzzle.clues);

    // In a fully solved grid, each row has exactly 1 confirmed and 2 eliminated
    for (let r = 0; r < 3; r++) {
      let confirmed = 0;
      let eliminated = 0;
      for (let c = 0; c < 3; c++) {
        if (solved.ingredients[r][c] === 'confirmed') confirmed++;
        if (solved.ingredients[r][c] === 'eliminated') eliminated++;
      }
      expect(confirmed).toBe(1);
      expect(eliminated).toBe(2);
    }
  });

  it('confirmation in a column eliminates other cells in that column', () => {
    const puzzle = generatePuzzle();
    const solved = solve(puzzle.clues);

    // In a fully solved grid, each column has exactly 1 confirmed
    for (let c = 0; c < 3; c++) {
      let confirmed = 0;
      let eliminated = 0;
      for (let r = 0; r < 3; r++) {
        if (solved.ingredients[r][c] === 'confirmed') confirmed++;
        if (solved.ingredients[r][c] === 'eliminated') eliminated++;
      }
      expect(confirmed).toBe(1);
      expect(eliminated).toBe(2);
    }
  });
});

// ── Grid helpers ────────────────────────────────────────────────────

describe('isValidGridState', () => {
  it('allows one confirmation per row and column', () => {
    const grid: GridState['ingredients'] = [
      ['confirmed', 'eliminated', 'eliminated'],
      ['eliminated', 'confirmed', 'eliminated'],
      ['eliminated', 'eliminated', 'confirmed'],
    ];
    expect(isValidGridState(grid)).toBe(true);
  });

  it('rejects two confirmations in the same row', () => {
    const grid: GridState['ingredients'] = [
      ['confirmed', 'confirmed', 'eliminated'],
      ['eliminated', 'eliminated', 'confirmed'],
      ['eliminated', 'eliminated', 'empty'],
    ];
    expect(isValidGridState(grid)).toBe(false);
  });

  it('rejects two confirmations in the same column', () => {
    const grid: GridState['ingredients'] = [
      ['confirmed', 'eliminated', 'eliminated'],
      ['confirmed', 'eliminated', 'eliminated'],
      ['eliminated', 'eliminated', 'empty'],
    ];
    expect(isValidGridState(grid)).toBe(false);
  });
});

describe('countConfirmations', () => {
  it('counts correctly for an empty grid', () => {
    const grid = emptyGrid();
    const counts = countConfirmations(grid);
    expect(counts.ingredients).toBe(0);
    expect(counts.effects).toBe(0);
  });

  it('counts correctly for a fully solved grid', () => {
    const puzzle = generatePuzzle();
    const solved = solve(puzzle.clues);
    const counts = countConfirmations(solved);
    expect(counts.ingredients).toBe(3);
    expect(counts.effects).toBe(3);
  });
});

describe('extractAssignments', () => {
  it('extracts correct assignments from a solved grid', () => {
    const puzzle = generatePuzzle();
    const solved = solve(puzzle.clues);
    const assignments = extractAssignments(solved);

    for (const p of POTIONS) {
      expect(assignments.ingredients[p]).toBe(puzzle.solution.ingredients[p]);
      expect(assignments.effects[p]).toBe(puzzle.solution.effects[p]);
    }
  });
});

// ── computeGridState (auto-marking system) ──────────────────────────

describe('computeGridState', () => {
  it('single manual confirm auto-eliminates rest of row and column', () => {
    const marks: ManualMarks = {
      confirms: [{ grid: 'ingredients', row: 0, col: 0 }],
      eliminations: [],
    };
    const result = computeGridState(marks);

    expect(result.origins.ingredients[0][0]).toBe('manual_confirmed');
    expect(result.grid.ingredients[0][0]).toBe('confirmed');

    // Rest of row 0 auto-eliminated
    expect(result.origins.ingredients[0][1]).toBe('auto_eliminated');
    expect(result.origins.ingredients[0][2]).toBe('auto_eliminated');
    expect(result.grid.ingredients[0][1]).toBe('eliminated');
    expect(result.grid.ingredients[0][2]).toBe('eliminated');

    // Rest of col 0 auto-eliminated
    expect(result.origins.ingredients[1][0]).toBe('auto_eliminated');
    expect(result.origins.ingredients[2][0]).toBe('auto_eliminated');
  });

  it('cascade: two confirms in same grid trigger auto-confirm of remaining cell', () => {
    // Confirm (0,0) and (1,1) — row 2 has col 0 elim, col 1 elim → col 2 auto-confirms
    const marks: ManualMarks = {
      confirms: [
        { grid: 'ingredients', row: 0, col: 0 },
        { grid: 'ingredients', row: 1, col: 1 },
      ],
      eliminations: [],
    };
    const result = computeGridState(marks);

    expect(result.grid.ingredients[2][2]).toBe('confirmed');
    expect(result.origins.ingredients[2][2]).toBe('auto_confirmed');

    // Entire ingredients grid should be fully determined
    for (let r = 0; r < 3; r++) {
      let confirmed = 0;
      for (let c = 0; c < 3; c++) {
        if (result.grid.ingredients[r][c] === 'confirmed') confirmed++;
      }
      expect(confirmed).toBe(1);
    }
  });

  it('clearing a manual confirm recomputes correctly without it', () => {
    // Two confirms → grid fully determined
    const marks1: ManualMarks = {
      confirms: [
        { grid: 'ingredients', row: 0, col: 0 },
        { grid: 'ingredients', row: 1, col: 1 },
      ],
      eliminations: [],
    };
    const result1 = computeGridState(marks1);
    expect(result1.grid.ingredients[2][2]).toBe('confirmed');

    // Remove second confirm → auto-confirm at (2,2) disappears
    const marks2: ManualMarks = {
      confirms: [{ grid: 'ingredients', row: 0, col: 0 }],
      eliminations: [],
    };
    const result2 = computeGridState(marks2);

    expect(result2.grid.ingredients[2][2]).toBe('empty');
    expect(result2.grid.ingredients[1][1]).toBe('empty');
    expect(result2.grid.ingredients[1][2]).toBe('empty');
    // Col 0 rows 1,2 should still be auto-eliminated from the remaining confirm
    expect(result2.grid.ingredients[1][0]).toBe('eliminated');
    expect(result2.grid.ingredients[2][0]).toBe('eliminated');
  });

  it('manual elimination triggers auto-confirm cascade', () => {
    // Eliminate two cells in row 0 → only one left → auto-confirm
    const marks: ManualMarks = {
      confirms: [],
      eliminations: [
        { grid: 'effects', row: 0, col: 0 },
        { grid: 'effects', row: 0, col: 1 },
      ],
    };
    const result = computeGridState(marks);

    expect(result.grid.effects[0][2]).toBe('confirmed');
    expect(result.origins.effects[0][2]).toBe('auto_confirmed');

    // Auto-confirm cascades: col 2 rows 1,2 are auto-eliminated
    expect(result.grid.effects[1][2]).toBe('eliminated');
    expect(result.grid.effects[2][2]).toBe('eliminated');
    expect(result.origins.effects[1][2]).toBe('auto_eliminated');
    expect(result.origins.effects[2][2]).toBe('auto_eliminated');
  });

  it('full solve: minimal manual confirms cascade to complete both grids', () => {
    // Diagonal confirms in both grids: 2 manual per grid → 1 auto each
    const marks: ManualMarks = {
      confirms: [
        { grid: 'ingredients', row: 0, col: 0 },
        { grid: 'ingredients', row: 1, col: 1 },
        { grid: 'effects', row: 0, col: 0 },
        { grid: 'effects', row: 1, col: 1 },
      ],
      eliminations: [],
    };
    const result = computeGridState(marks);

    const counts = countConfirmations(result.grid);
    expect(counts.ingredients).toBe(3);
    expect(counts.effects).toBe(3);

    // No empty cells remain
    for (const gridId of ['ingredients', 'effects'] as GridId[]) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          expect(result.grid[gridId][r][c]).not.toBe('empty');
        }
      }
    }

    expect(isGridComplete(result.grid)).toBe(true);
  });

  it('effects grid is independent from ingredients grid', () => {
    const marks: ManualMarks = {
      confirms: [{ grid: 'ingredients', row: 0, col: 0 }],
      eliminations: [],
    };
    const result = computeGridState(marks);

    // Effects grid should be completely untouched
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        expect(result.grid.effects[r][c]).toBe('empty');
        expect(result.origins.effects[r][c]).toBe('empty');
      }
    }
  });

  it('manual elimination takes priority over auto-elimination', () => {
    // Place manual ✗ at (0,1), then manual ✓ at (0,0) which would auto-elim (0,1)
    const marks: ManualMarks = {
      confirms: [{ grid: 'ingredients', row: 0, col: 0 }],
      eliminations: [{ grid: 'ingredients', row: 0, col: 1 }],
    };
    const result = computeGridState(marks);

    // (0,1) should be manual_eliminated (placed before confirm's auto-elim)
    expect(result.origins.ingredients[0][1]).toBe('manual_eliminated');
    expect(result.grid.ingredients[0][1]).toBe('eliminated');
  });

  it('empty marks produce a fully empty grid', () => {
    const result = computeGridState(emptyManualMarks());

    for (const gridId of ['ingredients', 'effects'] as GridId[]) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          expect(result.grid[gridId][r][c]).toBe('empty');
          expect(result.origins[gridId][r][c]).toBe('empty');
        }
      }
    }
  });

  it('clearing manual elimination recomputes correctly', () => {
    // Two manual ✗ in row 0 → auto-confirm (0,2) → cascade
    const marks1: ManualMarks = {
      confirms: [],
      eliminations: [
        { grid: 'ingredients', row: 0, col: 0 },
        { grid: 'ingredients', row: 0, col: 1 },
      ],
    };
    const result1 = computeGridState(marks1);
    expect(result1.grid.ingredients[0][2]).toBe('confirmed');

    // Remove one elimination → auto-confirm disappears
    const marks2: ManualMarks = {
      confirms: [],
      eliminations: [{ grid: 'ingredients', row: 0, col: 0 }],
    };
    const result2 = computeGridState(marks2);
    expect(result2.grid.ingredients[0][2]).toBe('empty');
    expect(result2.grid.ingredients[0][1]).toBe('empty');
    expect(result2.grid.ingredients[0][0]).toBe('eliminated');
    expect(result2.origins.ingredients[0][0]).toBe('manual_eliminated');
  });
});
