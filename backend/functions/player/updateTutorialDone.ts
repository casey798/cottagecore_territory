import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { updateItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    await updateItem(
      'users',
      { userId },
      'SET tutorialDone = :done',
      { ':done': true }
    );

    return success({ updated: true });
  } catch (err) {
    console.error('updateTutorialDone error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to update tutorial status', 500);
  }
};
