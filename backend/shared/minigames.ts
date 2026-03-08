import { MinigamePuzzle } from './types';

// ============================================================================
// Word list for Grove Words
// ============================================================================
const GROVE_WORDS: string[] = [
  'BLOOM', 'GROVE', 'CREEK', 'STONE', 'FERNS',
  'BROOK', 'PETAL', 'CEDAR', 'MARSH', 'THORN',
  'WOVEN', 'ROOST', 'FUNGI', 'DWELL', 'FLORA',
  'BOWER', 'HONEY', 'WHEAT', 'ACORN', 'BIRCH',
  'MAPLE', 'PLUME', 'THYME', 'BASIL', 'BRIAR',
  'FROND', 'SEDGE', 'DAISY', 'POPPY', 'LILAC',
  'MOSSY', 'GLADE', 'GLEAM', 'HAVEN', 'HAZEL',
  'LODGE', 'PATCH', 'QUAIL', 'QUIET', 'REEDS',
  'ROBIN', 'SHADE', 'SHIRE', 'SHRUB', 'SPORE',
  'STILE', 'STORK', 'TWINE', 'VIGOR', 'VINES',
  'YIELD',
];

// ============================================================================
// Kindred group packs
// ============================================================================
interface KindredGroup {
  category: string;
  words: string[];
}

interface KindredPack {
  groups: KindredGroup[];
}

const KINDRED_PACKS: KindredPack[] = [
  {
    groups: [
      { category: 'Garden flowers', words: ['DAISY', 'POPPY', 'TULIP', 'PANSY'] },
      { category: 'Tree types', words: ['BIRCH', 'CEDAR', 'MAPLE', 'WILLOW'] },
      { category: 'Baking items', words: ['FLOUR', 'SUGAR', 'YEAST', 'BUTTER'] },
      { category: 'Morning sounds', words: ['CHIRP', 'CHIME', 'ROOST', 'RUSTLE'] },
    ],
  },
  {
    groups: [
      { category: 'Things in a shed', words: ['SHOVEL', 'TWINE', 'BUCKET', 'SHEARS'] },
      { category: 'Bodies of water', words: ['CREEK', 'BROOK', 'RIVER', 'POND'] },
      { category: 'Cottage furniture', words: ['CHAIR', 'TABLE', 'SHELF', 'STOOL'] },
      { category: 'Nocturnal animals', words: ['OWL', 'BAT', 'FOX', 'MOTH'] },
    ],
  },
  {
    groups: [
      { category: 'Herbs', words: ['BASIL', 'THYME', 'SAGE', 'MINT'] },
      { category: 'Weather', words: ['RAIN', 'FROST', 'MIST', 'BREEZE'] },
      { category: 'Fabrics', words: ['LINEN', 'WOOL', 'SILK', 'COTTON'] },
      { category: 'Bird types', words: ['ROBIN', 'WREN', 'FINCH', 'DOVE'] },
    ],
  },
];

// ============================================================================
// Stone Pairs icons
// ============================================================================
const STONE_PAIR_ICONS = [
  'mushroom', 'acorn', 'leaf', 'flower',
  'butterfly', 'snail', 'pinecone', 'feather',
  'berry', 'pebble', 'shell', 'clover',
];

// ============================================================================
// Minigame metadata
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

// ============================================================================
// Seeded random for stone-pairs deterministic layout
// ============================================================================
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================================================
// generatePuzzle
// ============================================================================
export function generatePuzzle(
  minigameId: string,
  difficulty: 'easy' | 'medium' | 'hard'
): MinigamePuzzle {
  const meta = MINIGAME_META[minigameId];
  if (!meta) {
    return {
      type: minigameId,
      config: {},
      solution: {},
      timeLimit: 120,
    };
  }

  switch (minigameId) {
    case 'grove-words': {
      const word = GROVE_WORDS[Math.floor(Math.random() * GROVE_WORDS.length)];
      return {
        type: 'grove-words',
        config: { wordLength: 5, maxGuesses: 6 },
        solution: { answer: word },
        timeLimit: meta.timeLimit,
      };
    }

    case 'kindred': {
      const pack = KINDRED_PACKS[Math.floor(Math.random() * KINDRED_PACKS.length)];
      const allWords = pack.groups.flatMap((g) => g.words);
      const shuffled = allWords.sort(() => Math.random() - 0.5);
      return {
        type: 'kindred',
        config: { words: shuffled },
        solution: {
          groups: pack.groups.map((g) => ({
            category: g.category,
            words: [...g.words].sort(),
          })),
        },
        timeLimit: meta.timeLimit,
      };
    }

    case 'stone-pairs': {
      const seed = Math.floor(Math.random() * 2147483646) + 1;
      const rng = seededRandom(seed);
      const selectedIcons = STONE_PAIR_ICONS.slice(0, 8);
      const cards = [...selectedIcons, ...selectedIcons];
      const layout = shuffleWithRng(cards, rng);
      return {
        type: 'stone-pairs',
        config: { seed, gridSize: 4, pairs: 8 },
        solution: { layout, seed },
        timeLimit: meta.timeLimit,
      };
    }

    // --- Stub minigames: return placeholder config, always validate true ---
    case 'pips':
      return {
        type: 'pips',
        config: {
          grid: generateStubGrid(difficulty),
          tapPattern: 'cross',
          moveLimit: difficulty === 'easy' ? 10 : difficulty === 'medium' ? 8 : 6,
        },
        solution: { stub: true },
        timeLimit: meta.timeLimit,
      };

    case 'vine-trail':
      return {
        type: 'vine-trail',
        config: {
          gridWidth: 6,
          gridHeight: 6,
          obstacles: difficulty === 'easy' ? 4 : difficulty === 'medium' ? 8 : 12,
        },
        solution: { stub: true },
        timeLimit: meta.timeLimit,
      };

    case 'mosaic':
      return {
        type: 'mosaic',
        config: {
          gridSize: difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6,
          colorCount: 4,
          revealedCells: difficulty === 'easy' ? 10 : difficulty === 'medium' ? 8 : 5,
        },
        solution: { stub: true },
        timeLimit: meta.timeLimit,
      };

    case 'crossvine':
      return {
        type: 'crossvine',
        config: {
          wordCount: difficulty === 'easy' ? 6 : difficulty === 'medium' ? 8 : 10,
          gridSize: 10,
        },
        solution: { stub: true },
        timeLimit: meta.timeLimit,
      };

    case 'number-grove':
      return {
        type: 'number-grove',
        config: {
          gridSize: 4,
          operationCount: difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : 8,
        },
        solution: { stub: true },
        timeLimit: meta.timeLimit,
      };

    case 'potion-logic':
      return {
        type: 'potion-logic',
        config: {
          ingredientCount: difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6,
          clueCount: difficulty === 'easy' ? 5 : difficulty === 'medium' ? 4 : 3,
        },
        solution: { stub: true },
        timeLimit: meta.timeLimit,
      };

    case 'leaf-sort':
      return {
        type: 'leaf-sort',
        config: {
          leafCount: difficulty === 'easy' ? 8 : difficulty === 'medium' ? 12 : 16,
          bucketCount: 4,
        },
        solution: { stub: true },
        timeLimit: meta.timeLimit,
      };

    case 'cipher-stones':
      return {
        type: 'cipher-stones',
        config: {
          messageLength: difficulty === 'easy' ? 12 : difficulty === 'medium' ? 20 : 28,
          cipherType: 'substitution',
        },
        solution: { stub: true },
        timeLimit: meta.timeLimit,
      };

    case 'path-weaver':
      return {
        type: 'path-weaver',
        config: {
          gridSize: difficulty === 'easy' ? 5 : difficulty === 'medium' ? 7 : 9,
          nodeCount: difficulty === 'easy' ? 6 : difficulty === 'medium' ? 10 : 14,
        },
        solution: { stub: true },
        timeLimit: meta.timeLimit,
      };

    default:
      return {
        type: minigameId,
        config: {},
        solution: {},
        timeLimit: 120,
      };
  }
}

function generateStubGrid(difficulty: 'easy' | 'medium' | 'hard'): number[][] {
  const size = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 6 : 7;
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Math.random() > 0.5 ? 1 : 0)
  );
}

// ============================================================================
// validateSolution
// ============================================================================
export function validateSolution(
  puzzle: MinigamePuzzle,
  submission: Record<string, unknown>
): boolean {
  switch (puzzle.type) {
    case 'grove-words':
      return validateGroveWords(puzzle, submission);
    case 'kindred':
      return validateKindred(puzzle, submission);
    case 'stone-pairs':
      return validateStonePairs(puzzle, submission);
    default:
      // Stub minigames always validate true
      return true;
  }
}

function validateGroveWords(
  puzzle: MinigamePuzzle,
  submission: Record<string, unknown>
): boolean {
  const answer = (puzzle.solution.answer as string).toUpperCase();
  const finalGuess = String(submission.finalGuess ?? '').toUpperCase();
  const guesses = submission.guesses as string[] | undefined;

  if (finalGuess !== answer) return false;
  if (guesses && guesses.length > 6) return false;

  return true;
}

function validateKindred(
  puzzle: MinigamePuzzle,
  submission: Record<string, unknown>
): boolean {
  const correctGroups = puzzle.solution.groups as Array<{ category: string; words: string[] }>;
  const submittedGroups = submission.groups as string[][] | undefined;

  if (!submittedGroups || submittedGroups.length !== 4) return false;

  const normalizedCorrect = correctGroups.map((g) => [...g.words].sort().join(','));
  const normalizedSubmitted = submittedGroups.map((g) =>
    [...g].map((w) => String(w).toUpperCase()).sort().join(',')
  );

  // Each submitted group must match one correct group
  for (const submitted of normalizedSubmitted) {
    if (!normalizedCorrect.includes(submitted)) return false;
  }

  return true;
}

function validateStonePairs(
  puzzle: MinigamePuzzle,
  submission: Record<string, unknown>
): boolean {
  const seed = puzzle.solution.seed as number;
  const rng = seededRandom(seed);
  const selectedIcons = STONE_PAIR_ICONS.slice(0, 8);
  const cards = [...selectedIcons, ...selectedIcons];
  const layout = shuffleWithRng(cards, rng);

  const totalFlips = submission.totalFlips as number | undefined;
  const solved = submission.solved as boolean | undefined;

  if (!solved) return false;

  // Plausibility: minimum 16 flips (perfect play) and max 40
  if (totalFlips !== undefined && (totalFlips < 16 || totalFlips > 40)) return false;

  // Verify all pairs found if flips data provided
  const flips = submission.flips as Array<{ pos: number; pos2?: number }> | undefined;
  if (flips) {
    const foundPairs = new Set<number>();
    for (const flip of flips) {
      const pos1 = flip.pos;
      const pos2 = flip.pos2;
      if (pos2 !== undefined && layout[pos1] === layout[pos2]) {
        foundPairs.add(pos1);
        foundPairs.add(pos2);
      }
    }
    if (foundPairs.size !== layout.length) return false;
  }

  return true;
}

// ============================================================================
// Exports for pool info
// ============================================================================
export const MINIGAME_IDS = Object.keys(MINIGAME_META);
export const MINIGAME_POOL = MINIGAME_META;

export { GROVE_WORDS, KINDRED_PACKS, STONE_PAIR_ICONS, seededRandom, shuffleWithRng };
