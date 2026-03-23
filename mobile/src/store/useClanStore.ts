import { create } from 'zustand';
import { ToastAndroid } from 'react-native';
import { ClanScore, ClanId } from '@/types';
import * as scoresApi from '@/api/scores';

interface ClanState {
  clans: ClanScore[];
  lastUpdated: string | null;
  wsConnected: boolean;
  isLoading: boolean;
  error: string | null;
  initialFetchDone: boolean;
  setClans: (clans: ClanScore[]) => void;
  updateClanXp: (clanId: ClanId, newXp: number) => void;
  setCaptureResult: (winnerClan: ClanId | string, spaceName: string) => void;
  setWsConnected: (connected: boolean) => void;
  refreshScores: () => Promise<void>;
}

export const useClanStore = create<ClanState>((set, get) => ({
  clans: [],
  lastUpdated: null,
  wsConnected: false,
  isLoading: true,
  error: null,
  initialFetchDone: false,

  setClans: (incoming: ClanScore[]) =>
    set((state) => {
      // Guard against WS race condition: if incoming data has all seasonXp=0
      // but the store already has real data, preserve seasonXp/spacesCaptured
      // from existing state (WS SCORE_UPDATE doesn't carry these fields).
      let clans = incoming;
      if (
        state.initialFetchDone &&
        state.clans.length > 0 &&
        incoming.length > 0 &&
        incoming.every((c) => c.seasonXp === 0 && c.spacesCaptured === 0)
      ) {
        const existing = new Map(state.clans.map((c) => [c.clanId, c]));
        clans = incoming.map((c) => {
          const prev = existing.get(c.clanId);
          return prev
            ? { ...c, seasonXp: prev.seasonXp, spacesCaptured: prev.spacesCaptured }
            : c;
        });
      }
      return { clans, lastUpdated: new Date().toISOString(), isLoading: false, error: null, initialFetchDone: true };
    }),

  updateClanXp: (clanId: ClanId, newXp: number) =>
    set((state) => ({
      clans: state.clans.map((c) =>
        c.clanId === clanId ? { ...c, todayXp: newXp } : c
      ),
      lastUpdated: new Date().toISOString(),
    })),

  setCaptureResult: (winnerClan: ClanId | string, spaceName: string) =>
    set((state) => ({
      clans: state.clans.map((c) =>
        c.clanId === winnerClan
          ? { ...c, spacesCaptured: c.spacesCaptured + 1 }
          : c
      ),
      lastUpdated: new Date().toISOString(),
    })),

  setWsConnected: (connected: boolean) =>
    set({ wsConnected: connected }),

  refreshScores: async () => {
    try {
      const result = await scoresApi.getClanScores();
      if (result.success && result.data?.clans) {
        set({
          clans: result.data.clans,
          lastUpdated: new Date().toISOString(),
          isLoading: false,
          error: null,
          initialFetchDone: true,
        });
      }
    } catch {
      const state = get();
      if (state.clans.length === 0) {
        set({ error: 'Could not load scores. Check your connection.', isLoading: false });
      } else {
        ToastAndroid.show(
          "Couldn't refresh scores. Check your connection.",
          ToastAndroid.SHORT,
        );
      }
    }
  },
}));
