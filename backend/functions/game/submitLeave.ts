import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem, updateItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import type { GameSession, LeaveReason } from '../../shared/types';

const VALID_REASONS: LeaveReason[] = [
  'navigated_away',
  'new_scan',
  'app_backgrounded',
  'fallback_next_session',
  'fallback_end_of_day',
];

const MAX_DWELL_SECONDS = 7200;

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = extractUserId(event);
    const body = JSON.parse(event.body || '{}');
    const { sessionId, leftAt, reason } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return error(ErrorCode.VALIDATION_ERROR, 'sessionId is required', 400);
    }

    if (!leftAt || typeof leftAt !== 'string' || isNaN(Date.parse(leftAt))) {
      return error(ErrorCode.VALIDATION_ERROR, 'leftAt must be a valid ISO timestamp', 400);
    }

    if (!VALID_REASONS.includes(reason)) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid leave reason', 400);
    }

    const session = await getItem<GameSession>('game-sessions', { sessionId });

    if (!session) {
      return error(ErrorCode.SESSION_NOT_FOUND, 'Session not found', 404);
    }

    if (session.userId !== userId) {
      return error(ErrorCode.FORBIDDEN, 'Session does not belong to this user', 403);
    }

    // Idempotent: if leftAt already set, return success
    if (session.leftAt) {
      return success({ dwellTime: session.dwellTime });
    }

    // Validate leftAt is after startedAt
    const startMs = new Date(session.startedAt).getTime();
    const leftMs = new Date(leftAt).getTime();
    if (leftMs < startMs) {
      return error(ErrorCode.VALIDATION_ERROR, 'leftAt must be after session startedAt', 400);
    }

    const rawDwell = Math.round((leftMs - startMs) / 1000);
    const dwellTime = Math.min(rawDwell, MAX_DWELL_SECONDS);

    await updateItem(
      'game-sessions',
      { sessionId },
      'SET leftAt = :leftAt, dwellTime = :dwellTime, leaveReason = :reason',
      { ':leftAt': leftAt, ':dwellTime': dwellTime, ':reason': reason },
    );

    return success({ dwellTime });
  } catch (err) {
    console.error('[submitLeave] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
