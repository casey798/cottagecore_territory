import { create } from 'zustand';

interface DebugStore {
  debugLocation: { latitude: number; longitude: number } | null;
  isDebugMode: boolean;
  tapToSetMode: boolean;
  showAllMinigames: boolean;
  setDebugLocation: (latitude: number, longitude: number) => void;
  clearDebugLocation: () => void;
  toggleDebugMode: () => void;
  toggleTapToSetMode: () => void;
  setShowAllMinigames: (value: boolean) => void;
}

export const useDebugStore = create<DebugStore>((set) => ({
  debugLocation: null,
  isDebugMode: false,
  tapToSetMode: false,
  showAllMinigames: false,
  setDebugLocation: (latitude, longitude) => {
    if (!__DEV__) return;
    set({ debugLocation: { latitude, longitude }, isDebugMode: true, tapToSetMode: false });
  },
  clearDebugLocation: () => {
    if (!__DEV__) return;
    set({ debugLocation: null, isDebugMode: false });
  },
  toggleDebugMode: () => {
    if (!__DEV__) return;
    set((s) => ({
      isDebugMode: !s.isDebugMode,
      debugLocation: s.isDebugMode ? null : s.debugLocation,
    }));
  },
  toggleTapToSetMode: () => {
    if (!__DEV__) return;
    set({ tapToSetMode: true, isDebugMode: true });
  },
  setShowAllMinigames: (value) => {
    if (!__DEV__) return;
    set({ showAllMinigames: value });
  },
}));
