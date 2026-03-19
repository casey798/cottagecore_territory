import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useGameStore } from '@/store/useGameStore';
import { submitLeave } from '@/api/game';

const BACKGROUND_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export function useDwellTracking(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capturedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // Capture the active session ID at the moment of backgrounding
        const sessionId = useGameStore.getState().activeLocationSessionId;
        if (!sessionId) return;

        capturedSessionIdRef.current = sessionId;

        timerRef.current = setTimeout(() => {
          // App has been backgrounded for 2+ minutes — fire leave
          const currentSessionId = capturedSessionIdRef.current;
          if (currentSessionId) {
            submitLeave(currentSessionId, 'app_backgrounded');
            useGameStore.getState().clearActiveLocationSession();
            capturedSessionIdRef.current = null;
          }
          timerRef.current = null;
        }, BACKGROUND_TIMEOUT_MS);
      } else if (nextState === 'active') {
        // Returned to foreground before timeout — cancel
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        capturedSessionIdRef.current = null;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);
}
