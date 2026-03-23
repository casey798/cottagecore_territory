import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useClanStore } from '@/store/useClanStore';
import { ClanScore, CaptureHistoryEntry } from '@/types';
import * as scoresApi from '@/api/scores';

interface UseClanScoresResult {
  clans: ClanScore[];
  isConnected: boolean;
  lastUpdated: string | null;
  isLoading: boolean;
  error: string | null;
  refreshScores: () => Promise<void>;
  captureHistory: CaptureHistoryEntry[];
  isLoadingHistory: boolean;
  historyError: string | null;
  hasMoreHistory: boolean;
  fetchMoreHistory: () => void;
}

/**
 * Data-only hook for sorted clan scores + paginated capture history.
 * WebSocket connection is managed by useWebSocket (mounted in MainStack).
 */
export function useClanScores(): UseClanScoresResult {
  const clans = useClanStore((s) => s.clans);
  const lastUpdated = useClanStore((s) => s.lastUpdated);
  const isConnected = useClanStore((s) => s.wsConnected);
  const isLoading = useClanStore((s) => s.isLoading);
  const error = useClanStore((s) => s.error);
  const refreshScores = useClanStore((s) => s.refreshScores);

  const sorted = useMemo(
    () => [...clans].sort((a, b) => b.todayXp - a.todayXp),
    [clans]
  );

  // ── Capture history pagination state ────────────────────────────
  const [captureHistory, setCaptureHistory] = useState<CaptureHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const fetchMoreHistory = useCallback(() => {
    if (isLoadingHistory || !hasMoreHistory) return;

    setIsLoadingHistory(true);
    setHistoryError(null);

    const cursor = cursorRef.current ?? undefined;

    scoresApi.getCaptureHistory(cursor).then((result) => {
      if (!mountedRef.current) return;

      if (result.success && result.data) {
        setCaptureHistory((prev) => [...prev, ...result.data!.captures]);
        cursorRef.current = result.data.nextCursor;
        setHasMoreHistory(result.data.nextCursor !== null);
      } else {
        setHistoryError("Couldn't load history.");
      }
      setIsLoadingHistory(false);
    }).catch(() => {
      if (!mountedRef.current) return;
      setHistoryError("Couldn't load history.");
      setIsLoadingHistory(false);
    });
  }, [isLoadingHistory, hasMoreHistory]);

  // Fetch first page on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchMoreHistory();
    return () => { mountedRef.current = false; };
    // Only run on mount — fetchMoreHistory is stable enough via guards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    clans: sorted,
    isConnected,
    lastUpdated,
    isLoading,
    error,
    refreshScores,
    captureHistory,
    isLoadingHistory,
    historyError,
    hasMoreHistory,
    fetchMoreHistory,
  };
}
