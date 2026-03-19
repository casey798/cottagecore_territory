import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { ClanId } from '../../shared/types';
import type { GameSession, User, CapturedSpace } from '../../shared/types';

const CLAN_IDS: string[] = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];

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

    // Parallel scans: game-sessions, users, captured-spaces
    const [sessionsData, usersData, capturedData] = await Promise.all([
      (async () => {
        const items: GameSession[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const result = await scan<GameSession>('game-sessions', {
            filterExpression: '#d BETWEEN :start AND :end',
            expressionNames: { '#d': 'date' },
            expressionValues: { ':start': startDate, ':end': endDate },
            exclusiveStartKey: lastKey,
          });
          items.push(...result.items);
          lastKey = result.lastEvaluatedKey;
        } while (lastKey);
        return items;
      })(),
      (async () => {
        const items: User[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const result = await scan<User>('users', { exclusiveStartKey: lastKey });
          items.push(...result.items);
          lastKey = result.lastEvaluatedKey;
        } while (lastKey);
        return items;
      })(),
      (async () => {
        const items: CapturedSpace[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
          const result = await scan<CapturedSpace>('captured-spaces', { exclusiveStartKey: lastKey });
          items.push(...result.items);
          lastKey = result.lastEvaluatedKey;
        } while (lastKey);
        return items;
      })(),
    ]);

    // Build userId → clan lookup and per-clan roster counts
    const userClanMap = new Map<string, string>();
    const clanRosterCounts: Record<string, number> = {};
    for (const clanId of CLAN_IDS) clanRosterCounts[clanId] = 0;
    for (const u of usersData) {
      userClanMap.set(u.userId, u.clan);
      if (CLAN_IDS.includes(u.clan)) {
        clanRosterCounts[u.clan] = (clanRosterCounts[u.clan] || 0) + 1;
      }
    }

    // Group sessions by date
    const sessionsByDate = new Map<string, GameSession[]>();
    for (const s of sessionsData) {
      const list = sessionsByDate.get(s.date) || [];
      list.push(s);
      sessionsByDate.set(s.date, list);
    }

    // clanXpOverTime: per-date, per-clan sum of xpEarned
    const xpDays = dates.map((date) => {
      const daySessions = sessionsByDate.get(date) || [];
      const xpByClan: Record<string, number> = {};
      for (const clanId of CLAN_IDS) xpByClan[clanId] = 0;
      for (const s of daySessions) {
        const clan = userClanMap.get(s.userId);
        if (clan && CLAN_IDS.includes(clan)) {
          xpByClan[clan] += s.xpEarned;
        }
      }
      return { date, ...xpByClan };
    });

    // clanParticipation: per-date, per-clan, distinct users with xpEarned >= 25 / roster
    const participationDays = dates.map((date) => {
      const daySessions = sessionsByDate.get(date) || [];
      const entry: Record<string, number> = { date: 0 }; // date added below
      for (const clanId of CLAN_IDS) {
        const clanUsers = new Set<string>();
        for (const s of daySessions) {
          if (s.xpEarned >= 25 && userClanMap.get(s.userId) === clanId) {
            clanUsers.add(s.userId);
          }
        }
        const roster = clanRosterCounts[clanId] || 1;
        entry[clanId] = Math.round((clanUsers.size / roster) * 100) / 100;
      }
      return { date, ...entry };
    });

    // territoriesCaptured: group captured-spaces by clan
    const territories: Record<string, { count: number; days: string[] }> = {};
    for (const clanId of CLAN_IDS) territories[clanId] = { count: 0, days: [] };
    for (const cs of capturedData) {
      if (CLAN_IDS.includes(cs.clan)) {
        territories[cs.clan].count++;
        territories[cs.clan].days.push(cs.dateCaptured);
      }
    }
    // Sort days within each clan
    for (const clanId of CLAN_IDS) {
      territories[clanId].days.sort();
    }

    // streakStats: per-clan aggregate from users
    const streakStats: Record<string, { avgStreak: number; longestStreak: number; streakCount3Plus: number }> = {};
    for (const clanId of CLAN_IDS) {
      const clanUsers = usersData.filter((u) => u.clan === clanId);
      const totalStreak = clanUsers.reduce((sum, u) => sum + u.currentStreak, 0);
      const maxStreak = clanUsers.reduce((max, u) => Math.max(max, u.bestStreak), 0);
      const count3Plus = clanUsers.filter((u) => u.currentStreak >= 3).length;
      streakStats[clanId] = {
        avgStreak: clanUsers.length > 0 ? Math.round((totalStreak / clanUsers.length) * 100) / 100 : 0,
        longestStreak: maxStreak,
        streakCount3Plus: count3Plus,
      };
    }

    return success({
      clanXpOverTime: { days: xpDays },
      clanParticipation: { days: participationDays },
      territoriesCaptured: { clans: territories },
      streakStats: { clans: streakStats },
      rosterCounts: clanRosterCounts,
    });
  } catch (err) {
    console.error('[analyticsClans] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
