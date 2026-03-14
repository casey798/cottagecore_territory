import { useMemo } from 'react';
import { useClanStore } from '@/store/useClanStore';
import { ClanScore } from '@/types';

interface UseClanScoresResult {
  clans: ClanScore[];
  isConnected: boolean;
  lastUpdated: string | null;
}

/**
 * Data-only hook for sorted clan scores.
 * WebSocket connection is managed by useWebSocket (mounted in MainStack).
 */
export function useClanScores(): UseClanScoresResult {
  const clans = useClanStore((s) => s.clans);
  const lastUpdated = useClanStore((s) => s.lastUpdated);
  const isConnected = useClanStore((s) => s.wsConnected);

  const sorted = useMemo(
    () => [...clans].sort((a, b) => b.todayXp - a.todayXp),
    [clans]
  );

  return {
    clans: sorted,
    isConnected,
    lastUpdated,
  };
}
