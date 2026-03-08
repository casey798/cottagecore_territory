import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserSession,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';
import { USER_POOL_ID, USER_POOL_CLIENT_ID } from '@/constants/api';
import { ApiResponse, ClanId } from '@/types';
import { storeTokens } from './client';

const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: USER_POOL_CLIENT_ID,
});

interface AuthResult {
  userId: string;
  token: string;
  refreshToken: string;
  clan: ClanId;
  tutorialDone: boolean;
}

// Persists the CognitoUser between signup (initiateAuth) and verify (sendCustomChallengeAnswer)
let pendingCognitoUser: CognitoUser | null = null;

function extractAuthResult(
  session: CognitoUserSession,
): AuthResult {
  const token = session.getIdToken().getJwtToken();
  const refreshToken = session.getRefreshToken().getToken();
  const payload = session.getIdToken().decodePayload();
  return {
    userId: payload.sub as string,
    token,
    refreshToken,
    clan: (payload['custom:clan'] || 'ember') as ClanId,
    tutorialDone: payload['custom:tutorialDone'] === 'true',
  };
}

export function signup(email: string): Promise<ApiResponse<{ message: string }>> {
  return new Promise((resolve) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.initiateAuth(
      new AuthenticationDetails({
        Username: email,
      }),
      {
        onSuccess: () => {
          resolve({
            success: true,
            data: { message: `Verification code sent to ${email}` },
          });
        },
        onFailure: (err) => {
          const code = err.code === 'UserNotFoundException'
            ? 'NOT_IN_ROSTER'
            : 'AUTH_ERROR';
          resolve({
            success: false,
            error: { code, message: err.message },
          });
        },
        customChallenge: () => {
          // Store the user so verify() can call sendCustomChallengeAnswer on it
          pendingCognitoUser = cognitoUser;
          resolve({
            success: true,
            data: { message: `Verification code sent to ${email}` },
          });
        },
      },
    );
  });
}

export function verify(
  email: string,
  code: string,
): Promise<ApiResponse<AuthResult>> {
  return new Promise((resolve) => {
    // If we have a pending user from signup, answer the existing challenge
    if (pendingCognitoUser) {
      const user = pendingCognitoUser;
      user.sendCustomChallengeAnswer(code, {
        onSuccess: async (session) => {
          pendingCognitoUser = null;
          await storeTokens(
            session.getIdToken().getJwtToken(),
            session.getRefreshToken().getToken(),
          );
          resolve({ success: true, data: extractAuthResult(session) });
        },
        onFailure: (err) => {
          resolve({
            success: false,
            error: { code: 'INVALID_CODE', message: err.message },
          });
        },
        customChallenge: () => {
          // Cognito said wrong answer, is issuing another challenge (same session)
          // The user can retry — pendingCognitoUser stays set
          resolve({
            success: false,
            error: { code: 'INVALID_CODE', message: 'Incorrect code. Please try again.' },
          });
        },
      });
      return;
    }

    // No pending user (e.g. app restarted) — start fresh auth flow
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.initiateAuth(
      new AuthenticationDetails({ Username: email }),
      {
        onSuccess: async (session) => {
          await storeTokens(
            session.getIdToken().getJwtToken(),
            session.getRefreshToken().getToken(),
          );
          resolve({ success: true, data: extractAuthResult(session) });
        },
        onFailure: (err) => {
          resolve({
            success: false,
            error: { code: 'INVALID_CODE', message: err.message },
          });
        },
        customChallenge: () => {
          // Fresh flow — need to answer the challenge
          pendingCognitoUser = cognitoUser;
          cognitoUser.sendCustomChallengeAnswer(code, {
            onSuccess: async (session) => {
              pendingCognitoUser = null;
              await storeTokens(
                session.getIdToken().getJwtToken(),
                session.getRefreshToken().getToken(),
              );
              resolve({ success: true, data: extractAuthResult(session) });
            },
            onFailure: (err) => {
              resolve({
                success: false,
                error: { code: 'INVALID_CODE', message: err.message },
              });
            },
            customChallenge: () => {
              resolve({
                success: false,
                error: { code: 'INVALID_CODE', message: 'Incorrect code. Please try again.' },
              });
            },
          });
        },
      },
    );
  });
}

export function login(
  email: string,
  code: string,
): Promise<ApiResponse<AuthResult>> {
  return verify(email, code);
}
