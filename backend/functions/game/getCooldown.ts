import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { query } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import { GameSession } from '../../shared/types';

const COOLDOWN_MS = 300000; // 5 minutes

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);
    const today = getTodayISTString();

    // Query most recent completed session for today
    const { items: sessions } = await query<GameSession>(
      'game-sessions',
      'userId = :uid AND #d = :date',
      { ':uid': userId, ':date': today },
      {
        indexName: 'UserDateIndex',
        expressionNames: { '#d': 'date' },
        scanIndexForward: false,
        limit: 10,
      }
    );

    // Find the most recently completed session
    const completedSessions = sessions.filter((s) => s.completedAt !== null);

    if (completedSessions.length === 0) {
      return success({
        onCooldown: false,
        cooldownEndsAt: null,
        remainingSeconds: 0,
      });
    }

    // Sort by completedAt descending to find the most recent
    completedSessions.sort(
      (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    );

    const lastCompleted = completedSessions[0];
    const completedAtMs = new Date(lastCompleted.completedAt!).getTime();
    const nowMs = Date.now();
    const elapsed = nowMs - completedAtMs;

    if (elapsed < COOLDOWN_MS) {
      const cooldownEndsAt = new Date(completedAtMs + COOLDOWN_MS).toISOString();
      const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);

      return success({
        onCooldown: true,
        cooldownEndsAt,
        remainingSeconds,
      });
    }

    return success({
      onCooldown: false,
      cooldownEndsAt: null,
      remainingSeconds: 0,
    });
  } catch (err) {
    console.error('getCooldown error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
