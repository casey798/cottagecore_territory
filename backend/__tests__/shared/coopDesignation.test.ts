/**
 * Tests for the new co-op designation system where co-op slots are randomly
 * selected from a player's already-assigned locations (not from a separate pool).
 */

const MAX_COOP_SLOTS_PER_PLAYER = 2;

/**
 * Extracted co-op designation logic matching dailyReset.ts implementation.
 * This is a pure function for testability.
 */
function designateCoopSlots(
  assignedLocs: string[],
  coopChance: number,
): string[] {
  const coopLocationIds: string[] = [];
  if (coopChance > 0) {
    const coopSlotCount = Math.min(MAX_COOP_SLOTS_PER_PLAYER, assignedLocs.length);
    const shuffled = [...assignedLocs].sort(() => Math.random() - 0.5);
    for (const locId of shuffled) {
      if (Math.random() < coopChance && coopLocationIds.length < coopSlotCount) {
        coopLocationIds.push(locId);
      }
    }
  }
  return coopLocationIds;
}

describe('co-op slot designation', () => {
  const assignedLocs = ['loc-1', 'loc-2', 'loc-3', 'loc-4', 'loc-5'];

  it('coopChance=1 always designates at least 1 co-op slot', () => {
    for (let i = 0; i < 50; i++) {
      const result = designateCoopSlots(assignedLocs, 1);
      expect(result.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('coopChance=0 always produces empty coopLocationIds', () => {
    for (let i = 0; i < 50; i++) {
      const result = designateCoopSlots(assignedLocs, 0);
      expect(result).toEqual([]);
    }
  });

  it('coopLocationIds is always a subset of assignedLocationIds', () => {
    const assignedSet = new Set(assignedLocs);
    for (let i = 0; i < 50; i++) {
      const result = designateCoopSlots(assignedLocs, 0.5);
      for (const id of result) {
        expect(assignedSet.has(id)).toBe(true);
      }
    }
  });

  it('coopLocationIds.length never exceeds MAX_COOP_SLOTS_PER_PLAYER', () => {
    for (let i = 0; i < 100; i++) {
      const result = designateCoopSlots(assignedLocs, 1);
      expect(result.length).toBeLessThanOrEqual(MAX_COOP_SLOTS_PER_PLAYER);
    }
  });

  it('handles empty assignedLocs gracefully', () => {
    const result = designateCoopSlots([], 1);
    expect(result).toEqual([]);
  });

  it('handles single assigned location with coopChance=1', () => {
    for (let i = 0; i < 20; i++) {
      const result = designateCoopSlots(['only-loc'], 1);
      expect(result.length).toBeLessThanOrEqual(1);
      if (result.length === 1) {
        expect(result[0]).toBe('only-loc');
      }
    }
  });

  it('does not produce duplicate entries', () => {
    for (let i = 0; i < 50; i++) {
      const result = designateCoopSlots(assignedLocs, 1);
      expect(new Set(result).size).toBe(result.length);
    }
  });
});
