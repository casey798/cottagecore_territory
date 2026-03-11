import { create } from 'zustand';
import { ScanQRResponse, GameResult, DailyInfo, Location } from '@/types';
import { XP_PER_WIN } from '@/constants/config';

interface CaptureResult {
  winnerClan: string;
  spaceName: string;
}

interface GameState {
  todayXp: number;
  currentSessionId: string | null;
  lastScanResult: ScanQRResponse | null;
  captureResult: CaptureResult | null;
  selectedLocationId: string | null;
  todayLocations: Location[];
  dailyInfo: DailyInfo | null;
  completedMinigamesAtLocation: Record<string, string[]>;
  xpEarnedAtLocations: Record<string, boolean>;
  recordWin: () => void;
  recordLoss: () => void;
  clearSession: () => void;
  setSessionId: (id: string) => void;
  setScanResult: (result: ScanQRResponse) => void;
  setTodayXp: (xp: number) => void;
  setCaptureResult: (result: CaptureResult | null) => void;
  setSelectedLocation: (locationId: string | null) => void;
  setTodayLocations: (locations: Location[]) => void;
  setDailyInfo: (info: DailyInfo) => void;
  markMinigameCompleted: (locationId: string, minigameId: string) => void;
  markXpEarnedAtLocation: (locationId: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
  todayXp: 0,
  currentSessionId: null,
  lastScanResult: null,
  captureResult: null,
  selectedLocationId: null,
  todayLocations: [],
  dailyInfo: null,
  completedMinigamesAtLocation: {},
  xpEarnedAtLocations: {},

  recordWin: () =>
    set((state) => ({ todayXp: state.todayXp + XP_PER_WIN })),

  recordLoss: () => set({}),

  clearSession: () =>
    set({ currentSessionId: null, lastScanResult: null }),

  setSessionId: (id: string) => set({ currentSessionId: id }),

  setScanResult: (result: ScanQRResponse) =>
    set({ lastScanResult: result }),

  setTodayXp: (xp: number) =>
    set((state) => ({
      todayXp: xp,
      // Reset completed minigames and xp tracking on daily reset
      completedMinigamesAtLocation: xp === 0 ? {} : state.completedMinigamesAtLocation,
      xpEarnedAtLocations: xp === 0 ? {} : state.xpEarnedAtLocations,
    })),

  setCaptureResult: (result: CaptureResult | null) =>
    set({ captureResult: result }),

  setSelectedLocation: (locationId: string | null) =>
    set({ selectedLocationId: locationId }),

  setTodayLocations: (locations: Location[]) =>
    set({ todayLocations: locations }),

  setDailyInfo: (info: DailyInfo) =>
    set({ dailyInfo: info }),

  markMinigameCompleted: (locationId: string, minigameId: string) =>
    set((state) => {
      const existing = state.completedMinigamesAtLocation[locationId] || [];
      if (existing.includes(minigameId)) return state;
      return {
        completedMinigamesAtLocation: {
          ...state.completedMinigamesAtLocation,
          [locationId]: [...existing, minigameId],
        },
      };
    }),

  markXpEarnedAtLocation: (locationId: string) =>
    set((state) => ({
      xpEarnedAtLocations: {
        ...state.xpEarnedAtLocations,
        [locationId]: true,
      },
    })),
}));
