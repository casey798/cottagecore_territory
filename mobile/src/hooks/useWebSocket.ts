import { useEffect, useRef, useCallback } from 'react';
import { AppState, ToastAndroid } from 'react-native';
import { useClanStore } from '@/store/useClanStore';
import { useGameStore } from '@/store/useGameStore';
import { useMapStore } from '@/store/useMapStore';
import { ClanScore, WsMessage } from '@/types';
import { WS_URL } from '@/constants/api';
import * as scoresApi from '@/api/scores';
import * as mapApi from '@/api/map';
import { getStoredTokens } from '@/api/client';
import { getTodayISTString } from '@/utils/time';

const POLL_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * App-level WebSocket hook. Manages connection lifecycle, message dispatch,
 * and a polling fallback for clan scores. Should be mounted once at the
 * MainStack level so the connection persists across all screens.
 */
export function useWebSocket(): void {
  const setClans = useClanStore((s) => s.setClans);
  const setClanCaptureResult = useClanStore((s) => s.setCaptureResult);
  const setCaptureResult = useGameStore((s) => s.setCaptureResult);
  const setCelebrationPending = useGameStore((s) => s.setCelebrationPending);
  const resetDaily = useGameStore((s) => s.resetDaily);
  const setResetSeq = useGameStore((s) => s.setResetSeq);
  const setWsConnected = useClanStore((s) => s.setWsConnected);

  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchScores = useCallback(async () => {
    try {
      const result = await scoresApi.getClanScores();
      if (result.success && result.data?.clans) {
        setClans(result.data.clans);
      }
    } catch {
      // Silently fail — polling will retry
    }
  }, [setClans]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => {
      if (!isConnectedRef.current && mountedRef.current) {
        fetchScores();
      }
    }, POLL_INTERVAL_MS);
  }, [fetchScores]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(async () => {
    if (!mountedRef.current) return;

    const stored = await getStoredTokens();
    if (!stored?.token) {
      startPolling();
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${stored.token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      isConnectedRef.current = true;
      reconnectAttemptRef.current = 0;
      setWsConnected(true);
      stopPolling();
    };

    ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data as string);

        if (message.type === 'SCORE_UPDATE') {
          const updatedClans: ClanScore[] = message.data.clans.map((c) => {
            const existing = useClanStore.getState().clans.find(
              (e) => e.clanId === c.clanId
            );
            return {
              clanId: c.clanId,
              todayXp: c.todayXp,
              seasonXp: existing?.seasonXp ?? 0,
              spacesCaptured: existing?.spacesCaptured ?? 0,
            };
          });
          setClans(updatedClans);
        } else if (message.type === 'CAPTURE') {
          setCaptureResult({
            winnerClan: message.data.winnerClan,
            spaceName: message.data.spaceName,
          });
          setCelebrationPending(message.data.winnerClan, message.data.spaceName);
          setClanCaptureResult(
            message.data.winnerClan,
            message.data.spaceName
          );
        } else if (message.type === 'DAILY_RESET') {
          // Step 1: Wipe local game state for the new day
          resetDaily();
          // Step 2: Clear locked flags so UI doesn't show stale locks
          useMapStore.getState().clearLockedFlags();
          // Step 3: Store the server's new resetSeq
          if (message.data.resetSeq) {
            setResetSeq(message.data.resetSeq);
          }
          // Step 4: Refresh server data
          useMapStore.getState().loadTodayLocations();
          useMapStore.getState().loadCapturedSpaces();
          fetchScores();
          ToastAndroid.show('A new day has begun!', ToastAndroid.SHORT);
        } else if (message.type === 'SCORING_COMPLETE') {
          // Refresh locations and captured spaces to show new territory
          useMapStore.getState().loadTodayLocations();
          useMapStore.getState().loadCapturedSpaces();
          // Refresh clan scores
          fetchScores();
          // Trigger capture celebration screen
          setCaptureResult({
            winnerClan: message.data.winnerClan,
            spaceName: message.data.spaceName,
          });
          setCelebrationPending(message.data.winnerClan, message.data.spaceName);
          setClanCaptureResult(
            message.data.winnerClan,
            message.data.spaceName
          );
        } else if (message.type === 'SCORES_CHANGED') {
          fetchScores();
          useMapStore.getState().loadCapturedSpaces();
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      isConnectedRef.current = false;
      setWsConnected(false);
      wsRef.current = null;
      if (!mountedRef.current) return;

      startPolling();

      const backoff = Math.min(
        1000 * Math.pow(2, reconnectAttemptRef.current),
        MAX_BACKOFF_MS
      );
      reconnectAttemptRef.current += 1;

      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connectWebSocket();
        }
      }, backoff);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [setClans, setCaptureResult, setCelebrationPending, setClanCaptureResult, resetDaily, setResetSeq, fetchScores, setWsConnected, startPolling, stopPolling]);

  // Check if local state is stale (app backgrounded across midnight or missed WS reset)
  const checkAndClearStaleState = useCallback(async () => {
    const today = getTodayISTString();
    const { lastResetDate } = useGameStore.getState();

    // Cross-day staleness: date changed while app was backgrounded
    if (lastResetDate && lastResetDate !== today) {
      resetDaily();
      useMapStore.getState().clearLockedFlags();
      useMapStore.getState().loadTodayLocations();
      useMapStore.getState().loadCapturedSpaces();
      fetchScores();
      return;
    }

    // Same-day staleness: poll server resetSeq to detect missed WS resets
    try {
      const result = await mapApi.getDailyInfo();
      if (result.success && result.data?.resetSeq) {
        const localSeq = useGameStore.getState().resetSeq;
        if (result.data.resetSeq !== localSeq) {
          resetDaily();
          setResetSeq(result.data.resetSeq);
          useMapStore.getState().clearLockedFlags();
          useMapStore.getState().loadTodayLocations();
          useMapStore.getState().loadCapturedSpaces();
          fetchScores();
        }
      }
    } catch {
      // Silently fail — will retry on next foreground
    }
  }, [resetDaily, setResetSeq, fetchScores]);

  // Re-check stale state whenever the app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkAndClearStaleState();
      }
    });
    return () => subscription.remove();
  }, [checkAndClearStaleState]);

  useEffect(() => {
    mountedRef.current = true;

    checkAndClearStaleState();
    fetchScores();
    connectWebSocket();

    return () => {
      mountedRef.current = false;
      stopPolling();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [fetchScores, connectWebSocket, stopPolling, checkAndClearStaleState]);
}
