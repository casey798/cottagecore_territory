import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { User } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const user = await getItem<User>('users', { userId });

    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    const { email: _email, fcmToken: _fcm, ...profile } = user;

    return success(profile);
  } catch (err) {
    console.error('getProfile error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get profile', 500);
  }
};
