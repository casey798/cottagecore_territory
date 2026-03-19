import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, query } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { ClanId } from '../../shared/types';
import type { GameSession, CheckIn, User } from '../../shared/types';

const CLAN_IDS: ClanId[] = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
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
    const startDate = params.startDate || today;
    const endDate = params.endDate || today;
    const dates = getDatesInRange(startDate, endDate);

    // Scan all game sessions in date range
    const sessions: GameSession[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<GameSession>('game-sessions', {
        filterExpression: '#d BETWEEN :start AND :end',
        expressionNames: { '#d': 'date' },
        expressionValues: { ':start': startDate, ':end': endDate },
        exclusiveStartKey: lastKey,
      });
      sessions.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    // Query checkins for each date via DateIndex GSI
    const checkins: CheckIn[] = [];
    for (const date of dates) {
      let lastCheckinKey: Record<string, unknown> | undefined;
      do {
        const result = await query<CheckIn>(
          'checkins',
          '#d = :date',
          { ':date': date },
          { indexName: 'DateIndex', expressionNames: { '#d': 'date' }, exclusiveStartKey: lastCheckinKey },
        );
        checkins.push(...result.items);
        lastCheckinKey = result.lastEvaluatedKey;
      } while (lastCheckinKey);
    }

    // Build userId → clan lookup from users table
    const userClanMap = new Map<string, string>();
    let lastUserKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<User>('users', { exclusiveStartKey: lastUserKey });
      for (const u of result.items) {
        userClanMap.set(u.userId, u.clan);
      }
      lastUserKey = result.lastEvaluatedKey;
    } while (lastUserKey);

    // Group sessions by date
    const sessionsByDate = new Map<string, GameSession[]>();
    for (const s of sessions) {
      const list = sessionsByDate.get(s.date) || [];
      list.push(s);
      sessionsByDate.set(s.date, list);
    }

    // Group checkins by date
    const checkinsByDate = new Map<string, CheckIn[]>();
    for (const c of checkins) {
      const list = checkinsByDate.get(c.date) || [];
      list.push(c);
      checkinsByDate.set(c.date, list);
    }

    // Build daily engagement data
    const days = dates.map((date) => {
      const daySessions = sessionsByDate.get(date) || [];
      const dayCheckins = checkinsByDate.get(date) || [];

      // DAU: union of session userIds and checkin userIds
      const allUserIds = new Set<string>();
      for (const s of daySessions) allUserIds.add(s.userId);
      for (const c of dayCheckins) allUserIds.add(c.userId);

      // Per-clan DAU from sessions
      const perClanDau: Record<string, number> = {};
      for (const clanId of CLAN_IDS) {
        const clanUsers = new Set<string>();
        for (const s of daySessions) {
          if (userClanMap.get(s.userId) === clanId) {
            clanUsers.add(s.userId);
          }
        }
        perClanDau[clanId] = clanUsers.size;
      }

      return {
        date,
        dau: allUserIds.size,
        totalSessions: daySessions.length,
        totalCheckins: dayCheckins.length,
        perClanDau,
      };
    });

    return success({ days });
  } catch (err) {
    console.error('[analyticsEngagement] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
