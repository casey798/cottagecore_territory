import { useState, useEffect, useRef } from 'react';
import { formatCountdown } from '@/utils/time';

interface CountdownResult {
  remaining: number;
  formatted: string;
  isExpired: boolean;
}

export function useCountdown(target: Date | string | null): CountdownResult {
  const targetMs = target
    ? typeof target === 'string'
      ? new Date(target).getTime()
      : target.getTime()
    : 0;

  const [remaining, setRemaining] = useState(() =>
    targetMs ? Math.max(0, targetMs - Date.now()) : 0,
  );
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!targetMs) {
      setRemaining(0);
      return;
    }

    let lastUpdate = Date.now();

    const tick = () => {
      const now = Date.now();
      if (now - lastUpdate >= 1000) {
        lastUpdate = now;
        const diff = Math.max(0, targetMs - now);
        setRemaining(diff);
        if (diff <= 0) return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [targetMs]);

  return {
    remaining,
    formatted: formatCountdown(remaining),
    isExpired: remaining <= 0,
  };
}
