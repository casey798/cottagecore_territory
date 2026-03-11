import { MINIGAME_POOL, MINIGAME_IDS } from '../../shared/minigames';

describe('minigames metadata', () => {
  it('exports all 12 minigame IDs', () => {
    expect(MINIGAME_IDS).toHaveLength(12);
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
      name: 'Grove Words',
      timeLimit: 120,
      description: 'Guess the word in 6 tries',
    });
  });

  it('includes kindred with 150s timeLimit', () => {
    expect(MINIGAME_POOL['kindred']).toEqual({
      name: 'Kindred',
      timeLimit: 150,
      description: 'Group 16 words into 4 groups',
    });
  });

  it('includes stone-pairs with 60s timeLimit', () => {
    expect(MINIGAME_POOL['stone-pairs']).toEqual({
      name: 'Stone Pairs',
      timeLimit: 60,
      description: 'Find matching pairs',
    });
  });
});
