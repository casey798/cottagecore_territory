import { MINIGAME_POOL, MINIGAME_IDS } from '../../shared/minigames';

describe('minigames metadata', () => {
  it('exports all 21 minigame IDs (15 solo + 6 co-op)', () => {
    expect(MINIGAME_IDS).toHaveLength(21);
  });

  it('every minigame has a name, timeLimit > 0, and description', () => {
    for (const id of MINIGAME_IDS) {
      const meta = MINIGAME_POOL[id];
      expect(meta).toBeDefined();
      expect(typeof meta.name).toBe('string');
      expect(meta.name.length).toBeGreaterThan(0);
      expect(meta.timeLimit).toBeGreaterThan(0);
      expect(typeof meta.description).toBe('string');
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it('includes grove-words with 120s timeLimit', () => {
    expect(MINIGAME_POOL['grove-words']).toEqual({
      name: 'Wordle',
      timeLimit: 120,
      description: 'Guess the word in 6 tries',
      difficulty: 'medium',
    });
  });

  it('includes word-clusters with 180s timeLimit', () => {
    expect(MINIGAME_POOL['word-clusters']).toEqual({
      name: 'Word Clusters',
      timeLimit: 180,
      description: 'Sort 16 words into 4 groups. 8 mistakes allowed.',
    });
  });

  it('includes stone-pairs with 90s timeLimit', () => {
    expect(MINIGAME_POOL['stone-pairs']).toEqual({
      name: 'Flip & Match',
      timeLimit: 90,
      description: 'Flip cards to find matching pairs. Remember what you saw \u2014 every flip counts.',
      difficulty: 'easy',
    });
  });

  it('every minigame has a valid difficulty', () => {
    const validDifficulties = new Set(['easy', 'medium', 'hard']);
    for (const id of MINIGAME_IDS) {
      const meta = MINIGAME_POOL[id];
      expect(validDifficulties.has(meta.difficulty)).toBe(true);
    }
  });
});
