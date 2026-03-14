import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { updateItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const body = JSON.parse(event.body || '{}');
    const fcmToken = body.fcmToken as string | undefined;

    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim().length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'fcmToken is required', 400);
    }

    await updateItem(
      'users',
      { userId },
      'SET fcmToken = :token',
      { ':token': fcmToken.trim() }
    );

    return success({ updated: true });
  } catch (err) {
    console.error('updateFcmToken error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to update FCM token', 500);
  }
};
