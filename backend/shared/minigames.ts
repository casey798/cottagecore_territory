// ============================================================================
// Minigame metadata — puzzle generation and validation are now client-side.
// The backend only records sessions and validates completion hashes + timing.
// ============================================================================

interface MinigameMeta {
  name: string;
  timeLimit: number;
  description: string;
}

const MINIGAME_META: Record<string, MinigameMeta> = {
  'grove-words': { name: 'Grove Words', timeLimit: 120, description: 'Guess the word in 6 tries' },
  'kindred': { name: 'Kindred', timeLimit: 150, description: 'Group 16 words into 4 groups' },
  'stone-pairs': { name: 'Stone Pairs', timeLimit: 60, description: 'Find matching pairs' },
  'pips': { name: 'Pips', timeLimit: 60, description: 'Fill the shape in limited moves' },
  'vine-trail': { name: 'Vine Trail', timeLimit: 180, description: 'Trace the vine to its end' },
  'mosaic': { name: 'Mosaic', timeLimit: 90, description: 'Complete the mosaic pattern' },
  'number-grove': { name: 'Number Grove', timeLimit: 120, description: 'Solve number puzzles in the grove' },
  'potion-logic': { name: 'Potion Logic', timeLimit: 120, description: 'Use clues to deduce which ingredient and effect belongs to each potion' },
  'leaf-sort': { name: 'Leaf Sort', timeLimit: 90, description: 'Sort colored beads into jars' },
  'cipher-stones': { name: 'Cipher Stones', timeLimit: 120, description: 'Decode the cipher stones' },
  'path-weaver': { name: 'Path Weaver', timeLimit: 150, description: 'Fill the grid to reveal a hidden image' },
  'firefly-flow': { name: 'Firefly Flow', timeLimit: 90, description: 'Connect the pairs and light every tile' },
  'grove-equations': { name: 'Grove Equations', timeLimit: 120, description: 'Use 4 numbers and operators to reach the target' },
  'bloom-sequence': { name: 'Bloom Sequence', timeLimit: 90, description: 'Find the pattern, complete the sequence' },
  'shift-slide': { name: 'Shift & Slide', timeLimit: 90, description: 'Slide the tiles to restore the hidden image' },
  'kindred-coop': { name: 'Kindred Co-op', timeLimit: 150, description: 'Group words together — split-screen team challenge' },
  'cipher-stones-coop': { name: 'Cipher Stones Co-op', timeLimit: 120, description: 'Decode the cipher stones — split-screen team challenge' },
  'pips-coop': { name: 'Pips Co-op', timeLimit: 60, description: 'Fill the shape in limited moves — split-screen team challenge' },
  'stone-pairs-coop': { name: 'Stone Pairs Co-op', timeLimit: 60, description: 'Find matching pairs — split-screen team challenge' },
  'potion-logic-coop': { name: 'Potion Logic Co-op', timeLimit: 120, description: 'Deduce the potions — split-screen team challenge' },
  'vine-trail-coop': { name: 'Vine Trail Co-op', timeLimit: 180, description: 'Trace the vine — split-screen team challenge' },
};

export const MINIGAME_IDS = Object.keys(MINIGAME_META);
export const MINIGAME_POOL = MINIGAME_META;
