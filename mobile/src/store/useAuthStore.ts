import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClanId } from '@/types';
import * as authApi from '@/api/auth';
import * as playerApi from '@/api/player';
import { storeTokens, clearTokens, getStoredTokens } from '@/api/client';
import { DEV_CONFIG } from '@/constants/config';

function maybeOverrideClan(clan: ClanId | null, email: string | null): ClanId | null {
  if (
    DEV_CONFIG.enabled &&
    DEV_CONFIG.forceClan &&
    email &&
    email.toLowerCase() === DEV_CONFIG.forceClanEmail.toLowerCase()
  ) {
    console.warn(`[DEV] Clan overridden to ${DEV_CONFIG.forceClan} for test account`);
    return DEV_CONFIG.forceClan as ClanId;
  }
  return clan;
}

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
            clan: maybeOverrideClan(result.data.clan, email),
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
          const currentEmail = useAuthStore.getState().email;
          set({
            userId: result.data.userId,
            token: stored.token,
            refreshToken: stored.refreshToken,
            clan: maybeOverrideClan(result.data.clan, currentEmail),
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
          const restoredEmail = result.data.email ?? null;
          set({
            userId: result.data.userId,
            token: stored.token,
            refreshToken: stored.refreshToken,
            clan: maybeOverrideClan(result.data.clan, restoredEmail),
            email: restoredEmail,
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
