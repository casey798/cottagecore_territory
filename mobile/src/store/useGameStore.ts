import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScanQRResponse, GameResult, DailyInfo, Location } from '@/types';
import { XP_PER_WIN } from '@/constants/config';
import { getTodayISTString } from '@/utils/time';

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
  xpEarnedAtLocations: Record<string, boolean>;
  xpEarnedDate: string | null;
  lastResetDate: string | null;
  resetSeq: number;
  celebrationPending: boolean;
  pendingCelebrationClan: string | null;
  pendingCelebrationSpace: string | null;
  lastSeenCelebrationDate: string | null;
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
  markXpEarnedAtLocation: (locationId: string) => void;
  patchLastScanResult: (patch: Partial<ScanQRResponse>) => void;
  setResetSeq: (seq: number) => void;
  setCelebrationPending: (clan: string, spaceName: string) => void;
  clearCelebration: () => void;
  quietMode: boolean;
  setQuietMode: (v: boolean) => void;
  activeLocationSessionId: string | null;
  activeLocationSessionStart: string | null;
  setActiveLocationSession: (sessionId: string) => void;
  clearActiveLocationSession: () => void;
  resetDaily: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      todayXp: 0,
      currentSessionId: null,
      lastScanResult: null,
      captureResult: null,
      selectedLocationId: null,
      todayLocations: [],
      dailyInfo: null,
      xpEarnedAtLocations: {},
      xpEarnedDate: null,
      lastResetDate: getTodayISTString(),
      resetSeq: 0,
      celebrationPending: false,
      pendingCelebrationClan: null,
      pendingCelebrationSpace: null,
      lastSeenCelebrationDate: null,
      quietMode: false,
      activeLocationSessionId: null,
      activeLocationSessionStart: null,

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
          xpEarnedAtLocations: xp === 0 ? {} : state.xpEarnedAtLocations,
          xpEarnedDate: xp === 0 ? null : state.xpEarnedDate,
        })),

      setCaptureResult: (result: CaptureResult | null) =>
        set({ captureResult: result }),

      setSelectedLocation: (locationId: string | null) =>
        set({ selectedLocationId: locationId }),

      setTodayLocations: (locations: Location[]) =>
        set({ todayLocations: locations }),

      setDailyInfo: (info: DailyInfo) =>
        set({ dailyInfo: info }),

      markXpEarnedAtLocation: (locationId: string) =>
        set((state) => ({
          xpEarnedAtLocations: {
            ...state.xpEarnedAtLocations,
            [locationId]: true,
          },
          xpEarnedDate: getTodayISTString(),
        })),

      patchLastScanResult: (patch: Partial<ScanQRResponse>) =>
        set((state) => {
          if (!state.lastScanResult) return {};
          return { lastScanResult: { ...state.lastScanResult, ...patch } };
        }),

      setResetSeq: (seq: number) => set({ resetSeq: seq }),

      setCelebrationPending: (clan: string, spaceName: string) =>
        set({
          celebrationPending: true,
          pendingCelebrationClan: clan,
          pendingCelebrationSpace: spaceName,
        }),

      clearCelebration: () =>
        set({
          celebrationPending: false,
          pendingCelebrationClan: null,
          pendingCelebrationSpace: null,
          lastSeenCelebrationDate: getTodayISTString(),
        }),

      setQuietMode: (v: boolean) => set({ quietMode: v }),

      setActiveLocationSession: (sessionId: string) =>
        set({
          activeLocationSessionId: sessionId,
          activeLocationSessionStart: new Date().toISOString(),
        }),

      clearActiveLocationSession: () =>
        set({
          activeLocationSessionId: null,
          activeLocationSessionStart: null,
        }),

      resetDaily: () =>
        set({
          todayXp: 0,
          xpEarnedAtLocations: {},
          xpEarnedDate: null,
          currentSessionId: null,
          lastScanResult: null,
          dailyInfo: null,
          lastResetDate: getTodayISTString(),
          resetSeq: 0,
          activeLocationSessionId: null,
          activeLocationSessionStart: null,
        }),
    }),
    {
      name: 'grove-wars-game',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        todayXp: state.todayXp,
        xpEarnedAtLocations: state.xpEarnedAtLocations,
        xpEarnedDate: state.xpEarnedDate,
        lastResetDate: state.lastResetDate,
        resetSeq: state.resetSeq,
        celebrationPending: state.celebrationPending,
        pendingCelebrationClan: state.pendingCelebrationClan,
        pendingCelebrationSpace: state.pendingCelebrationSpace,
        lastSeenCelebrationDate: state.lastSeenCelebrationDate,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return;
          const today = getTodayISTString();
          // Wipe stale xpEarnedAtLocations from a previous day
          if (state.xpEarnedDate && state.xpEarnedDate !== today) {
            useGameStore.setState({
              xpEarnedAtLocations: {},
              xpEarnedDate: null,
            });
          }
          // Wipe all daily state if lastResetDate is stale
          if (state.lastResetDate && state.lastResetDate !== today) {
            useGameStore.setState({
              todayXp: 0,
              xpEarnedAtLocations: {},
              xpEarnedDate: null,
              lastResetDate: today,
            });
          }
        };
      },
    },
  ),
);
