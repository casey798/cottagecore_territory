import Keychain from 'react-native-keychain';
import { CognitoUserPool, CognitoUser, CognitoRefreshToken } from 'amazon-cognito-identity-js';
import { BASE_URL, USER_POOL_ID, USER_POOL_CLIENT_ID } from '@/constants/api';
import { ApiResponse } from '@/types';

const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: USER_POOL_CLIENT_ID,
});

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
      return { token: parsed.token, refreshToken: parsed.refreshToken };
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

async function refreshAccessToken(): Promise<string | null> {
  const stored = await getStoredTokens();
  if (!stored?.refreshToken || !stored?.token) {
    return null;
  }

  try {
    // Decode the JWT to get the username for Cognito
    const payload = JSON.parse(atob(stored.token.split('.')[1]));
    const username = payload.email || payload.sub;
    if (!username) return null;

    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    const refreshToken = new CognitoRefreshToken({
      RefreshToken: stored.refreshToken,
    });

    return new Promise((resolve) => {
      cognitoUser.refreshSession(refreshToken, async (err, session) => {
        if (err || !session) {
          resolve(null);
          return;
        }
        const newToken = session.getIdToken().getJwtToken();
        const newRefreshToken = session.getRefreshToken().getToken();
        await storeTokens(newToken, newRefreshToken);
        resolve(newToken);
      });
    });
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const stored = await getStoredTokens();
  const token = stored?.token;

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
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers.Authorization = newToken;
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
