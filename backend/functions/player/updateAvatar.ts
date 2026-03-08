import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { updateItem } from '../../shared/db';
import { updateAvatarSchema } from '../../shared/schemas';
import { success, error, ErrorCode } from '../../shared/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const parsed = updateAvatarSchema.safeParse(body);

    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { displayName, avatarConfig } = parsed.data;

    await updateItem(
      'users',
      { userId },
      'SET displayName = :dn, avatarConfig = :ac',
      { ':dn': displayName, ':ac': avatarConfig }
    );

    return success({ updated: true });
  } catch (err) {
    console.error('updateAvatar error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to update avatar', 500);
  }
};
