import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from 'aws-lambda';
import { OAuth2Client } from 'google-auth-library';
import { ensureFirebaseInitialized, getFirebaseAdmin } from '../../shared/firebase';

const ADMIN_EMAILS: string[] = [
  'karthikrajak@student.tce.edu',
];

const GOOGLE_CLIENT_ID =
  '425457815141-c7qp4l9sjkn5fgcv9t3odnu83j4nd3nh.apps.googleusercontent.com';

const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function buildPolicy(
  principalId: string,
  methodArn: string,
  context: Record<string, string>,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: methodArn.split('/').slice(0, 2).join('/') + '/*',
        },
      ],
    },
    context,
  };
}

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  const rawToken = event.authorizationToken;

  if (!rawToken) {
    throw new Error('Unauthorized');
  }

  // Strip "Bearer " prefix if present
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;

  // Try Firebase first (mobile app tokens)
  try {
    const firebaseReady = await ensureFirebaseInitialized();
    if (firebaseReady) {
      const admin = getFirebaseAdmin();
      const decodedToken = await admin.auth().verifyIdToken(token);

      const userId = decodedToken.uid;
      const email = decodedToken.email || '';
      const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

      return buildPolicy(userId, event.methodArn, {
        sub: userId,
        email,
        isAdmin: isAdmin ? 'true' : 'false',
      });
    }
  } catch {
    // Firebase verification failed, try Google OAuth below
  }

  // Try Google OAuth (admin dashboard tokens)
  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      throw new Error('Unauthorized');
    }

    const emailLower = payload.email.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(emailLower);
    return buildPolicy(payload.sub, event.methodArn, {
      sub: payload.sub,
      email: payload.email,
      isAdmin: isAdmin ? 'true' : 'false',
    });
  } catch (err) {
    console.error('Authorization failed (both Firebase and Google OAuth):', err);
    throw new Error('Unauthorized');
  }
};
