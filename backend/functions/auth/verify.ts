import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  RespondToAuthChallengeCommand,
  ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider';
import { verifySchema } from '../../shared/schemas';
import { getItem, query, putItem, deleteItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { User } from '../../shared/types';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || '';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { email, code } = parsed.data;

    // The session token should be passed from the client after signup/initiate
    const session = (body as Record<string, string>).session;
    if (!session) {
      return error(ErrorCode.VALIDATION_ERROR, 'Session token is required', 400);
    }

    // Respond to CUSTOM_CHALLENGE with the OTP code
    const challengeResponse = await cognito.send(
      new RespondToAuthChallengeCommand({
        ClientId: USER_POOL_CLIENT_ID,
        ChallengeName: ChallengeNameType.CUSTOM_CHALLENGE,
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          ANSWER: code,
        },
      })
    );

    if (!challengeResponse.AuthenticationResult) {
      return error(ErrorCode.INVALID_CODE, 'Invalid or expired verification code', 401);
    }

    const { IdToken, RefreshToken } = challengeResponse.AuthenticationResult;

    // Extract Cognito sub from the ID token
    const tokenPayload = JSON.parse(
      Buffer.from(IdToken!.split('.')[1], 'base64').toString()
    );
    const cognitoSub: string = tokenPayload.sub;
    console.log('[verify] Cognito sub:', cognitoSub);

    // Look up user in DB by email
    const { items } = await query<User>(
      'users',
      'email = :email',
      { ':email': email },
      { indexName: 'EmailIndex' }
    );

    let user = items[0];

    // Migrate userId to match Cognito sub if needed
    if (user && user.userId !== cognitoSub) {
      console.log(`[verify] Migrating userId: ${user.userId} -> ${cognitoSub}`);
      const oldUserId = user.userId;
      const migratedUser: User = { ...user, userId: cognitoSub };
      await putItem<Record<string, unknown>>('users', migratedUser as unknown as Record<string, unknown>);
      const verify = await getItem<User>('users', { userId: cognitoSub });
      if (verify) {
        await deleteItem('users', { userId: oldUserId });
        console.log(`[verify] Migration complete: deleted old record ${oldUserId}`);
      } else {
        console.error(`[verify] Migration failed: new record not found, keeping old record ${oldUserId}`);
      }
      user = migratedUser;
    }

    return success({
      userId: cognitoSub,
      token: IdToken,
      refreshToken: RefreshToken,
      clan: user?.clan,
      tutorialDone: user?.tutorialDone ?? false,
    });
  } catch (err) {
    const cognitoError = err as { name?: string };
    if (
      cognitoError.name === 'NotAuthorizedException' ||
      cognitoError.name === 'CodeMismatchException' ||
      cognitoError.name === 'ExpiredCodeException'
    ) {
      return error(ErrorCode.INVALID_CODE, 'Invalid or expired verification code', 401);
    }

    console.error('Verify error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Verification failed', 500);
  }
};
