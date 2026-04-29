import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { ClanId } from '../../shared/types';
import type { GameSession, User, SpaceDecorationSubmission, SpaceAssignment } from '../../shared/types';

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

async function scanAll<T>(table: string, filterExpression?: string, expressionNames?: Record<string, string>, expressionValues?: Record<string, unknown>): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, {
      filterExpression,
      expressionNames,
      expressionValues,
      exclusiveStartKey: lastKey,
    });
    items.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return items;
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

    // Parallel scans
    const [decorations, assignments, sessions, users] = await Promise.all([
      scanAll<SpaceDecorationSubmission>('space-decorations',
        '#d BETWEEN :start AND :end',
        { '#d': 'date' },
        { ':start': startDate, ':end': endDate }
      ),
      scanAll<SpaceAssignment>('space-assignments'),
      scanAll<GameSession>('game-sessions',
        '#d BETWEEN :start AND :end',
        { '#d': 'date' },
        { ':start': startDate, ':end': endDate }
      ),
      scanAll<User>('users'),
    ]);

    // Filter assignments to date range (dateUserId = "YYYY-MM-DD#userId")
    const dateSet = new Set(dates);
    const filteredAssignments = assignments.filter((a) => {
      const d = a.dateUserId.split('#')[0];
      return dateSet.has(d);
    });

    // userId → clan map
    const userClanMap = new Map<string, string>();
    for (const u of users) {
      userClanMap.set(u.userId, u.clan);
    }

    // ── Per-clan aggregation ──
    type ClanAgg = {
      minigameXp: number;
      spaceXp: number;
      spacesDecorated: number;
      decoratorSet: Set<string>;
      activeUserSet: Set<string>;
      assignedSpaces: number;
      completedSpaces: number;
      sentimentYes: number;
      sentimentMaybe: number;
      sentimentNo: number;
    };

    const clanAgg = new Map<string, ClanAgg>();
    for (const clanId of CLAN_IDS) {
      clanAgg.set(clanId, {
        minigameXp: 0, spaceXp: 0, spacesDecorated: 0,
        decoratorSet: new Set(), activeUserSet: new Set(),
        assignedSpaces: 0, completedSpaces: 0,
        sentimentYes: 0, sentimentMaybe: 0, sentimentNo: 0,
      });
    }

    // Process game sessions
    for (const s of sessions) {
      if (s.practiceSession) continue;
      const clan = userClanMap.get(s.userId);
      if (!clan || !clanAgg.has(clan)) continue;
      const agg = clanAgg.get(clan)!;
      agg.minigameXp += s.xpEarned;
      agg.activeUserSet.add(s.userId);
    }

    // Process space decorations
    for (const d of decorations) {
      const clan = d.clan;
      if (!clanAgg.has(clan)) continue;
      const agg = clanAgg.get(clan)!;
      agg.spaceXp += d.xpAwarded;
      agg.spacesDecorated++;
      agg.decoratorSet.add(d.userId);
      agg.activeUserSet.add(d.userId);
      // Sentiment
      const sentiment = d.survey?.wouldVisitMore;
      if (sentiment === 'yes') agg.sentimentYes++;
      else if (sentiment === 'maybe') agg.sentimentMaybe++;
      else if (sentiment === 'no') agg.sentimentNo++;
    }

    // Process space assignments
    for (const a of filteredAssignments) {
      const userId = a.dateUserId.split('#')[1];
      const clan = userClanMap.get(userId);
      if (!clan || !clanAgg.has(clan)) continue;
      const agg = clanAgg.get(clan)!;
      agg.assignedSpaces += a.assignedSpaceIds.length;
      agg.completedSpaces += a.completedSpaceIds.length;
    }

    // Build clan leaderboard (sorted by totalXp desc)
    const clanLeaderboard = CLAN_IDS.map((clanId) => {
      const agg = clanAgg.get(clanId)!;
      return {
        clanId,
        minigameXp: agg.minigameXp,
        spaceXp: agg.spaceXp,
        totalXp: agg.minigameXp + agg.spaceXp,
        activeUsers: agg.activeUserSet.size,
        spacesDecorated: agg.spacesDecorated,
        uniqueDecorators: agg.decoratorSet.size,
        assignmentCompletionRate: agg.assignedSpaces > 0
          ? Math.round((agg.completedSpaces / agg.assignedSpaces) * 1000) / 1000
          : 0,
      };
    }).sort((a, b) => b.totalXp - a.totalXp);

    // ── Daily activity breakdown ──
    type DayClanData = { decorations: number; spaceXp: number; minigameXp: number };

    const dailyActivity = dates.map((date) => {
      const perClan: Record<string, DayClanData> = {};
      for (const clanId of CLAN_IDS) {
        perClan[clanId] = { decorations: 0, spaceXp: 0, minigameXp: 0 };
      }

      // Decorations for this day
      for (const d of decorations) {
        if (d.date !== date) continue;
        const clan = d.clan;
        if (perClan[clan]) {
          perClan[clan].decorations++;
          perClan[clan].spaceXp += d.xpAwarded;
        }
      }

      // Sessions for this day
      for (const s of sessions) {
        if (s.date !== date || s.practiceSession) continue;
        const clan = userClanMap.get(s.userId);
        if (clan && perClan[clan]) {
          perClan[clan].minigameXp += s.xpEarned;
        }
      }

      const totalDecorations = Object.values(perClan).reduce((s, c) => s + c.decorations, 0);
      const totalSpaceXp = Object.values(perClan).reduce((s, c) => s + c.spaceXp, 0);

      return { date, decorations: totalDecorations, spaceXp: totalSpaceXp, perClan };
    });

    // ── Sentiment breakdown ──
    const overallSentiment = { yes: 0, maybe: 0, no: 0 };
    const perClanSentiment: Record<string, { yes: number; maybe: number; no: number }> = {};
    for (const clanId of CLAN_IDS) {
      const agg = clanAgg.get(clanId)!;
      perClanSentiment[clanId] = { yes: agg.sentimentYes, maybe: agg.sentimentMaybe, no: agg.sentimentNo };
      overallSentiment.yes += agg.sentimentYes;
      overallSentiment.maybe += agg.sentimentMaybe;
      overallSentiment.no += agg.sentimentNo;
    }

    // ── Pack category usage ──
    const packUsage = { furniture: 0, aesthetics: 0, nature: 0 };
    for (const d of decorations) {
      if (d.packUsageSummary) {
        packUsage.furniture += d.packUsageSummary.furniture || 0;
        packUsage.aesthetics += d.packUsageSummary.aesthetics || 0;
        packUsage.nature += d.packUsageSummary.nature || 0;
      }
    }

    // ── Totals ──
    const allDecorators = new Set<string>();
    for (const d of decorations) allDecorators.add(d.userId);

    const totalMinigameXp = CLAN_IDS.reduce((s, c) => s + clanAgg.get(c)!.minigameXp, 0);
    const totalSpaceXp = CLAN_IDS.reduce((s, c) => s + clanAgg.get(c)!.spaceXp, 0);

    return success({
      clanLeaderboard,
      dailyActivity,
      sentimentBreakdown: { overall: overallSentiment, perClan: perClanSentiment },
      packCategoryUsage: packUsage,
      totals: {
        totalDecorations: decorations.length,
        totalSpaceXp,
        totalMinigameXp,
        uniqueDecorators: allDecorators.size,
      },
    });
  } catch (err) {
    console.error('[analyticsSpaces] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
