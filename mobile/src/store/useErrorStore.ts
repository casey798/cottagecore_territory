import { create } from 'zustand';

interface ErrorState {
  message: string | null;
  code: string | null;
  showError: (message: string, code?: string) => void;
  clearError: () => void;
}

export const useErrorStore = create<ErrorState>((set) => ({
  message: null,
  code: null,
  showError: (message, code) => set({ message, code: code ?? null }),
  clearError: () => set({ message: null, code: null }),
}));
