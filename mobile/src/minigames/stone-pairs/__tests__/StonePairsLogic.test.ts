import {
  CardData,
  ICON_SETS,
  checkMatch,
  generatePuzzle,
  validateSolution,
} from '../StonePairsLogic';

// ---------------------------------------------------------------------------
// generatePuzzle — fixed 4x4 grid
// ---------------------------------------------------------------------------

describe('generatePuzzle', () => {
  it('produces 16 cards (4x4 grid, 8 pairs)', () => {
    const puzzle = generatePuzzle();
    expect(puzzle.cards).toHaveLength(16);
    expect(puzzle.rows).toBe(4);
    expect(puzzle.cols).toBe(4);
    expect(puzzle.totalPairs).toBe(8);
  });

  it('each iconIndex appears exactly twice (8 pairs)', () => {
    const puzzle = generatePuzzle();
    const counts = countByIconIndex(puzzle.cards);
    for (const count of Object.values(counts)) {
      expect(count).toBe(2);
    }
    expect(Object.keys(counts)).toHaveLength(8);
  });

  // ---- cards are shuffled ------------------------------------------------

  it('cards are shuffled (not always in identical order across runs)', () => {
    const orderings = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle();
      const order = puzzle.cards.map((c) => c.iconIndex).join(',');
      orderings.add(order);
    }
    expect(orderings.size).toBeGreaterThan(1);
  });

  // ---- all card ids are sequential and unique ----------------------------

  it('card ids are sequential 0..n-1', () => {
    const puzzle = generatePuzzle();
    const ids = puzzle.cards.map((c) => c.id).sort((a, b) => a - b);
    const expected = Array.from({ length: puzzle.cards.length }, (_, i) => i);
    expect(ids).toEqual(expected);
  });

  // ---- every card has a non-empty iconLabel ------------------------------

  it('every card has a non-empty iconLabel', () => {
    const puzzle = generatePuzzle();
    for (const card of puzzle.cards) {
      expect(card.iconLabel.length).toBeGreaterThan(0);
    }
  });

  // ---- all icons in a puzzle come from a single ICON_SET ----------------

  it('all icons come from one of the ICON_SETS (no mixing)', () => {
    for (let run = 0; run < 20; run++) {
      const puzzle = generatePuzzle();
      const uniqueLabels = [...new Set(puzzle.cards.map((c) => c.iconLabel))];
      const matchingSet = ICON_SETS.find((set) =>
        uniqueLabels.every((label) => set.includes(label)),
      );
      expect(matchingSet).toBeDefined();
    }
  });

  // ---- ICON_SETS each have exactly 8 icons ------------------------------

  it('every ICON_SET has exactly 8 icons', () => {
    expect(ICON_SETS.length).toBeGreaterThanOrEqual(6);
    for (const set of ICON_SETS) {
      expect(set).toHaveLength(8);
    }
  });
});

// ---------------------------------------------------------------------------
// checkMatch
// ---------------------------------------------------------------------------

describe('checkMatch', () => {
  it('returns true for two cards with the same iconIndex but different ids', () => {
    const card1: CardData = { id: 0, iconIndex: 3, iconLabel: '🌸' };
    const card2: CardData = { id: 5, iconIndex: 3, iconLabel: '🌸' };
    expect(checkMatch(card1, card2)).toBe(true);
  });

  it('returns false for two cards with different iconIndex', () => {
    const card1: CardData = { id: 0, iconIndex: 1, iconLabel: '🌰' };
    const card2: CardData = { id: 3, iconIndex: 4, iconLabel: '🐦' };
    expect(checkMatch(card1, card2)).toBe(false);
  });

  it('returns false when comparing a card to itself (same id)', () => {
    const card: CardData = { id: 2, iconIndex: 5, iconLabel: '🦊' };
    expect(checkMatch(card, card)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateSolution
// ---------------------------------------------------------------------------

describe('validateSolution', () => {
  it('returns solved:true when all pairs are matched', () => {
    const puzzle = generatePuzzle();
    const result = validateSolution(puzzle, { matchedPairs: puzzle.totalPairs });
    expect(result.solved).toBe(true);
  });

  it('returns solved:false when not all pairs are matched', () => {
    const puzzle = generatePuzzle();
    const result = validateSolution(puzzle, { matchedPairs: puzzle.totalPairs - 1 });
    expect(result.solved).toBe(false);
  });

  it('returns solved:false when zero pairs matched', () => {
    const puzzle = generatePuzzle();
    const result = validateSolution(puzzle, { matchedPairs: 0 });
    expect(result.solved).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countByIconIndex(cards: CardData[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const card of cards) {
    counts[card.iconIndex] = (counts[card.iconIndex] ?? 0) + 1;
  }
  return counts;
}
