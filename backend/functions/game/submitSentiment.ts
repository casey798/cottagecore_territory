import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem, updateItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import type { GameSession, SpaceSentiment } from '../../shared/types';

const VALID_SENTIMENTS: SpaceSentiment[] = ['yes', 'maybe', 'no'];

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = extractUserId(event);
    const sessionId = event.pathParameters?.sessionId;

    if (!sessionId) {
      return error(ErrorCode.VALIDATION_ERROR, 'sessionId is required', 400);
    }

    const body = JSON.parse(event.body || '{}');
    const { spaceSentiment } = body;

    if (!VALID_SENTIMENTS.includes(spaceSentiment)) {
      return error(ErrorCode.VALIDATION_ERROR, 'spaceSentiment must be yes, maybe, or no', 400);
    }

    // Verify session exists and belongs to this user
    const session = await getItem<GameSession>('game-sessions', { sessionId });

    if (!session) {
      return error(ErrorCode.SESSION_NOT_FOUND, 'Session not found', 404);
    }

    if (session.userId !== userId) {
      return error(ErrorCode.FORBIDDEN, 'Session does not belong to this user', 403);
    }

    // Do not allow updating if already set
    if (session.spaceSentiment) {
      return error(ErrorCode.VALIDATION_ERROR, 'Sentiment already submitted for this session', 409);
    }

    await updateItem(
      'game-sessions',
      { sessionId },
      'SET spaceSentiment = :sentiment',
      { ':sentiment': spaceSentiment },
    );

    return success({ submitted: true });
  } catch (err) {
    console.error('[submitSentiment] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
