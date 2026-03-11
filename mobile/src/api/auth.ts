import { getAuth, signInWithCredential, signOut as firebaseSignOut, GoogleAuthProvider } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { BASE_URL, ENDPOINTS } from '@/constants/api';
import { ApiResponse, ClanId } from '@/types';

const GOOGLE_WEB_CLIENT_ID =
  '425457815141-c7qp4l9sjkn5fgcv9t3odnu83j4nd3nh.apps.googleusercontent.com';

let googleSignInConfigured = false;

export function configureGoogleSignIn(): void {
  if (googleSignInConfigured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
  googleSignInConfigured = true;
}

export interface AuthResult {
  userId: string;
  token: string;
  clan: ClanId | null;
  tutorialDone: boolean;
}

export async function googleSignIn(): Promise<ApiResponse<AuthResult>> {
  try {
    // Ensure configured (idempotent)
    configureGoogleSignIn();

    // Sign out first to force account picker
    try { await GoogleSignin.signOut(); } catch { /* ok */ }

    // Sign in with Google
    await GoogleSignin.hasPlayServices();
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken;

    if (!idToken) {
      return {
        success: false,
        error: { code: 'AUTH_ERROR', message: 'Failed to get Google ID token' },
      };
    }

    // Sign in to Firebase with the Google credential
    const googleCredential = GoogleAuthProvider.credential(idToken);
    const firebaseAuth = getAuth();
    await signInWithCredential(firebaseAuth, googleCredential);

    // Get the Firebase ID token
    const firebaseUser = firebaseAuth.currentUser;
    if (!firebaseUser) {
      return {
        success: false,
        error: { code: 'AUTH_ERROR', message: 'Firebase sign-in failed' },
      };
    }

    const firebaseIdToken = await firebaseUser.getIdToken();

    // Send Firebase ID token to backend
    const response = await fetch(`${BASE_URL}${ENDPOINTS.AUTH_GOOGLE_LOGIN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: firebaseIdToken }),
    });

    const result: ApiResponse<AuthResult> = await response.json();
    return result;
  } catch (err) {
    const error = err as { code?: string; message?: string };

    if (error.code === 'SIGN_IN_CANCELLED') {
      return {
        success: false,
        error: { code: 'CANCELLED', message: 'Sign-in was cancelled' },
      };
    }

    return {
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: error.message || 'Google sign-in failed',
      },
    };
  }
}

export async function signOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Google sign out may fail if not signed in
  }
  try {
    await firebaseSignOut(getAuth());
  } catch {
    // Firebase sign out may fail if not signed in
  }
}

export async function refreshFirebaseToken(): Promise<string | null> {
  try {
    const user = getAuth().currentUser;
    if (!user) return null;
    return await user.getIdToken(true);
  } catch {
    return null;
  }
}
