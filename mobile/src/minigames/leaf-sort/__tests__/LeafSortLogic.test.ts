import {
  generatePuzzle,
  checkWin,
  canMove,
  applyMove,
  BEAD_COLORS,
  NUM_JARS,
  type Jars,
  type JarData,
} from '../LeafSortLogic';

function target(beads: JarData['beads']): JarData {
  return { beads, isBuffer: false };
}

function buffer(beads: JarData['beads'] = []): JarData {
  return { beads, isBuffer: true };
}

describe('LeafSortLogic', () => {
  describe('generatePuzzle', () => {
    it('returns 5 jars total', () => {
      const jars = generatePuzzle();
      expect(jars).toHaveLength(NUM_JARS);
      expect(NUM_JARS).toBe(5);
    });

    it('has 4 target jars and 1 buffer jar', () => {
      const jars = generatePuzzle();
      const targets = jars.filter((j) => !j.isBuffer);
      const buffers = jars.filter((j) => j.isBuffer);
      expect(targets).toHaveLength(4);
      expect(buffers).toHaveLength(1);
    });

    it('has exactly 16 beads total (4 colors x 4 beads)', () => {
      const jars = generatePuzzle();
      const total = jars.reduce((sum, jar) => sum + jar.beads.length, 0);
      expect(total).toBe(16);
    });

    it('has exactly 4 beads of each color', () => {
      const jars = generatePuzzle();
      const counts: Record<string, number> = {};
      for (const jar of jars) {
        for (const bead of jar.beads) {
          counts[bead] = (counts[bead] || 0) + 1;
        }
      }
      for (const color of BEAD_COLORS) {
        expect(counts[color]).toBe(4);
      }
    });

    it('no jar exceeds capacity of 4', () => {
      const jars = generatePuzzle();
      for (const jar of jars) {
        expect(jar.beads.length).toBeLessThanOrEqual(4);
      }
    });

    it('is not already solved', () => {
      const jars = generatePuzzle();
      expect(checkWin(jars)).toBe(false);
    });
  });

  describe('checkWin', () => {
    it('returns true when all 4 target jars have 4 same-color beads', () => {
      const jars: Jars = [
        target(['red', 'red', 'red', 'red']),
        target(['gold', 'gold', 'gold', 'gold']),
        target(['green', 'green', 'green', 'green']),
        target(['brown', 'brown', 'brown', 'brown']),
        buffer(),
      ];
      expect(checkWin(jars)).toBe(true);
    });

    it('returns false when a target jar has mixed colors', () => {
      const jars: Jars = [
        target(['red', 'red', 'gold', 'red']),
        target(['gold', 'gold', 'red', 'gold']),
        target(['green', 'green', 'green', 'green']),
        target(['brown', 'brown', 'brown', 'brown']),
        buffer(),
      ];
      expect(checkWin(jars)).toBe(false);
    });

    it('returns false when a target jar has fewer than 4 beads', () => {
      const jars: Jars = [
        target(['red', 'red', 'red']),
        target(['gold', 'gold', 'gold', 'gold']),
        target(['green', 'green', 'green', 'green']),
        target(['brown', 'brown', 'brown', 'brown']),
        buffer(['red']),
      ];
      expect(checkWin(jars)).toBe(false);
    });

    it('returns false when a target jar is empty', () => {
      const jars: Jars = [
        target(['red', 'red', 'red', 'red']),
        target(['gold', 'gold', 'gold', 'gold']),
        target([]),
        target(['brown', 'brown', 'brown', 'brown']),
        buffer(['green', 'green', 'green', 'green']),
      ];
      expect(checkWin(jars)).toBe(false);
    });

    it('returns true even when buffer jar contains leftover beads', () => {
      const jars: Jars = [
        target(['red', 'red', 'red', 'red']),
        target(['gold', 'gold', 'gold', 'gold']),
        target(['green', 'green', 'green', 'green']),
        target(['brown', 'brown', 'brown', 'brown']),
        buffer(['red', 'gold']),
      ];
      expect(checkWin(jars)).toBe(true);
    });

    it('ignores buffer jar entirely during win check', () => {
      const jars: Jars = [
        target(['red', 'red', 'red', 'red']),
        target(['gold', 'gold', 'gold', 'gold']),
        target(['green', 'green', 'green', 'green']),
        target(['brown', 'brown', 'brown', 'brown']),
        buffer(['red', 'gold', 'green', 'brown']),
      ];
      expect(checkWin(jars)).toBe(true);
    });
  });

  describe('canMove', () => {
    const jars: Jars = [
      target(['red', 'red', 'gold']),
      target(['gold', 'gold', 'gold']),
      target(['red', 'red']),
      target(['brown', 'brown', 'brown', 'brown']),
      buffer(['green']),
    ];

    it('allows move to empty target jar when source top matches nothing — still empty', () => {
      // Move gold from jar 0 to an empty slot — jar 2 has red on top so no match,
      // but we can test move to buffer (jar 4 has green, no match for gold)
      // Let's test with a fresh fixture
      const jarsWithEmpty: Jars = [
        target(['red', 'gold']),
        target([]),
        target(['green']),
        target(['brown']),
        buffer(),
      ];
      expect(canMove(jarsWithEmpty, 0, 1)).toBe(true);
    });

    it('allows move to jar with matching top color', () => {
      expect(canMove(jars, 0, 1)).toBe(true); // gold onto gold
    });

    it('rejects move to jar with different top color', () => {
      expect(canMove(jars, 0, 2)).toBe(false); // gold onto red
    });

    it('rejects move to full jar', () => {
      expect(canMove(jars, 0, 3)).toBe(false); // jar 3 is full
    });

    it('rejects move from empty jar', () => {
      const jarsWithEmpty: Jars = [
        target(['red']),
        target([]),
        target([]),
        target([]),
        buffer(),
      ];
      expect(canMove(jarsWithEmpty, 1, 0)).toBe(false);
    });

    it('rejects move to same jar', () => {
      expect(canMove(jars, 0, 0)).toBe(false);
    });

    it('allows move from buffer jar to empty target jar', () => {
      const jarsForBuf: Jars = [
        target([]),
        target(['red']),
        target(['gold']),
        target(['brown']),
        buffer(['green']),
      ];
      expect(canMove(jarsForBuf, 4, 0)).toBe(true);  // green into empty target
      expect(canMove(jarsForBuf, 4, 1)).toBe(false);  // green onto red
    });
  });

  describe('applyMove', () => {
    it('moves top bead from source to destination', () => {
      const jars: Jars = [
        target(['red', 'gold']),
        target(['gold']),
        target([]),
        target([]),
        buffer(),
      ];
      const result = applyMove(jars, 0, 1);
      expect(result[0].beads).toEqual(['red']);
      expect(result[1].beads).toEqual(['gold', 'gold']);
    });

    it('does not mutate the original jars', () => {
      const jars: Jars = [
        target(['red', 'gold']),
        target(['gold']),
        target([]),
        target([]),
        buffer(),
      ];
      const original0 = [...jars[0].beads];
      const original1 = [...jars[1].beads];
      applyMove(jars, 0, 1);
      expect(jars[0].beads).toEqual(original0);
      expect(jars[1].beads).toEqual(original1);
    });

    it('preserves isBuffer flag after move', () => {
      const jars: Jars = [
        target(['red']),
        target([]),
        target([]),
        target([]),
        buffer(),
      ];
      const result = applyMove(jars, 0, 4);
      expect(result[0].isBuffer).toBe(false);
      expect(result[4].isBuffer).toBe(true);
      expect(result[4].beads).toEqual(['red']);
    });

    it('moves bead to empty jar', () => {
      const jars: Jars = [
        target(['red']),
        target([]),
        target([]),
        target([]),
        buffer(),
      ];
      const result = applyMove(jars, 0, 1);
      expect(result[0].beads).toEqual([]);
      expect(result[1].beads).toEqual(['red']);
    });
  });
});
