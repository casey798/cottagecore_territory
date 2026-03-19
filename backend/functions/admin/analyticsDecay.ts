import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { ClanId } from '../../shared/types';
import type { GameSession, User, LocationMasterConfig } from '../../shared/types';
import { toZonedTime } from 'date-fns-tz';
import { addDays, format } from 'date-fns';

const CLAN_IDS: ClanId[] = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];

function getDateNDaysAgo(n: number): string {
  const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
  return format(addDays(nowIST, -n), 'yyyy-MM-dd');
}

function getSeasonStartDefault(): string {
  return getDateNDaysAgo(30);
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const today = getTodayISTString();
    const seasonStart = getSeasonStartDefault();

    // ── Parallel scans ───────────────────────────────────────────────
    const [allSessions, usersData, locationsData] = await Promise.all([
      scanAllFiltered<GameSession>('game-sessions', seasonStart, today),
      scanAll<User>('users'),
      scanAll<LocationMasterConfig>('location-master-config'),
    ]);

    const sessions = allSessions.filter((s) => !s.practiceSession);

    // Build user maps
    const userClanMap = new Map<string, string>();
    const clanRoster = new Map<string, number>();
    for (const clanId of CLAN_IDS) clanRoster.set(clanId, 0);
    for (const u of usersData) {
      userClanMap.set(u.userId, u.clan);
      clanRoster.set(u.clan, (clanRoster.get(u.clan) || 0) + 1);
    }

    // Group sessions by date
    const sessionsByDate = new Map<string, GameSession[]>();
    for (const s of sessions) {
      const list = sessionsByDate.get(s.date) || [];
      list.push(s);
      sessionsByDate.set(s.date, list);
    }

    // ── 1) DAU Decline ───────────────────────────────────────────────
    let peakDau = 0;
    let peakDate = today;
    const todaySessions = sessionsByDate.get(today) || [];
    const todayUsers = new Set(todaySessions.map((s) => s.userId));
    const todayDau = todayUsers.size;

    sessionsByDate.forEach((daySessions, date) => {
      const dayUsers = new Set(daySessions.map((s) => s.userId));
      if (dayUsers.size > peakDau) {
        peakDau = dayUsers.size;
        peakDate = date;
      }
    });

    const dauDropPercent = peakDau > 0 ? Math.round((1 - todayDau / peakDau) * 100) : 0;
    const dauDecline = {
      triggered: peakDau > 0 && todayDau < peakDau * 0.8,
      peakDau,
      peakDate,
      todayDau,
      dropPercent: dauDropPercent,
    };

    // ── 2) Clan Disengagement ────────────────────────────────────────
    const yesterday = getDateNDaysAgo(1);
    const twoDaysAgo = getDateNDaysAgo(2);
    const recentDates = [twoDaysAgo, yesterday, today];

    const disengagedClans: Array<{ clanId: string; participationLast3Days: number[] }> = [];
    for (const clanId of CLAN_IDS) {
      const roster = clanRoster.get(clanId) || 1;
      const rates: number[] = [];

      for (const date of recentDates) {
        const daySessions = sessionsByDate.get(date) || [];
        const clanUsers = new Set<string>();
        for (const s of daySessions) {
          if (s.xpEarned >= 25 && userClanMap.get(s.userId) === clanId) {
            clanUsers.add(s.userId);
          }
        }
        rates.push(Math.round((clanUsers.size / roster) * 10000) / 10000);
      }

      // Triggered if last 2+ consecutive days are below 30%
      const last2Below = rates[1] < 0.3 && rates[2] < 0.3;
      if (last2Below) {
        disengagedClans.push({
          clanId,
          participationLast3Days: rates,
        });
      }
    }

    const clanDisengagement = {
      triggered: disengagedClans.length > 0,
      clans: disengagedClans,
    };

    // ── 3) Minigame Abandonment ──────────────────────────────────────
    const mgStats = new Map<string, { total: number; abandoned: number }>();
    for (const s of sessions) {
      const stats = mgStats.get(s.minigameId) || { total: 0, abandoned: 0 };
      stats.total++;
      if (s.result === 'timeout' || s.result === 'abandoned') {
        stats.abandoned++;
      }
      mgStats.set(s.minigameId, stats);
    }

    const abandonedMinigames: Array<{ minigameId: string; abandonmentRate: number }> = [];
    mgStats.forEach((stats, minigameId) => {
      const rate = stats.total > 0 ? stats.abandoned / stats.total : 0;
      if (rate > 0.25) {
        abandonedMinigames.push({
          minigameId,
          abandonmentRate: Math.round(rate * 10000) / 10000,
        });
      }
    });

    const minigameAbandonment = {
      triggered: abandonedMinigames.length > 0,
      minigames: abandonedMinigames,
    };

    // ── 4) Sessions Per Player Low ───────────────────────────────────
    const sessionsPerPlayer = todayDau > 0
      ? Math.round((todaySessions.length / todayDau) * 100) / 100 : 0;

    const sessionsPerPlayerLow = {
      triggered: todayDau > 0 && sessionsPerPlayer < 1.5,
      value: sessionsPerPlayer,
    };

    // ── 5) Unactivated High-Priority Spaces ──────────────────────────
    const locationSessionCounts = new Map<string, number>();
    for (const s of sessions) {
      locationSessionCounts.set(s.locationId, (locationSessionCounts.get(s.locationId) || 0) + 1);
    }

    const unactivatedLocations: Array<{ locationId: string; name: string; priorityTier: string }> = [];
    for (const loc of locationsData) {
      if (!loc.active) continue;
      if (loc.priorityTier !== 'P1-Critical' && loc.priorityTier !== 'P1-Seed') continue;
      const count = locationSessionCounts.get(loc.locationId) || 0;
      if (count === 0) {
        unactivatedLocations.push({
          locationId: loc.locationId,
          name: loc.name,
          priorityTier: loc.priorityTier,
        });
      }
    }

    const unactivatedSpaces = {
      triggered: unactivatedLocations.length > 0,
      locations: unactivatedLocations,
    };

    return success({
      alerts: {
        dauDecline,
        clanDisengagement,
        minigameAbandonment,
        sessionsPerPlayerLow,
        unactivatedSpaces,
      },
      computedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[analyticsDecay] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

async function scanAll<T>(table: string): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, { exclusiveStartKey: lastKey });
    items.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function scanAllFiltered<T>(table: string, startDate: string, endDate: string): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, {
      filterExpression: '#d BETWEEN :start AND :end',
      expressionNames: { '#d': 'date' },
      expressionValues: { ':start': startDate, ':end': endDate },
      exclusiveStartKey: lastKey,
    });
    items.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return items;
}
