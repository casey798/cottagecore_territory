import { formatCountdown, isWithinGameHours, getNowIST } from '../time';

describe('time utils', () => {
  describe('formatCountdown', () => {
    it('should format zero as 00:00', () => {
      expect(formatCountdown(0)).toBe('00:00');
    });

    it('should format negative as 00:00', () => {
      expect(formatCountdown(-1000)).toBe('00:00');
    });

    it('should format minutes and seconds', () => {
      expect(formatCountdown(125000)).toBe('02:05');
    });

    it('should format hours when > 60 min', () => {
      expect(formatCountdown(3661000)).toBe('01:01:01');
    });
  });

  describe('getNowIST', () => {
    it('should return a valid Date', () => {
      const now = getNowIST();
      expect(now).toBeInstanceOf(Date);
    });
  });

  describe('isWithinGameHours', () => {
    it('should return a boolean', () => {
      const result = isWithinGameHours();
      expect(typeof result).toBe('boolean');
    });
  });
});
