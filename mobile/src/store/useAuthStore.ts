import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClanId } from '@/types';
import * as authApi from '@/api/auth';
import * as playerApi from '@/api/player';
import { storeTokens, clearTokens, getStoredTokens } from '@/api/client';
import { DEV_CONFIG } from '@/constants/config';
import { apiRequest } from '@/api/client';
import { ENDPOINTS } from '@/constants/api';
import { useGameStore } from '@/store/useGameStore';
import { useMapStore } from '@/store/useMapStore';

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
  clan: ClanId | null;
  email: string | null;
  playerCode: string | null;
  displayName: string | null;
  selectedPresetId: number | null;
  tutorialDone: boolean;
  tutorialSkipped: boolean;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  googleSignIn: () => Promise<{ success: boolean; errorCode?: string; errorMessage?: string }>;
  logout: () => Promise<void>;
  setClan: (clan: ClanId) => Promise<boolean>;
  refreshSession: () => Promise<boolean>;
  setTutorialDone: () => void;
  setTutorialSkipped: () => void;
  setSelectedPresetId: (id: number) => void;
  restoreSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      token: null,
      clan: null,
      email: null,
      playerCode: null,
      displayName: null,
      selectedPresetId: null,
      tutorialDone: false,
      tutorialSkipped: false,
      isAuthenticated: false,
      isHydrated: false,
      isLoading: false,

      googleSignIn: async () => {
        set({ isLoading: true });
        const result = await authApi.googleSignIn();
        if (result.success && result.data) {
          await storeTokens(result.data.token, '');
          set({
            userId: result.data.userId,
            token: result.data.token,
            clan: maybeOverrideClan(result.data.clan, null),
            email: null,
            tutorialDone: result.data.tutorialDone,
            isAuthenticated: true,
            isLoading: false,
          });

          // Warm up the Lambda authorizer by making a profile call.
          // This also fetches the latest user data (e.g. clan from roster).
          const profile = await playerApi.getProfile();
          if (profile.success && profile.data) {
            const profileEmail = profile.data.email ?? null;
            set({
              clan: maybeOverrideClan(profile.data.clan, profileEmail),
              email: profileEmail,
              playerCode: profile.data.playerCode ?? null,
              displayName: profile.data.displayName ?? null,
              tutorialDone: profile.data.tutorialDone,
            });
          }

          return { success: true };
        }
        set({ isLoading: false });
        return {
          success: false,
          errorCode: result.error?.code,
          errorMessage: result.error?.message,
        };
      },

      logout: async () => {
        await authApi.signOut();
        await clearTokens();
        set({
          userId: null,
          token: null,
          clan: null,
          email: null,
          playerCode: null,
          displayName: null,
          selectedPresetId: null,
          tutorialDone: false,
          tutorialSkipped: false,
          isAuthenticated: false,
          isLoading: false,
        });
        useGameStore.getState().reset();
        useMapStore.getState().reset();
      },

      setClan: async (clan: ClanId) => {
        const result = await apiRequest<{ clan: ClanId }>(
          ENDPOINTS.PLAYER_CLAN,
          {
            method: 'PUT',
            body: JSON.stringify({ clan }),
          }
        );
        if (result.success) {
          set({ clan });
          return true;
        }
        return false;
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
            clan: maybeOverrideClan(result.data.clan, currentEmail),
            playerCode: result.data.playerCode ?? null,
            displayName: result.data.displayName ?? null,
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

      setTutorialSkipped: () => {
        set({ tutorialSkipped: true });
      },

      setSelectedPresetId: (id: number) => {
        set({ selectedPresetId: id });
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
            clan: maybeOverrideClan(result.data.clan, restoredEmail),
            email: restoredEmail,
            playerCode: result.data.playerCode ?? null,
            displayName: result.data.displayName ?? null,
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
        clan: state.clan,
        tutorialDone: state.tutorialDone,
        tutorialSkipped: state.tutorialSkipped,
        email: state.email,
        playerCode: state.playerCode,
        displayName: state.displayName,
        selectedPresetId: state.selectedPresetId,
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
