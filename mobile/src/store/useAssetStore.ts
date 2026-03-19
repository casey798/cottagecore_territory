import { create } from 'zustand';

interface AssetStoreState {
  unplacedCount: number;
  setUnplacedCount: (count: number) => void;
}

export const useAssetStore = create<AssetStoreState>()((set) => ({
  unplacedCount: 0,
  setUnplacedCount: (count) => set({ unplacedCount: count }),
}));
