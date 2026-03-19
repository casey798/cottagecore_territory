import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { GameSession } from '../../shared/types';

interface MinigameStats {
  minigameId: string;
  totalPlays: number;
  wins: number;
  winRate: number;
  avgTimeSeconds: number | null;
  abandonmentRate: number;
  coopPercent: number;
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const params = event.queryStringParameters || {};
    const today = getTodayISTString();
    const startDate = params.startDate;
    const endDate = params.endDate;

    // Scan game sessions with optional date filter
    const allSessions: GameSession[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const scanOpts: Parameters<typeof scan>[1] = { exclusiveStartKey: lastKey };
      if (startDate && endDate) {
        scanOpts.filterExpression = '#d BETWEEN :start AND :end';
        scanOpts.expressionNames = { '#d': 'date' };
        scanOpts.expressionValues = { ':start': startDate, ':end': endDate };
      }
      const result = await scan<GameSession>('game-sessions', scanOpts);
      allSessions.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    // Filter out practice sessions
    const sessions = allSessions.filter((s) => !s.practiceSession);

    // Group by minigameId
    const grouped = new Map<string, GameSession[]>();
    for (const s of sessions) {
      const list = grouped.get(s.minigameId) || [];
      list.push(s);
      grouped.set(s.minigameId, list);
    }

    const minigames: MinigameStats[] = [];
    grouped.forEach((mgSessions, minigameId) => {
      const totalPlays = mgSessions.length;
      const wins = mgSessions.filter((s) => s.result === 'win').length;
      const abandoned = mgSessions.filter(
        (s) => s.result === 'timeout' || s.result === 'abandoned'
      ).length;
      const coopCount = mgSessions.filter((s) => s.coopPartnerId != null).length;

      // Average completion time for completed sessions
      const completedSessions = mgSessions.filter((s) => s.completedAt && s.startedAt);
      let avgTimeSeconds: number | null = null;
      if (completedSessions.length > 0) {
        let totalMs = 0;
        for (const s of completedSessions) {
          const start = new Date(s.startedAt).getTime();
          const end = new Date(s.completedAt!).getTime();
          totalMs += end - start;
        }
        avgTimeSeconds = Math.round(totalMs / completedSessions.length / 1000);
      }

      minigames.push({
        minigameId,
        totalPlays,
        wins,
        winRate: totalPlays > 0 ? Math.round((wins / totalPlays) * 10000) / 10000 : 0,
        avgTimeSeconds,
        abandonmentRate: totalPlays > 0 ? Math.round((abandoned / totalPlays) * 10000) / 10000 : 0,
        coopPercent: totalPlays > 0 ? Math.round((coopCount / totalPlays) * 10000) / 10000 : 0,
      });
    });

    // Sort by totalPlays descending
    minigames.sort((a, b) => b.totalPlays - a.totalPlays);

    return success({ minigames });
  } catch (err) {
    console.error('[analyticsMinigames] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
