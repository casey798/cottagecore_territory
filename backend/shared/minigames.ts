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
  'pips': { name: 'Pips', timeLimit: 90, description: 'Fill the shape in limited moves' },
  'vine-trail': { name: 'Vine Trail', timeLimit: 120, description: 'Trace the vine to its end' },
  'mosaic': { name: 'Mosaic', timeLimit: 180, description: 'Complete the mosaic pattern' },
  'crossvine': { name: 'Crossvine', timeLimit: 300, description: 'Solve the crossvine puzzle' },
  'number-grove': { name: 'Number Grove', timeLimit: 240, description: 'Solve number puzzles in the grove' },
  'potion-logic': { name: 'Potion Logic', timeLimit: 300, description: 'Deduce the potion recipe' },
  'leaf-sort': { name: 'Leaf Sort', timeLimit: 90, description: 'Sort the falling leaves' },
  'cipher-stones': { name: 'Cipher Stones', timeLimit: 180, description: 'Decode the cipher stones' },
  'path-weaver': { name: 'Path Weaver', timeLimit: 240, description: 'Weave the optimal path' },
};

export const MINIGAME_IDS = Object.keys(MINIGAME_META);
export const MINIGAME_POOL = MINIGAME_META;
