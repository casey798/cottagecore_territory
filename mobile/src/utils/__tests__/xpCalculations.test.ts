import { canEarnXp, xpToWinsRemaining } from '../xpCalculations';

describe('xpCalculations', () => {
  describe('canEarnXp', () => {
    it('returns true when below cap', () => {
      expect(canEarnXp(0)).toBe(true);
      expect(canEarnXp(75)).toBe(true);
    });

    it('returns false at cap', () => {
      expect(canEarnXp(100)).toBe(false);
    });

    it('returns false above cap', () => {
      expect(canEarnXp(125)).toBe(false);
    });
  });

  describe('xpToWinsRemaining', () => {
    it('returns 4 at 0 XP', () => {
      expect(xpToWinsRemaining(0)).toBe(4);
    });

    it('returns 3 at 25 XP', () => {
      expect(xpToWinsRemaining(25)).toBe(3);
    });

    it('returns 0 at 100 XP', () => {
      expect(xpToWinsRemaining(100)).toBe(0);
    });

    it('returns 0 above cap', () => {
      expect(xpToWinsRemaining(125)).toBe(0);
    });
  });

});
