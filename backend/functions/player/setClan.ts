import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { setClanSchema } from '../../shared/schemas';
import { updateItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const parsed = setClanSchema.safeParse(body);

    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { clan } = parsed.data;

    await updateItem(
      'users',
      { userId },
      'SET clan = :clan',
      { ':clan': clan }
    );

    return success({ clan });
  } catch (err) {
    console.error('Set clan error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to set clan', 500);
  }
};
