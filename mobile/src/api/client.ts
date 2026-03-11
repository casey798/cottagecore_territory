import Keychain from 'react-native-keychain';
import { BASE_URL } from '@/constants/api';
import { ApiResponse } from '@/types';
import { refreshFirebaseToken } from './auth';

const TOKEN_SERVICE = 'grovewars-auth';

export async function getStoredTokens(): Promise<{
  token: string;
  refreshToken: string;
} | null> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: TOKEN_SERVICE,
    });
    if (credentials) {
      const parsed = JSON.parse(credentials.password);
      return { token: parsed.token, refreshToken: parsed.refreshToken || '' };
    }
    return null;
  } catch {
    return null;
  }
}

export async function storeTokens(
  token: string,
  refreshToken: string,
): Promise<void> {
  await Keychain.setGenericPassword(
    'auth',
    JSON.stringify({ token, refreshToken }),
    { service: TOKEN_SERVICE },
  );
}

export async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  // Read token from the Zustand auth store first (always up-to-date in memory),
  // then fall back to Keychain for cases where the store hasn't loaded yet.
  const { useAuthStore } = require('@/store/useAuthStore');
  const storeToken: string | null = useAuthStore.getState().token;
  let token = storeToken;
  if (!token) {
    const stored = await getStoredTokens();
    token = stored?.token ?? null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = token;
  }

  try {
    console.log(`[apiRequest] ${options.method || 'GET'} ${endpoint} | token: ${token ? token.substring(0, 20) + '...' : 'NONE'}`);
    let response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && token) {
      // Try refreshing the Firebase ID token
      const newToken = await refreshFirebaseToken();
      if (newToken) {
        headers.Authorization = newToken;
        // Update stored token
        await storeTokens(newToken, '');
        useAuthStore.setState({ token: newToken });
        response = await fetch(`${BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
      } else {
        await clearTokens();
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Session expired' },
        };
      }
    }

    const result: ApiResponse<T> = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message:
          error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }
}
