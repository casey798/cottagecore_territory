/**
 * Stone Pairs (Memory Matching) — Pure logic, no React dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardData {
  id: number;
  iconIndex: number;
  iconLabel: string;
}

export interface StonePairsPuzzle {
  cards: CardData[];
  rows: number;
  cols: number;
  totalPairs: number;
}

// ---------------------------------------------------------------------------
// Icon sets — one set is picked randomly per game session
// ---------------------------------------------------------------------------

export const ICON_SETS: readonly (readonly string[])[] = [
  ['🍄', '🌿', '🌸', '🍂', '🐚', '🌾', '🍁', '🦋'],       // NATURE
  ['🦊', '🦔', '🐇', '🦉', '🐝', '🐸', '🦌', '🐦'],       // CREATURES
  ['🍯', '🧁', '🫐', '🍵', '🥐', '🍎', '🧇', '🫙'],       // FOOD & DRINK
  ['🌧️', '☀️', '🌙', '❄️', '🌈', '⚡', '🌫️', '🍃'],   // WEATHER
  ['🌻', '🌱', '🪴', '🌺', '🪨', '🌳', '🪵', '🌰'],       // GARDEN
  ['🕯️', '📖', '🧶', '🪵', '🛖', '🧣', '🪔', '🎋'],     // COZY
] as const;

// ---------------------------------------------------------------------------
// Grid config (fixed 4x4 = 8 pairs)
// ---------------------------------------------------------------------------

const GRID_ROWS = 4;
const GRID_COLS = 4;
const TOTAL_PAIRS = 8;

// ---------------------------------------------------------------------------
// Fisher–Yates shuffle (in-place)
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a puzzle: 4×4 grid = 16 cards = 8 pairs.
 * Picks one icon set randomly, then creates paired cards and shuffles.
 */
export function generatePuzzle(): StonePairsPuzzle {
  // Pick a random icon set
  const iconSet = ICON_SETS[Math.floor(Math.random() * ICON_SETS.length)];

  // Create two cards per icon (8 icons × 2 = 16 cards).
  const cards: CardData[] = [];
  let nextId = 0;
  for (let i = 0; i < TOTAL_PAIRS; i++) {
    cards.push({ id: nextId++, iconIndex: i, iconLabel: iconSet[i] });
    cards.push({ id: nextId++, iconIndex: i, iconLabel: iconSet[i] });
  }

  shuffle(cards);

  // Re-assign sequential ids after shuffle so id === position-in-array.
  cards.forEach((card, i) => {
    card.id = i;
  });

  return {
    cards,
    rows: GRID_ROWS,
    cols: GRID_COLS,
    totalPairs: TOTAL_PAIRS,
  };
}

/**
 * Returns true when both cards share the same icon (but are different cards).
 */
export function checkMatch(card1: CardData, card2: CardData): boolean {
  return card1.id !== card2.id && card1.iconIndex === card2.iconIndex;
}

/**
 * Validate whether the player has solved the puzzle.
 */
export function validateSolution(
  puzzle: StonePairsPuzzle,
  submission: { matchedPairs: number },
): { solved: boolean } {
  return { solved: submission.matchedPairs === puzzle.totalPairs };
}
