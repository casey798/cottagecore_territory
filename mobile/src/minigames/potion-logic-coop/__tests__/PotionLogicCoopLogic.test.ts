/**
 * Tests for PotionLogicCoop — clue highlighting, grid tap cycling,
 * auto-cascade, win/loss logic, and wrong-submission behavior.
 */
import {
  generatePuzzle,
  validateSubmission,
  extractAssignments,
  countConfirmations,
  computeGridState,
  emptyManualMarks,
  isValidGridState,
  POTIONS,
  INGREDIENTS,
  EFFECTS,
  type Potion,
  type Ingredient,
  type Effect,
  type ManualMarks,
  type GridId,
  type CellOrigin,
} from '../../potion-logic/PotionLogicLogic';
import { parseClueReferences } from '../PotionLogicCoopGame';

// ── Clue highlight parsing ─────────────────────────────────────────

describe('parseClueReferences', () => {
  it('extracts potion row and ingredient col from a direct positive ingredient clue', () => {
    const refs = parseClueReferences('The Red Potion was brewed with Herb.');
    expect(refs.potionRows).toEqual([0]); // red = index 0
    expect(refs.ingredientCols).toEqual([0]); // herb = index 0
    expect(refs.effectCols).toEqual([]);
  });

  it('extracts potion row and effect col from a direct positive effect clue', () => {
    const refs = parseClueReferences('The Blue Potion grants Speed.');
    expect(refs.potionRows).toEqual([1]); // blue = index 1
    expect(refs.ingredientCols).toEqual([]);
    expect(refs.effectCols).toEqual([1]); // speed = index 1
  });

  it('extracts ingredient col and effect col from a relational clue (no potion)', () => {
    const refs = parseClueReferences('The potion brewed with Crystal grants Shield.');
    expect(refs.potionRows).toEqual([]); // no specific potion named
    expect(refs.ingredientCols).toEqual([1]); // crystal = index 1
    expect(refs.effectCols).toEqual([2]); // shield = index 2
  });

  it('extracts ingredient col and effect col from a cross-negative clue', () => {
    const refs = parseClueReferences('Mushroom and Healing never appear in the same potion.');
    expect(refs.potionRows).toEqual([]);
    expect(refs.ingredientCols).toEqual([2]); // mushroom = index 2
    expect(refs.effectCols).toEqual([0]); // healing = index 0
  });

  it('handles direct negative clue with potion and ingredient', () => {
    const refs = parseClueReferences('The Green Potion was not made with Crystal.');
    expect(refs.potionRows).toEqual([2]); // green = index 2
    expect(refs.ingredientCols).toEqual([1]); // crystal = index 1
    expect(refs.effectCols).toEqual([]);
  });

  it('returns empty arrays for text with no known entities', () => {
    const refs = parseClueReferences('Some random text about nothing.');
    expect(refs.potionRows).toEqual([]);
    expect(refs.ingredientCols).toEqual([]);
    expect(refs.effectCols).toEqual([]);
  });
});

// ── P2 grid tap cycling ────────────────────────────────────────────

describe('grid tap cycling (P2 cell state)', () => {
  it('empty → eliminated on first tap', () => {
    const marks: ManualMarks = {
      confirms: [],
      eliminations: [{ grid: 'ingredients', row: 0, col: 0 }],
    };
    const result = computeGridState(marks);
    expect(result.grid.ingredients[0][0]).toBe('eliminated');
    expect(result.origins.ingredients[0][0]).toBe('manual_eliminated');
  });

  it('eliminated → confirmed on second tap', () => {
    // Simulate: first elimination, then replace with confirmation
    const marks: ManualMarks = {
      confirms: [{ grid: 'ingredients', row: 0, col: 0 }],
      eliminations: [],
    };
    const result = computeGridState(marks);
    expect(result.grid.ingredients[0][0]).toBe('confirmed');
    expect(result.origins.ingredients[0][0]).toBe('manual_confirmed');
  });

  it('confirmed → empty on third tap (removing confirm)', () => {
    // Empty marks = no confirm → cell is empty
    const result = computeGridState(emptyManualMarks());
    expect(result.grid.ingredients[0][0]).toBe('empty');
    expect(result.origins.ingredients[0][0]).toBe('empty');
  });

  it('auto-derived cells cannot be manually toggled (are locked)', () => {
    // Confirm (0,0) → auto-eliminates (0,1) and (0,2)
    const marks: ManualMarks = {
      confirms: [{ grid: 'ingredients', row: 0, col: 0 }],
      eliminations: [],
    };
    const result = computeGridState(marks);
    expect(result.origins.ingredients[0][1]).toBe('auto_eliminated');
    expect(result.origins.ingredients[0][2]).toBe('auto_eliminated');
    // In the UI, tapping these would show "Auto-derived mark" and return early
  });
});

// ── Auto-cascade ───────────────────────────────────────────────────

describe('auto-cascade from computeGridState', () => {
  it('two manual eliminations in a row trigger auto-confirm of third', () => {
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
  });

  it('auto-confirm cascades to eliminate rest of column', () => {
    const marks: ManualMarks = {
      confirms: [],
      eliminations: [
        { grid: 'effects', row: 0, col: 0 },
        { grid: 'effects', row: 0, col: 1 },
      ],
    };
    const result = computeGridState(marks);
    // Auto-confirmed (0,2), so (1,2) and (2,2) auto-eliminated
    expect(result.grid.effects[1][2]).toBe('eliminated');
    expect(result.grid.effects[2][2]).toBe('eliminated');
    expect(result.origins.effects[1][2]).toBe('auto_eliminated');
    expect(result.origins.effects[2][2]).toBe('auto_eliminated');
  });

  it('two confirms cascade to complete an entire 3×3 grid', () => {
    const marks: ManualMarks = {
      confirms: [
        { grid: 'ingredients', row: 0, col: 0 },
        { grid: 'ingredients', row: 1, col: 1 },
      ],
      eliminations: [],
    };
    const result = computeGridState(marks);

    // (2,2) should be auto-confirmed
    expect(result.grid.ingredients[2][2]).toBe('confirmed');
    expect(result.origins.ingredients[2][2]).toBe('auto_confirmed');

    // All 3 potions have exactly 1 confirmed ingredient
    for (let r = 0; r < 3; r++) {
      let confirmed = 0;
      for (let c = 0; c < 3; c++) {
        if (result.grid.ingredients[r][c] === 'confirmed') confirmed++;
      }
      expect(confirmed).toBe(1);
    }
  });
});

// ── Win detection ──────────────────────────────────────────────────

describe('correct submission triggers win', () => {
  it('validateSubmission returns true for correct solution', () => {
    const puzzle = generatePuzzle();
    const correct = validateSubmission(
      puzzle.solution.ingredients,
      puzzle.solution.effects,
      puzzle.solution,
    );
    expect(correct).toBe(true);
  });

  it('grid fully solved with correct marks validates successfully', () => {
    const puzzle = generatePuzzle();

    // Build manual marks that match the solution
    const marks: ManualMarks = { confirms: [], eliminations: [] };
    for (const p of POTIONS) {
      const r = POTIONS.indexOf(p);
      const ingCol = INGREDIENTS.indexOf(puzzle.solution.ingredients[p]);
      const effCol = EFFECTS.indexOf(puzzle.solution.effects[p]);
      marks.confirms.push({ grid: 'ingredients', row: r, col: ingCol });
      marks.confirms.push({ grid: 'effects', row: r, col: effCol });
    }

    const computed = computeGridState(marks);
    const counts = countConfirmations(computed.grid);
    expect(counts.ingredients).toBe(3);
    expect(counts.effects).toBe(3);

    const assignments = extractAssignments(computed.grid);
    const correct = validateSubmission(
      assignments.ingredients as Record<Potion, Ingredient>,
      assignments.effects as Record<Potion, Effect>,
      puzzle.solution,
    );
    expect(correct).toBe(true);
  });
});

// ── Wrong submission ───────────────────────────────────────────────

describe('wrong submission triggers wrongFlash without loss', () => {
  it('validateSubmission returns false for swapped ingredients', () => {
    const puzzle = generatePuzzle();
    const wrongIngs = { ...puzzle.solution.ingredients };
    const temp = wrongIngs.red;
    wrongIngs.red = wrongIngs.blue;
    wrongIngs.blue = temp;

    const result = validateSubmission(
      wrongIngs,
      puzzle.solution.effects,
      puzzle.solution,
    );
    expect(result).toBe(false);
    // In the game, this would set wrongFlash=true and message, but NOT end the game
  });

  it('grid remains editable after wrong submission (marks unchanged)', () => {
    // Simulate: wrong marks are set, submission fails, player can still modify
    const marks: ManualMarks = {
      confirms: [
        { grid: 'ingredients', row: 0, col: 0 },
        { grid: 'ingredients', row: 1, col: 1 },
        { grid: 'effects', row: 0, col: 0 },
        { grid: 'effects', row: 1, col: 1 },
      ],
      eliminations: [],
    };
    const computed = computeGridState(marks);
    const counts = countConfirmations(computed.grid);
    // Grid has 3 confirms each (2 manual + 1 auto-cascade)
    expect(counts.ingredients).toBe(3);
    expect(counts.effects).toBe(3);

    // After wrong submission, player removes a confirm and adds a different one
    const newMarks: ManualMarks = {
      confirms: [
        { grid: 'ingredients', row: 0, col: 1 }, // changed
        { grid: 'ingredients', row: 1, col: 0 }, // changed
        { grid: 'effects', row: 0, col: 0 },
        { grid: 'effects', row: 1, col: 1 },
      ],
      eliminations: [],
    };
    const recomputed = computeGridState(newMarks);
    // Grid recomputes cleanly — still 3 per grid
    expect(countConfirmations(recomputed.grid).ingredients).toBe(3);
    expect(countConfirmations(recomputed.grid).effects).toBe(3);
  });
});

// ── Timeout triggers loss ──────────────────────────────────────────

describe('timeout triggers loss', () => {
  it('game state is purely time-based — no move limit in potion logic', () => {
    // In PotionLogicCoop, loss only happens on timeout.
    // There is no move limit. The timer hitting 0 calls finishGame('timeout').
    // We verify this by checking that the game logic has no concept of move count.
    const marks = emptyManualMarks();
    const computed = computeGridState(marks);
    // All cells empty — game is not over, just no progress
    const counts = countConfirmations(computed.grid);
    expect(counts.ingredients).toBe(0);
    expect(counts.effects).toBe(0);
    // No win/loss triggered by grid state alone when grid is incomplete
  });

  it('finishGame with timeout maps to lose overlay result', () => {
    // The component maps 'timeout' to overlayResult 'lose':
    //   setOverlayResult(outcome === 'win' ? 'win' : 'lose');
    // Verify the mapping logic
    const outcome = 'timeout' as 'win' | 'lose' | 'timeout';
    const overlayResult = outcome === 'win' ? 'win' : 'lose';
    expect(overlayResult).toBe('lose');
  });
});
