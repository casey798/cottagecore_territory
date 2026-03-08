import {
  getTodayISTString,
  isWithinGameHours,
  getMidnightISTTimestamp,
  getNext8amISTEpochSeconds,
} from '../../shared/time';

describe('Time Utilities', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getTodayISTString', () => {
    it('returns a string in YYYY-MM-DD format', () => {
      const result = getTodayISTString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns the correct IST date for a known UTC time', () => {
      jest.useFakeTimers();
      // 2026-03-07 at 20:00 UTC = 2026-03-08 at 01:30 IST
      jest.setSystemTime(new Date('2026-03-07T20:00:00.000Z'));

      const result = getTodayISTString();
      expect(result).toBe('2026-03-08');

      jest.useRealTimers();
    });

    it('returns same IST date for early UTC time', () => {
      jest.useFakeTimers();
      // 2026-03-07 at 02:00 UTC = 2026-03-07 at 07:30 IST
      jest.setSystemTime(new Date('2026-03-07T02:00:00.000Z'));

      const result = getTodayISTString();
      expect(result).toBe('2026-03-07');

      jest.useRealTimers();
    });
  });

  describe('isWithinGameHours', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns false at 7:59 AM IST (UTC 2:29 AM)', () => {
      // 7:59 AM IST = 2:29 AM UTC
      jest.setSystemTime(new Date('2026-03-07T02:29:00.000Z'));
      expect(isWithinGameHours()).toBe(false);
    });

    it('returns true at 8:00 AM IST (UTC 2:30 AM)', () => {
      // 8:00 AM IST = 2:30 AM UTC
      jest.setSystemTime(new Date('2026-03-07T02:30:00.000Z'));
      expect(isWithinGameHours()).toBe(true);
    });

    it('returns true at 12:00 PM IST (UTC 6:30 AM)', () => {
      // 12:00 PM IST = 6:30 AM UTC
      jest.setSystemTime(new Date('2026-03-07T06:30:00.000Z'));
      expect(isWithinGameHours()).toBe(true);
    });

    it('returns true at 5:59 PM IST (UTC 12:29 PM)', () => {
      // 5:59 PM IST = 12:29 PM UTC
      jest.setSystemTime(new Date('2026-03-07T12:29:00.000Z'));
      expect(isWithinGameHours()).toBe(true);
    });

    it('returns false at 6:00 PM IST (UTC 12:30 PM)', () => {
      // 6:00 PM IST = 12:30 PM UTC
      jest.setSystemTime(new Date('2026-03-07T12:30:00.000Z'));
      expect(isWithinGameHours()).toBe(false);
    });

    it('returns false at 11:00 PM IST (UTC 5:30 PM)', () => {
      // 11:00 PM IST = 5:30 PM UTC
      jest.setSystemTime(new Date('2026-03-07T17:30:00.000Z'));
      expect(isWithinGameHours()).toBe(false);
    });

    it('returns false at midnight IST (UTC 6:30 PM previous day)', () => {
      // 12:00 AM IST = 6:30 PM UTC (previous day)
      jest.setSystemTime(new Date('2026-03-06T18:30:00.000Z'));
      expect(isWithinGameHours()).toBe(false);
    });

    it('returns true at 8:01 AM IST', () => {
      // 8:01 AM IST = 2:31 AM UTC
      jest.setSystemTime(new Date('2026-03-07T02:31:00.000Z'));
      expect(isWithinGameHours()).toBe(true);
    });
  });

  describe('getMidnightISTTimestamp', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns a timestamp in the future', () => {
      jest.setSystemTime(new Date('2026-03-07T10:00:00.000Z'));
      const midnight = getMidnightISTTimestamp();
      const now = Date.now();

      expect(midnight).toBeGreaterThan(now);
    });

    it('returns epoch ms for next midnight IST (18:30 UTC)', () => {
      // At 10:00 AM IST (4:30 AM UTC) on March 7
      jest.setSystemTime(new Date('2026-03-07T04:30:00.000Z'));
      const midnight = getMidnightISTTimestamp();

      // Next midnight IST = March 7 18:30 UTC (midnight IST March 8)
      const expectedMidnight = new Date('2026-03-07T18:30:00.000Z').getTime();
      expect(midnight).toBe(expectedMidnight);
    });

    it('returns next day midnight if already past midnight IST', () => {
      // 1:00 AM IST on March 8 = 7:30 PM UTC March 7
      jest.setSystemTime(new Date('2026-03-07T19:30:00.000Z'));
      const midnight = getMidnightISTTimestamp();

      // Next midnight IST = March 8 18:30 UTC (midnight IST March 9)
      const expectedMidnight = new Date('2026-03-08T18:30:00.000Z').getTime();
      expect(midnight).toBe(expectedMidnight);
    });
  });

  describe('getNext8amISTEpochSeconds', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns epoch seconds (not milliseconds)', () => {
      jest.setSystemTime(new Date('2026-03-07T10:00:00.000Z'));
      const result = getNext8amISTEpochSeconds();

      // Should be in seconds (roughly 10 digits), not milliseconds (13 digits)
      expect(result.toString().length).toBeLessThanOrEqual(10);
    });

    it('returns next 8 AM IST if current time is before 8 AM IST', () => {
      // 7:00 AM IST = 1:30 AM UTC on March 7
      jest.setSystemTime(new Date('2026-03-07T01:30:00.000Z'));
      const result = getNext8amISTEpochSeconds();

      // 8:00 AM IST = 2:30 AM UTC on March 7
      const expected = Math.floor(new Date('2026-03-07T02:30:00.000Z').getTime() / 1000);
      expect(result).toBe(expected);
    });

    it('returns next day 8 AM IST if current time is after 8 AM IST', () => {
      // 3:00 PM IST = 9:30 AM UTC on March 7
      jest.setSystemTime(new Date('2026-03-07T09:30:00.000Z'));
      const result = getNext8amISTEpochSeconds();

      // 8:00 AM IST next day = 2:30 AM UTC on March 8
      const expected = Math.floor(new Date('2026-03-08T02:30:00.000Z').getTime() / 1000);
      expect(result).toBe(expected);
    });

    it('returns next day 8 AM IST if current time is exactly 8 AM IST', () => {
      // Exactly 8:00 AM IST = 2:30 AM UTC
      jest.setSystemTime(new Date('2026-03-07T02:30:00.000Z'));
      const result = getNext8amISTEpochSeconds();

      // Should return next day 8 AM IST since nowIST >= target
      const expected = Math.floor(new Date('2026-03-08T02:30:00.000Z').getTime() / 1000);
      expect(result).toBe(expected);
    });
  });
});
