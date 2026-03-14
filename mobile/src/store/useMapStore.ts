import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FastImage from 'react-native-fast-image';
import type { SkImage } from '@shopify/react-native-skia';
import { AffineMatrix, Location, CapturedSpace, MapConfig } from '@/types';
import * as mapApi from '@/api/map';
import * as spacesApi from '@/api/spaces';
import { useAuthStore } from '@/store/useAuthStore';
import { getTodayISTString } from '@/utils/time';

/** Extract the S3 object key (path without query params) from a pre-signed URL */
function extractUrlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

interface PlayerPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface MapState {
  mapConfig: MapConfig | null;
  mapImageVersion: string | null;
  todayLocations: Location[];
  capturedSpaces: CapturedSpace[];
  playerPosition: PlayerPosition | null;
  skiaMapImage: SkImage | null;
  lockedLocationIds: string[];
  locksDate: string | null;
  setSkiaMapImage: (image: SkImage | null) => void;
  loadMapConfig: () => Promise<void>;
  loadTodayLocations: () => Promise<void>;
  loadCapturedSpaces: () => Promise<void>;
  updatePlayerPosition: (position: PlayerPosition) => void;
  lockLocation: (locationId: string) => void;
  clearLockedFlags: () => void;
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
  mapConfig: null,
  mapImageVersion: null,
  todayLocations: [],
  capturedSpaces: [],
  skiaMapImage: null,
  playerPosition: null,
  lockedLocationIds: [],
  locksDate: null,

  setSkiaMapImage: (image: SkImage | null) => set({ skiaMapImage: image }),

  loadMapConfig: async () => {
    try {
      console.log('[MapStore] loadMapConfig: fetching...');
      const result = await mapApi.getMapConfig();
      console.log('[MapStore] getMapConfig result:', JSON.stringify(result));
      if (result.success && result.data) {
        const newUrl = result.data.mapImageUrl;
        const newVersion = extractUrlPath(newUrl);
        const oldVersion = get().mapImageVersion;

        // If the underlying map image changed (different S3 key), clear FastImage cache
        if (oldVersion && oldVersion !== newVersion) {
          console.log('[MapStore] Map image changed, clearing FastImage cache');
          await FastImage.clearDiskCache();
          await FastImage.clearMemoryCache();
        }

        console.log('[MapStore] mapImageUrl:', newUrl);
        set({ mapConfig: result.data, mapImageVersion: newVersion });
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
      const { lockedLocationIds } = get();
      const locations = (result.data.locations ?? []).map((loc) =>
        lockedLocationIds.includes(loc.locationId) ? { ...loc, locked: true } : loc,
      );
      set({ todayLocations: locations });
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

  lockLocation: (locationId: string) =>
    set((state) => ({
      todayLocations: state.todayLocations.map((loc) =>
        loc.locationId === locationId ? { ...loc, locked: true } : loc,
      ),
      lockedLocationIds: state.lockedLocationIds.includes(locationId)
        ? state.lockedLocationIds
        : [...state.lockedLocationIds, locationId],
      locksDate: getTodayISTString(),
    })),

  clearLockedFlags: () =>
    set((state) => ({
      todayLocations: state.todayLocations.map((loc) =>
        loc.locked ? { ...loc, locked: false } : loc,
      ),
      lockedLocationIds: [],
      locksDate: null,
    })),
    }),
    {
      name: 'grove-wars-map',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lockedLocationIds: state.lockedLocationIds,
        locksDate: state.locksDate,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return;
          const today = getTodayISTString();
          if (state.locksDate && state.locksDate !== today) {
            useMapStore.setState({
              lockedLocationIds: [],
              locksDate: null,
            });
          }
        };
      },
    },
  ),
);
