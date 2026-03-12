import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { OAuth2Client } from 'google-auth-library';
import { googleLoginSchema } from '../../shared/schemas';
import { success, error, ErrorCode } from '../../shared/response';

const ADMIN_EMAILS: string[] = [
  'karthikrajak@student.tce.edu',
];

const GOOGLE_CLIENT_ID =
  '425457815141-c7qp4l9sjkn5fgcv9t3odnu83j4nd3nh.apps.googleusercontent.com';

const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const parsed = googleLoginSchema.safeParse(body);

    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { idToken } = parsed.data;

    let payload;
    try {
      const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('Google token verification failed:', err);
      return error(ErrorCode.INVALID_CODE, 'Invalid or expired token', 401);
    }

    if (!payload || !payload.email) {
      return error(ErrorCode.VALIDATION_ERROR, 'Token does not contain an email', 400);
    }

    const email = payload.email;

    if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
      return error(ErrorCode.NOT_ADMIN, 'You are not authorized to access the admin dashboard', 403);
    }

    return success({
      token: idToken,
      email,
      role: 'admin',
    });
  } catch (err) {
    console.error('Admin Google login error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Login failed', 500);
  }
};
