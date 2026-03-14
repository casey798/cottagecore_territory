import { create } from 'zustand';
import { ClanScore } from '@/types';

const DEV_SEED_CLANS: ClanScore[] = __DEV__
  ? [
      { clanId: 'ember', todayXp: 875, seasonXp: 8750, spacesCaptured: 5 },
      { clanId: 'tide', todayXp: 1100, seasonXp: 9200, spacesCaptured: 6 },
      { clanId: 'bloom', todayXp: 650, seasonXp: 7800, spacesCaptured: 2 },
      { clanId: 'gale', todayXp: 950, seasonXp: 8100, spacesCaptured: 4 },
      { clanId: 'hearth', todayXp: 400, seasonXp: 3200, spacesCaptured: 1 },
    ]
  : [];

interface ClanState {
  clans: ClanScore[];
  lastUpdated: string | null;
  wsConnected: boolean;
  setClans: (clans: ClanScore[]) => void;
  updateClanXp: (clanId: string, newXp: number) => void;
  setCaptureResult: (winnerClan: string, spaceName: string) => void;
  setWsConnected: (connected: boolean) => void;
}

export const useClanStore = create<ClanState>((set) => ({
  clans: DEV_SEED_CLANS,
  lastUpdated: DEV_SEED_CLANS.length > 0 ? new Date().toISOString() : null,
  wsConnected: false,

  setClans: (clans: ClanScore[]) =>
    set({ clans, lastUpdated: new Date().toISOString() }),

  updateClanXp: (clanId: string, newXp: number) =>
    set((state) => ({
      clans: state.clans.map((c) =>
        c.clanId === clanId ? { ...c, todayXp: newXp } : c
      ),
      lastUpdated: new Date().toISOString(),
    })),

  setCaptureResult: (winnerClan: string, spaceName: string) =>
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
}));
