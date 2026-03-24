import { COLOR_SORT_TIME_LIMIT } from '@/constants/config';
export type { MinigameInfo } from '@/types';
import type { MinigameInfo } from '@/types';

export const MINIGAME_DIFFICULTY: Record<string, 'easy' | 'medium' | 'hard'> = {
  // Easy
  'stone-pairs':     'easy',
  'leaf-sort':       'easy',
  'bloom-sequence':  'easy',
  'firefly-flow':    'easy',
  'number-grove':    'easy',
  // Medium
  'grove-words':     'medium',
  'word-clusters':   'medium',
  'cipher-stones':   'medium',
  'pips':            'medium',
  'mosaic':          'medium',
  // Hard
  'potion-logic':    'hard',
  'path-weaver':     'hard',
  'grove-equations': 'hard',
  'shift-slide':     'hard',
  'vine-trail':      'hard',
};

export const ALL_MINIGAMES: MinigameInfo[] = [
  { minigameId: 'grove-words', name: 'Wordle', timeLimit: 180, description: 'Guess the word in 6 tries', completed: false, difficulty: MINIGAME_DIFFICULTY['grove-words'] },
  { minigameId: 'word-clusters', name: 'Word Clusters', timeLimit: 180, description: 'Sort 16 words into 4 groups. 8 mistakes allowed.', completed: false, difficulty: MINIGAME_DIFFICULTY['word-clusters'] },
  { minigameId: 'pips', name: 'Snuff Out', timeLimit: 75, description: 'Turn all the cells dark. Tap to toggle a cell and its neighbours.', completed: false, difficulty: MINIGAME_DIFFICULTY['pips'] },
  { minigameId: 'vine-trail', name: 'Word Hunt', timeLimit: 180, description: 'Find all the hidden words in the letter grid. Every letter belongs to a word \u2014 trace your path and hunt them down.', completed: false, difficulty: MINIGAME_DIFFICULTY['vine-trail'] },
  { minigameId: 'mosaic', name: 'Tile Fit', timeLimit: 120, description: 'Fit all the colored pieces into the grid. No gaps, no overlaps.', completed: false, difficulty: MINIGAME_DIFFICULTY['mosaic'] },
  { minigameId: 'number-grove', name: 'Mini Sudoku', timeLimit: 90, description: 'Fill the 6\u00d76 grid so every row, column, and box contains each number from 1 to 6 exactly once.', completed: false, difficulty: MINIGAME_DIFFICULTY['number-grove'] },
  { minigameId: 'stone-pairs', name: 'Flip & Match', timeLimit: 90, description: 'Flip cards to find matching pairs. Remember what you saw \u2014 every flip counts.', completed: false, difficulty: MINIGAME_DIFFICULTY['stone-pairs'] },
  { minigameId: 'potion-logic', name: 'Logic Grid', timeLimit: 150, description: 'Read the clues. Deduce which ingredient and effect belongs to each potion. Process of elimination.', completed: false, difficulty: MINIGAME_DIFFICULTY['potion-logic'] },
  { minigameId: 'leaf-sort', name: 'Color Sort', timeLimit: COLOR_SORT_TIME_LIMIT, description: 'Sort colored beads into jars. Move one bead at a time \u2014 each jar must hold only one color.', completed: false, difficulty: MINIGAME_DIFFICULTY['leaf-sort'] },
  { minigameId: 'cipher-stones', name: 'Cipher', timeLimit: 150, description: 'A famous quote has been scrambled \u2014 every letter replaced with another. Decode it letter by letter before time runs out.', completed: false, difficulty: MINIGAME_DIFFICULTY['cipher-stones'] },
  { minigameId: 'path-weaver', name: 'Nonogram', timeLimit: 180, description: 'Use number clues to fill a pixel grid and reveal a hidden image.', completed: false, difficulty: MINIGAME_DIFFICULTY['path-weaver'] },
  { minigameId: 'firefly-flow', name: 'Connect the Dots', timeLimit: 90, description: 'Connect matching colour pairs with paths. Fill every tile on the grid \u2014 no gaps, no crossings.', completed: false, difficulty: MINIGAME_DIFFICULTY['firefly-flow'] },
  { minigameId: 'grove-equations', name: 'Number Crunch', timeLimit: 90, description: 'Tap the operators between four numbers to make them equal the target.', completed: false, difficulty: MINIGAME_DIFFICULTY['grove-equations'] },
  { minigameId: 'bloom-sequence', name: 'Spot the Pattern', timeLimit: 60, description: 'A sequence of 5 items follows a pattern. Pick the correct 6th item \u2014 3 rounds, no mistakes allowed.', completed: false, difficulty: MINIGAME_DIFFICULTY['bloom-sequence'] },
  { minigameId: 'shift-slide', name: 'Tile Slide', timeLimit: 120, description: 'Slide the tiles to piece together a hidden picture.', completed: false, difficulty: MINIGAME_DIFFICULTY['shift-slide'] },
];
