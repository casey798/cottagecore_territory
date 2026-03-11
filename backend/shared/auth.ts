import { APIGatewayProxyEvent } from 'aws-lambda';
import { ensureFirebaseInitialized, getFirebaseAdmin } from './firebase';

export interface FirebaseTokenPayload {
  uid: string;
  email?: string;
}

export async function verifyToken(token: string): Promise<FirebaseTokenPayload> {
  const firebaseReady = await ensureFirebaseInitialized();
  if (!firebaseReady) {
    throw new Error('Firebase not initialized');
  }

  const admin = getFirebaseAdmin();
  const decoded = await admin.auth().verifyIdToken(token);

  return {
    uid: decoded.uid,
    email: decoded.email,
  };
}

export function extractUserId(event: APIGatewayProxyEvent): string {
  // Lambda authorizer puts context directly under event.requestContext.authorizer
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) {
    throw new Error('No authorization context found');
  }

  // Lambda authorizer context
  const sub = authorizer.sub as string | undefined;
  if (sub) return sub;

  // Fallback: Cognito authorizer format (claims.sub)
  const claims = authorizer.claims;
  if (claims?.sub) return claims.sub as string;

  throw new Error('No user ID found in authorization context');
}

export function isAdmin(event: APIGatewayProxyEvent): boolean {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) return false;

  // Check Lambda authorizer context
  if (authorizer.isAdmin === 'true') return true;

  // Fallback: Cognito format
  const claims = authorizer.claims;
  if (!claims) return false;
  const groups: string[] = (claims['cognito:groups'] as string || '').split(',').filter(Boolean);
  return groups.some((g: string) => g.toLowerCase() === 'admin');
}

export function extractClaims(event: APIGatewayProxyEvent): FirebaseTokenPayload {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer) {
    throw new Error('No authorization context found');
  }

  return {
    uid: (authorizer.sub || authorizer.claims?.sub) as string,
    email: (authorizer.email || authorizer.claims?.email) as string | undefined,
  };
}
