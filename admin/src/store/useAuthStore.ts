import { create } from 'zustand';
import { queryClient } from '@/api/queryClient';

const STORAGE_KEY = 'grove-wars-admin-token';

interface AuthState {
  token: string | null;
  email: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (token: string, email: string) => void;
  logout: () => void;
  clearError: () => void;
  setError: (error: string) => void;
  setLoading: (loading: boolean) => void;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1];
  const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(json);
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token);
    const exp = payload.exp as number;
    return exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function loadPersistedAuth(): Pick<AuthState, 'token' | 'email' | 'isAuthenticated'> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const { token, email } = JSON.parse(stored);
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { token, email, isAuthenticated: true };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

const persisted = loadPersistedAuth();

export const useAuthStore = create<AuthState>((set) => ({
  token: persisted?.token ?? null,
  email: persisted?.email ?? null,
  isAuthenticated: persisted?.isAuthenticated ?? false,
  isLoading: false,
  error: null,

  login: (token: string, email: string) => {
    if (isTokenExpired(token)) {
      set({ token: null, email: null, isAuthenticated: false, isLoading: false, error: 'Session expired — please sign in again' });
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, email }));
    set({ token, email, isAuthenticated: true, isLoading: false, error: null });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    queryClient.clear();
    set({ token: null, email: null, isAuthenticated: false, error: null });
  },

  clearError: () => set({ error: null }),
  setError: (error: string) => set({ error, isLoading: false }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
