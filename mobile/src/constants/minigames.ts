export type MinigameDifficulty = 'easy' | 'medium' | 'hard';

export const MINIGAME_DIFFICULTY: Record<string, MinigameDifficulty> = {
  'stone-pairs': 'easy',
  'leaf-sort': 'easy',
  'bloom-sequence': 'easy',
  'firefly-flow': 'easy',
  'number-grove': 'easy',

  'grove-words': 'medium',
  'kindred': 'medium',
  'cipher-stones': 'medium',
  'pips': 'medium',
  'mosaic': 'medium',

  'potion-logic': 'hard',
  'path-weaver': 'hard',
  'grove-equations': 'hard',
  'shift-slide': 'hard',
  'vine-trail': 'hard',
};
