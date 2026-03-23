import { renderHook, act } from '@testing-library/react-native';
import { useLocationLockTimer } from '../useLocationLockTimer';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLocationLockTimer', () => {
  it('returns isLocked false for null input', () => {
    const { result } = renderHook(() => useLocationLockTimer(null));
    expect(result.current.isLocked).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.formattedTime).toBe('0:00');
  });

  it('returns isLocked false for undefined input', () => {
    const { result } = renderHook(() => useLocationLockTimer(undefined));
    expect(result.current.isLocked).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.formattedTime).toBe('0:00');
  });

  it('returns correct formattedTime for a future lockedUntil', () => {
    const lockedUntil = new Date(Date.now() + 30 * 60 * 1000 + 500).toISOString(); // ~30 minutes
    const { result } = renderHook(() => useLocationLockTimer(lockedUntil));

    expect(result.current.isLocked).toBe(true);
    // Should be approximately 30:00 or 30:01
    expect(result.current.formattedTime).toMatch(/^30:0[01]$/);
  });

  it('formats time as m:ss correctly', () => {
    // 65 minutes 32 seconds from now
    const lockedUntil = new Date(Date.now() + (65 * 60 + 32) * 1000 + 500).toISOString();
    const { result } = renderHook(() => useLocationLockTimer(lockedUntil));

    expect(result.current.isLocked).toBe(true);
    // ~65:32 or 65:33
    expect(result.current.formattedTime).toMatch(/^65:3[23]$/);
  });

  it('flips isLocked to false when expiry passes', () => {
    const lockedUntil = new Date(Date.now() + 3000).toISOString(); // 3 seconds

    const { result } = renderHook(() => useLocationLockTimer(lockedUntil));
    expect(result.current.isLocked).toBe(true);

    // Advance past the expiry
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(result.current.isLocked).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.formattedTime).toBe('0:00');
  });

  it('cleans up interval on unmount', () => {
    const lockedUntil = new Date(Date.now() + 60000).toISOString();
    const { unmount } = renderHook(() => useLocationLockTimer(lockedUntil));

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('returns isLocked false for a past lockedUntil', () => {
    const lockedUntil = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
    const { result } = renderHook(() => useLocationLockTimer(lockedUntil));

    expect(result.current.isLocked).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.formattedTime).toBe('0:00');
  });
});
