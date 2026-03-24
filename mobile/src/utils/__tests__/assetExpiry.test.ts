import { getTimeUntilExpiry } from '../assetExpiry';

describe('getTimeUntilExpiry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-25T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns expired when timestamp is in the past', () => {
    const past = '2026-03-25T11:59:00.000Z';
    const result = getTimeUntilExpiry(past);
    expect(result.expired).toBe(true);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
  });

  it('returns correct hours and minutes for a future timestamp', () => {
    // 3 hours and 45 minutes from now
    const future = '2026-03-25T15:45:00.000Z';
    const result = getTimeUntilExpiry(future);
    expect(result.expired).toBe(false);
    expect(result.hours).toBe(3);
    expect(result.minutes).toBe(45);
  });

  it('returns 0h Nm for less than an hour remaining', () => {
    const future = '2026-03-25T12:30:00.000Z';
    const result = getTimeUntilExpiry(future);
    expect(result.expired).toBe(false);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(30);
  });

  it('returns expired for exactly now', () => {
    const now = '2026-03-25T12:00:00.000Z';
    const result = getTimeUntilExpiry(now);
    expect(result.expired).toBe(true);
  });
});
