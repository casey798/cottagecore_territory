import { create } from 'zustand';
import { AffineMatrix, Location, CapturedSpace, MapConfig } from '@/types';
import * as mapApi from '@/api/map';
import * as spacesApi from '@/api/spaces';
import { useAuthStore } from '@/store/useAuthStore';

interface PlayerPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface MapState {
  mapConfig: MapConfig | null;
  todayLocations: Location[];
  capturedSpaces: CapturedSpace[];
  playerPosition: PlayerPosition | null;
  loadMapConfig: () => Promise<void>;
  loadTodayLocations: () => Promise<void>;
  loadCapturedSpaces: () => Promise<void>;
  updatePlayerPosition: (position: PlayerPosition) => void;
}

export const useMapStore = create<MapState>((set) => ({
  mapConfig: null,
  todayLocations: [],
  capturedSpaces: [],
  playerPosition: null,

  loadMapConfig: async () => {
    try {
      console.log('[MapStore] loadMapConfig: fetching...');
      const result = await mapApi.getMapConfig();
      console.log('[MapStore] getMapConfig result:', JSON.stringify(result));
      if (result.success && result.data) {
        console.log('[MapStore] mapImageUrl:', result.data.mapImageUrl);
        set({ mapConfig: result.data });
      } else if (result.error?.code === 'UNAUTHORIZED') {
        console.warn('[MapStore] loadMapConfig: UNAUTHORIZED, logging out');
        useAuthStore.getState().logout();
      } else {
        console.warn('[MapStore] loadMapConfig: API returned error:', result.error?.code, result.error?.message);
      }
    } catch (err) {
      console.warn('[MapStore] loadMapConfig exception:', err);
    }
  },

  loadTodayLocations: async () => {
    const result = await mapApi.getTodayLocations();
    console.log('[locations/today] response:', JSON.stringify(result, null, 2));
    if (result.success && result.data) {
      set({ todayLocations: result.data.locations ?? [] });
    } else {
      console.warn('[locations/today] failed:', result.error?.code, result.error?.message);
    }
  },

  loadCapturedSpaces: async () => {
    const result = await spacesApi.getCapturedSpaces();
    if (result.success && result.data) {
      set({ capturedSpaces: result.data.spaces ?? [] });
    }
  },

  updatePlayerPosition: (position: PlayerPosition) =>
    set({ playerPosition: position }),
}));
