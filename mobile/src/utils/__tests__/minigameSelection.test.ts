import { selectMinigamesByDifficulty } from '../minigameSelection';
import { MINIGAME_DIFFICULTY } from '@/constants/minigames';
import { MinigameInfo } from '@/types';

function makeMg(id: string): MinigameInfo {
  return { minigameId: id, name: id, timeLimit: 90, description: '', completed: false };
}

const FULL_POOL: MinigameInfo[] = Object.keys(MINIGAME_DIFFICULTY).map(makeMg);

function getDifficulty(mg: MinigameInfo) {
  return MINIGAME_DIFFICULTY[mg.minigameId] ?? 'medium';
}

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 } as const;

describe('selectMinigamesByDifficulty', () => {
  it('returns exactly 6 items from the full pool', () => {
    const result = selectMinigamesByDifficulty(FULL_POOL);
    expect(result).toHaveLength(6);
  });

  it('returns 2 Easy, 3 Medium, 1 Hard from the full pool', () => {
    for (let i = 0; i < 20; i++) {
      const result = selectMinigamesByDifficulty(FULL_POOL);
      const counts = { easy: 0, medium: 0, hard: 0 };
      for (const mg of result) {
        counts[getDifficulty(mg)]++;
      }
      expect(counts).toEqual({ easy: 2, medium: 3, hard: 1 });
    }
  });

  it('orders results by difficulty: Easy → Medium → Hard', () => {
    for (let i = 0; i < 20; i++) {
      const result = selectMinigamesByDifficulty(FULL_POOL);
      const orders = result.map((mg) => DIFFICULTY_ORDER[getDifficulty(mg)]);
      for (let j = 1; j < orders.length; j++) {
        expect(orders[j]).toBeGreaterThanOrEqual(orders[j - 1]);
      }
    }
  });

  it('does not mutate the input array', () => {
    const input = [...FULL_POOL];
    const originalIds = input.map((m) => m.minigameId);
    selectMinigamesByDifficulty(input);
    expect(input.map((m) => m.minigameId)).toEqual(originalIds);
    expect(input).toHaveLength(FULL_POOL.length);
  });

  it('returns fewer than 6 when pool is small', () => {
    const small = [makeMg('stone-pairs'), makeMg('grove-words')];
    const result = selectMinigamesByDifficulty(small);
    expect(result.length).toBeLessThanOrEqual(6);
    expect(result.length).toBeGreaterThan(0);
  });

  it('compensates from medium when easy bucket is short', () => {
    const pool = [
      makeMg('stone-pairs'),       // easy
      makeMg('grove-words'),       // medium
      makeMg('kindred'),           // medium
      makeMg('cipher-stones'),     // medium
      makeMg('pips'),              // medium
      makeMg('mosaic'),            // medium
      makeMg('potion-logic'),      // hard
    ];
    for (let i = 0; i < 20; i++) {
      const result = selectMinigamesByDifficulty(pool);
      expect(result).toHaveLength(6);
      const counts = { easy: 0, medium: 0, hard: 0 };
      for (const mg of result) {
        counts[getDifficulty(mg)]++;
      }
      expect(counts.easy).toBe(1);
      expect(counts.medium).toBe(4);
      expect(counts.hard).toBe(1);
    }
  });
});
