import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useClanStore } from '@/store/useClanStore';
import { useGameStore } from '@/store/useGameStore';
import { ClanScore, WsMessage } from '@/types';
import { WS_URL } from '@/constants/api';
import * as scoresApi from '@/api/scores';
import { getStoredTokens } from '@/api/client';

const POLL_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;

interface UseClanScoresResult {
  clans: ClanScore[];
  isConnected: boolean;
  lastUpdated: string | null;
}

export function useClanScores(): UseClanScoresResult {
  const clans = useClanStore((s) => s.clans);
  const lastUpdated = useClanStore((s) => s.lastUpdated);
  const setClans = useClanStore((s) => s.setClans);
  const setCaptureResult = useGameStore((s) => s.setCaptureResult);

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
          useClanStore.getState().setCaptureResult(
            message.data.winnerClan,
            message.data.spaceName
          );
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      isConnectedRef.current = false;
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
  }, [setClans, setCaptureResult, startPolling, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;

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
  }, [fetchScores, connectWebSocket, stopPolling]);

  const sorted = useMemo(
    () => [...clans].sort((a, b) => b.todayXp - a.todayXp),
    [clans]
  );

  return {
    clans: sorted,
    isConnected: isConnectedRef.current,
    lastUpdated,
  };
}
