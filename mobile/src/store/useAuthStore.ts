import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClanId } from '@/types';
import * as authApi from '@/api/auth';
import * as playerApi from '@/api/player';
import { storeTokens, clearTokens, getStoredTokens } from '@/api/client';

interface AuthState {
  userId: string | null;
  token: string | null;
  refreshToken: string | null;
  clan: ClanId | null;
  email: string | null;
  tutorialDone: boolean;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  login: (email: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  setTutorialDone: () => void;
  restoreSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      token: null,
      refreshToken: null,
      clan: null,
      email: null,
      tutorialDone: false,
      isAuthenticated: false,
      isHydrated: false,
      isLoading: false,

      login: async (email: string, code: string) => {
        set({ isLoading: true });
        const result = await authApi.login(email, code);
        if (result.success && result.data) {
          await storeTokens(result.data.token, result.data.refreshToken);
          set({
            userId: result.data.userId,
            token: result.data.token,
            refreshToken: result.data.refreshToken,
            clan: result.data.clan,
            email,
            tutorialDone: result.data.tutorialDone,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        }
        set({ isLoading: false });
        return false;
      },

      logout: async () => {
        await clearTokens();
        set({
          userId: null,
          token: null,
          refreshToken: null,
          clan: null,
          email: null,
          tutorialDone: false,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      refreshSession: async () => {
        const stored = await getStoredTokens();
        if (!stored) return false;
        const result = await playerApi.getProfile();
        if (result.success && result.data) {
          set({
            userId: result.data.userId,
            token: stored.token,
            refreshToken: stored.refreshToken,
            clan: result.data.clan,
            tutorialDone: result.data.tutorialDone,
            isAuthenticated: true,
          });
          return true;
        }
        return false;
      },

      setTutorialDone: () => {
        set({ tutorialDone: true });
      },

      restoreSession: async () => {
        set({ isLoading: true });
        const stored = await getStoredTokens();
        if (!stored) {
          set({ isLoading: false });
          return false;
        }
        const result = await playerApi.getProfile();
        if (result.success && result.data) {
          set({
            userId: result.data.userId,
            token: stored.token,
            refreshToken: stored.refreshToken,
            clan: result.data.clan,
            email: result.data.email ?? null,
            tutorialDone: result.data.tutorialDone,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        }
        await clearTokens();
        set({ isLoading: false });
        return false;
      },
    }),
    {
      name: 'grove-wars-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        userId: state.userId,
        token: state.token,
        refreshToken: state.refreshToken,
        clan: state.clan,
        tutorialDone: state.tutorialDone,
        email: state.email,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        return () => {
          useAuthStore.setState({ isHydrated: true });
        };
      },
    },
  ),
);
