import { create } from 'zustand';
import { USER_POOL_CLIENT_ID, REGION } from '@/constants/api';

const COGNITO_URL = `https://cognito-idp.${REGION}.amazonaws.com/`;
const STORAGE_KEY = 'grove-wars-admin-token';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  email: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  session: string | null;
  initiateAuth: (email: string) => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  refreshSession: () => Promise<string | null>;
  logout: () => void;
  clearError: () => void;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1];
  const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(json);
}

function loadPersistedAuth(): Pick<AuthState, 'token' | 'refreshToken' | 'email' | 'isAdmin' | 'isAuthenticated'> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const { token, refreshToken, email } = JSON.parse(stored);
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    const exp = payload.exp as number;
    if (exp * 1000 < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const groups = (payload['cognito:groups'] ?? []) as string[];
    const isAdmin = Array.isArray(groups) && groups.some((g) => g.toLowerCase() === 'admin');
    if (!isAdmin) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { token, refreshToken, email, isAdmin: true, isAuthenticated: true };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

const persisted = loadPersistedAuth();

async function cognitoRequest(action: string, body: Record<string, unknown>) {
  const res = await fetch(COGNITO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const message =
      (data as { message?: string }).message ||
      (data as { __type?: string }).__type ||
      'Authentication failed';
    throw new Error(message);
  }
  return data;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: persisted?.token ?? null,
  refreshToken: persisted?.refreshToken ?? null,
  email: persisted?.email ?? null,
  isAdmin: persisted?.isAdmin ?? false,
  isAuthenticated: persisted?.isAuthenticated ?? false,
  isLoading: false,
  error: null,
  session: null,

  initiateAuth: async (email: string) => {
    set({ isLoading: true, error: null });

    try {
      const data = await cognitoRequest('InitiateAuth', {
        AuthFlow: 'CUSTOM_AUTH',
        ClientId: USER_POOL_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
        },
      });

      const session = (data as { Session?: string }).Session;
      if (!session) {
        throw new Error('No session returned from auth initiation');
      }

      set({ isLoading: false, email, session });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
      throw err;
    }
  },

  verifyCode: async (code: string) => {
    const { email, session } = get();
    if (!email || !session) {
      set({ error: 'No auth session. Please restart login.' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const data = await cognitoRequest('RespondToAuthChallenge', {
        ClientId: USER_POOL_CLIENT_ID,
        ChallengeName: 'CUSTOM_CHALLENGE',
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          ANSWER: code,
        },
      });

      const authResult = (data as {
        AuthenticationResult?: {
          IdToken: string;
          AccessToken: string;
          RefreshToken: string;
        };
      }).AuthenticationResult;

      if (!authResult) {
        throw new Error('Invalid verification code');
      }

      const idPayload = decodeJwtPayload(authResult.IdToken);
      const groups = idPayload['cognito:groups'] ?? [];
      const isAdmin = Array.isArray(groups) && groups.some((g: string) => g.toLowerCase() === 'admin');

      if (!isAdmin) {
        set({
          isLoading: false,
          error: 'Not authorized. You must be in the admin group.',
          isAuthenticated: false,
          session: null,
        });
        throw new Error('Not authorized');
      }

      const resolvedEmail = (idPayload.email as string) || email;

      // Persist auth to localStorage
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          token: authResult.IdToken,
          refreshToken: authResult.RefreshToken,
          email: resolvedEmail,
        }),
      );

      // Use ID token (not access token) — backend checks cognito:groups which is only in the ID token
      set({
        token: authResult.IdToken,
        refreshToken: authResult.RefreshToken,
        isAdmin: true,
        isAuthenticated: true,
        isLoading: false,
        email: resolvedEmail,
        session: null,
      });
    } catch (err) {
      const message = (err as Error).message;
      if (!get().error) {
        set({ isLoading: false, error: message });
      }
      throw err;
    }
  },

  refreshSession: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return null;

    try {
      const data = await cognitoRequest('InitiateAuth', {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: USER_POOL_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const authResult = (data as {
        AuthenticationResult?: { IdToken: string; AccessToken: string };
      }).AuthenticationResult;

      if (!authResult) {
        get().logout();
        return null;
      }

      // Use ID token for API calls — backend checks cognito:groups in ID token
      const newToken = authResult.IdToken;
      set({ token: newToken });

      // Update persisted token
      const currentEmail = get().email;
      const currentRefresh = get().refreshToken;
      if (currentEmail && currentRefresh) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            token: newToken,
            refreshToken: currentRefresh,
            email: currentEmail,
          }),
        );
      }

      return newToken;
    } catch {
      get().logout();
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      token: null,
      refreshToken: null,
      email: null,
      isAdmin: false,
      isAuthenticated: false,
      session: null,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
