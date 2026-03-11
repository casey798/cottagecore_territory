import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from 'aws-lambda';
import { ensureFirebaseInitialized, getFirebaseAdmin } from '../../shared/firebase';

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken;

  if (!token) {
    throw new Error('Unauthorized');
  }

  try {
    const firebaseReady = await ensureFirebaseInitialized();
    if (!firebaseReady) {
      throw new Error('Unauthorized');
    }

    const admin = getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(token);

    const userId = decodedToken.uid;
    const email = decodedToken.email || '';

    return {
      principalId: userId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn.replace(
              /\/[^/]+\/[^/]+$/,
              '/*/*'
            ),
          },
        ],
      },
      context: {
        sub: userId,
        email,
      },
    };
  } catch (err) {
    console.error('Authorization failed:', err);
    throw new Error('Unauthorized');
  }
};
