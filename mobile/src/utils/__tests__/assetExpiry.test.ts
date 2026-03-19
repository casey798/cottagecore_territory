import { getTimeUntilExpiry } from '../assetExpiry';

describe('getTimeUntilExpiry', () => {
  it('returns expired when timestamp is in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const result = getTimeUntilExpiry(past);
    expect(result.expired).toBe(true);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
  });

  it('returns correct hours and minutes for a future timestamp', () => {
    // 3 hours and 45 minutes from now
    const future = new Date(Date.now() + (3 * 60 + 45) * 60_000).toISOString();
    const result = getTimeUntilExpiry(future);
    expect(result.expired).toBe(false);
    expect(result.hours).toBe(3);
    expect(result.minutes).toBe(45);
  });

  it('returns 0h Nm for less than an hour remaining', () => {
    const future = new Date(Date.now() + 30 * 60_000).toISOString();
    const result = getTimeUntilExpiry(future);
    expect(result.expired).toBe(false);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(30);
  });

  it('returns expired for exactly now', () => {
    const now = new Date(Date.now()).toISOString();
    const result = getTimeUntilExpiry(now);
    expect(result.expired).toBe(true);
  });
});
