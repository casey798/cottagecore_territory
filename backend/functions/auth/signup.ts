import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { signupSchema } from '../../shared/schemas';
import { query } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { User } from '../../shared/types';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const USER_POOL_ID = process.env.USER_POOL_ID || '';
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || '';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { email } = parsed.data;

    // Check email domain
    const domain = email.split('@')[1];
    if (ALLOWED_EMAIL_DOMAIN && domain !== ALLOWED_EMAIL_DOMAIN) {
      return error(
        ErrorCode.INVALID_DOMAIN,
        `Only @${ALLOWED_EMAIL_DOMAIN} emails are allowed`,
        403
      );
    }

    // Check if user exists in roster (users table, EmailIndex GSI)
    const { items } = await query<User>(
      'users',
      'email = :email',
      { ':email': email },
      { indexName: 'EmailIndex' }
    );

    if (items.length === 0) {
      return error(
        ErrorCode.NOT_IN_ROSTER,
        'Email not found in roster. Contact your administrator.',
        403
      );
    }

    // Create Cognito user with SUPPRESS message action (we handle OTP ourselves)
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:clan', Value: items[0].clan },
          { Name: 'custom:displayName', Value: items[0].displayName },
        ],
        MessageAction: MessageActionType.SUPPRESS,
      })
    );

    return success({ message: 'Account created. Use login to receive your OTP.' });
  } catch (err) {
    const cognitoError = err as { name?: string };
    if (cognitoError.name === 'UsernameExistsException') {
      return success({ message: 'Account already exists. Use login to receive your OTP.' });
    }

    console.error('Signup error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to create account', 500);
  }
};
