import { haversineDistance, formatDistance } from '../distance';

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(12.9716, 77.5946, 12.9716, 77.5946)).toBe(0);
  });

  it('returns correct distance for known points (~1.5km apart in Bangalore)', () => {
    // MG Road to Cubbon Park approx
    const dist = haversineDistance(12.9758, 77.6063, 12.9766, 77.5929);
    expect(dist).toBeGreaterThan(1400);
    expect(dist).toBeLessThan(1600);
  });

  it('returns small distance for nearby points (~15m)', () => {
    // Points ~15m apart
    const dist = haversineDistance(12.97160, 77.59460, 12.97170, 77.59472);
    expect(dist).toBeGreaterThan(10);
    expect(dist).toBeLessThan(20);
  });
});

describe('formatDistance', () => {
  it('formats small distances without tilde', () => {
    expect(formatDistance(5)).toBe('5m');
    expect(formatDistance(23)).toBe('23m');
    expect(formatDistance(99)).toBe('99m');
  });

  it('formats distances >= 100m with tilde', () => {
    expect(formatDistance(100)).toBe('~100m');
    expect(formatDistance(250)).toBe('~250m');
  });

  it('rounds fractional distances', () => {
    expect(formatDistance(5.7)).toBe('6m');
    expect(formatDistance(150.3)).toBe('~150m');
  });
});
