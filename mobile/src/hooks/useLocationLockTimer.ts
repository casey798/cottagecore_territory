import { useState, useEffect, useRef } from 'react';

export interface LockTimerResult {
  isLocked: boolean;
  remainingSeconds: number;
  formattedTime: string;
}

function computeRemaining(lockedUntil: string): number {
  const diff = new Date(lockedUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 1000));
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function useLocationLockTimer(lockedUntil: string | null | undefined): LockTimerResult {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    lockedUntil ? computeRemaining(lockedUntil) : 0,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!lockedUntil) {
      setRemainingSeconds(0);
      return;
    }

    const initial = computeRemaining(lockedUntil);
    setRemainingSeconds(initial);

    if (initial <= 0) return;

    intervalRef.current = setInterval(() => {
      const remaining = computeRemaining(lockedUntil);
      setRemainingSeconds(remaining);
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [lockedUntil]);

  return {
    isLocked: remainingSeconds > 0,
    remainingSeconds,
    formattedTime: formatTime(remainingSeconds),
  };
}
