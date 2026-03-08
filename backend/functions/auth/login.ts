import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AuthFlowType,
  ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider';
import { loginSchema } from '../../shared/schemas';
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
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { email, code } = parsed.data;

    // Initiate CUSTOM_AUTH flow
    const initiateResponse = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.CUSTOM_AUTH,
        ClientId: USER_POOL_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
        },
      })
    );

    if (
      initiateResponse.ChallengeName !== ChallengeNameType.CUSTOM_CHALLENGE ||
      !initiateResponse.Session
    ) {
      return error(ErrorCode.INTERNAL_ERROR, 'Unexpected auth challenge', 500);
    }

    // Respond to the custom challenge with the OTP code
    const challengeResponse = await cognito.send(
      new RespondToAuthChallengeCommand({
        ClientId: USER_POOL_CLIENT_ID,
        ChallengeName: ChallengeNameType.CUSTOM_CHALLENGE,
        Session: initiateResponse.Session,
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
    console.log('[login] Cognito sub:', cognitoSub);

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
      console.log(`[login] Migrating userId: ${user.userId} -> ${cognitoSub}`);
      const oldUserId = user.userId;
      const migratedUser: User = { ...user, userId: cognitoSub };
      await putItem<Record<string, unknown>>('users', migratedUser as unknown as Record<string, unknown>);
      // Verify the new record exists before deleting the old one
      const verify = await getItem<User>('users', { userId: cognitoSub });
      if (verify) {
        await deleteItem('users', { userId: oldUserId });
        console.log(`[login] Migration complete: deleted old record ${oldUserId}`);
      } else {
        console.error(`[login] Migration failed: new record not found, keeping old record ${oldUserId}`);
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
      cognitoError.name === 'UserNotFoundException'
    ) {
      return error(ErrorCode.INVALID_CODE, 'Invalid credentials', 401);
    }

    console.error('Login error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Login failed', 500);
  }
};
