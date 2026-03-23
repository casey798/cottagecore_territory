// ============================================================================
// Minigame metadata — puzzle generation and validation are now client-side.
// The backend only records sessions and validates completion hashes + timing.
// ============================================================================

interface MinigameMeta {
  name: string;
  timeLimit: number;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const MINIGAME_META: Record<string, MinigameMeta> = {
  // Easy
  'stone-pairs':    { name: 'Flip & Match',    timeLimit: 90,  difficulty: 'easy',   description: 'Flip cards to find matching pairs. Remember what you saw \u2014 every flip counts.' },
  'leaf-sort':      { name: 'Color Sort',       timeLimit: 90,  difficulty: 'easy',   description: 'Sort colored beads into jars. Move one bead at a time \u2014 each jar must hold only one color.' },
  'bloom-sequence': { name: 'Spot the Pattern', timeLimit: 60,  difficulty: 'easy',   description: 'A sequence of 5 items follows a pattern. Pick the correct 6th item \u2014 3 rounds, no mistakes allowed.' },
  'firefly-flow':   { name: 'Connect the Dots', timeLimit: 90,  difficulty: 'easy',   description: 'Connect matching colour pairs with paths. Fill every tile on the grid \u2014 no gaps, no crossings.' },
  'number-grove':   { name: 'Mini Sudoku',     timeLimit: 90,  difficulty: 'easy',   description: 'Fill the 6x6 grid so every row, column, and box contains each number from 1 to 6 exactly once.' },
  // Medium
  'grove-words':    { name: 'Wordle',           timeLimit: 120, difficulty: 'medium', description: 'Guess the word in 6 tries' },
  'word-clusters':  { name: 'Word Clusters',    timeLimit: 180, difficulty: 'medium', description: 'Sort 16 words into 4 groups. 8 mistakes allowed.' },
  'cipher-stones':  { name: 'Cipher',           timeLimit: 150, difficulty: 'medium', description: 'A famous quote has been scrambled \u2014 every letter replaced with another. Decode it letter by letter before time runs out.' },
  'pips':           { name: 'Snuff Out',       timeLimit: 75,  difficulty: 'medium', description: 'Turn all the cells dark. Tap to toggle a cell and its neighbours.' },
  'mosaic':         { name: 'Tile Fit',         timeLimit: 120, difficulty: 'medium', description: 'Fit all the colored pieces into the grid. No gaps, no overlaps.' },
  // Hard
  'potion-logic':    { name: 'Logic Grid',      timeLimit: 150, difficulty: 'hard',   description: 'Read the clues. Deduce which ingredient and effect belongs to each potion. Process of elimination.' },
  'path-weaver':     { name: 'Nonogram',         timeLimit: 180, difficulty: 'hard',   description: 'Use number clues to fill a pixel grid and reveal a hidden image.' },
  'grove-equations': { name: 'Number Crunch',    timeLimit: 90,  difficulty: 'hard',   description: 'Tap the operators between four numbers to make them equal the target.' },
  'shift-slide':     { name: 'Tile Slide',       timeLimit: 120, difficulty: 'hard',   description: 'Slide the tiles to piece together a hidden picture.' },
  'vine-trail':      { name: 'Word Hunt',       timeLimit: 180, difficulty: 'hard',   description: 'Find all the hidden words in the letter grid. Every letter belongs to a word \u2014 trace your path and hunt them down.' },
  // Co-op
  'word-clusters-coop':  { name: 'Word Clusters Co-op',   timeLimit: 180, difficulty: 'medium', description: 'Sort 16 words into 4 groups \u2014 split-screen team challenge' },
  'cipher-stones-coop':  { name: 'Cipher Co-op',         timeLimit: 150, difficulty: 'medium', description: 'A famous quote has been scrambled \u2014 every letter replaced with another. Decode it letter by letter before time runs out.' },
  'pips-coop':           { name: 'Snuff Out Co-op',      timeLimit: 75,  difficulty: 'medium', description: 'Turn all the cells dark \u2014 split-screen team challenge' },
  'stone-pairs-coop':    { name: 'Flip & Match Co-op',    timeLimit: 90,  difficulty: 'easy',   description: 'Flip cards to find matching pairs. Remember what you saw \u2014 every flip counts.' },
  'potion-logic-coop':   { name: 'Logic Grid Co-op',     timeLimit: 150, difficulty: 'hard',   description: 'Deduce the potions \u2014 split-screen team challenge' },
  'vine-trail-coop':     { name: 'Word Hunt Co-op',      timeLimit: 180, difficulty: 'hard',   description: 'Find all the hidden words in the letter grid \u2014 split-screen team challenge' },
};

export const MINIGAME_IDS = Object.keys(MINIGAME_META);
export const MINIGAME_POOL = MINIGAME_META;

// --- Chest rarity system ---

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface RarityWeights {
  common: number;
  uncommon: number;
  rare: number;
  legendary: number;
}

export const CHEST_RARITY_WEIGHTS: Record<
  'easy' | 'medium' | 'hard',
  { solo: RarityWeights; coop: RarityWeights }
> = {
  easy: {
    solo: { common: 65, uncommon: 25, rare: 9, legendary: 1 },
    coop: { common: 50, uncommon: 30, rare: 16, legendary: 4 },
  },
  medium: {
    solo: { common: 45, uncommon: 30, rare: 20, legendary: 5 },
    coop: { common: 30, uncommon: 25, rare: 32, legendary: 13 },
  },
  hard: {
    solo: { common: 25, uncommon: 30, rare: 30, legendary: 15 },
    coop: { common: 10, uncommon: 20, rare: 40, legendary: 30 },
  },
};

export function rollRarityTier(weights: RarityWeights): RarityTier {
  const total = weights.common + weights.uncommon + weights.rare + weights.legendary;
  let roll = Math.random() * total;
  if ((roll -= weights.common) <= 0) return 'common';
  if ((roll -= weights.uncommon) <= 0) return 'uncommon';
  if ((roll -= weights.rare) <= 0) return 'rare';
  return 'legendary';
}

export { MINIGAME_META };
