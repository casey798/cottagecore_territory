import { query, updateItem } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { fromZonedTime } from 'date-fns-tz';
import { setHours, setMinutes, setSeconds, setMilliseconds, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { GameSession, LeaveReason } from '../../shared/types';

const IST_TIMEZONE = 'Asia/Kolkata';
const MAX_DWELL_SECONDS = 7200;

function get6pmISTAsISO(dateStr: string): string {
  const dateOnly = new Date(dateStr + 'T00:00:00');
  const istDate = toZonedTime(dateOnly, IST_TIMEZONE);
  const at6pm = setMilliseconds(setSeconds(setMinutes(setHours(startOfDay(istDate), 18), 0), 0), 0);
  return fromZonedTime(at6pm, IST_TIMEZONE).toISOString();
}

export async function handler(): Promise<void> {
  const today = getTodayISTString();
  console.log(`[computeDwellFallbacks] Processing date: ${today}`);

  // Collect all sessions for today where leftAt is null
  const openSessions: GameSession[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await query<GameSession>(
      'game-sessions',
      '#d = :date',
      { ':date': today },
      {
        indexName: 'UserDateIndex',
        expressionNames: { '#d': 'date' },
        exclusiveStartKey: lastKey,
      },
    );

    // GSI returns all sessions for this date; filter for null leftAt
    openSessions.push(...result.items.filter((s) => !s.leftAt));
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  if (openSessions.length === 0) {
    console.log('[computeDwellFallbacks] No open sessions to patch');
    return;
  }

  // Group by userId
  const byUser = new Map<string, GameSession[]>();
  for (const session of openSessions) {
    const list = byUser.get(session.userId) || [];
    list.push(session);
    byUser.set(session.userId, list);
  }

  // Also get ALL sessions for today (including those with leftAt) to find "next session" fallbacks
  const allSessions: GameSession[] = [];
  let allLastKey: Record<string, unknown> | undefined;

  do {
    const result = await query<GameSession>(
      'game-sessions',
      '#d = :date',
      { ':date': today },
      {
        indexName: 'UserDateIndex',
        expressionNames: { '#d': 'date' },
        exclusiveStartKey: allLastKey,
      },
    );
    allSessions.push(...result.items);
    allLastKey = result.lastEvaluatedKey;
  } while (allLastKey);

  const allByUser = new Map<string, GameSession[]>();
  for (const session of allSessions) {
    const list = allByUser.get(session.userId) || [];
    list.push(session);
    allByUser.set(session.userId, list);
  }

  const endOfDay = get6pmISTAsISO(today);
  let patchedCount = 0;

  for (const [userId, sessions] of byUser) {
    const userAllSessions = (allByUser.get(userId) || []).sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );

    for (const session of sessions) {
      const sessionStartMs = new Date(session.startedAt).getTime();

      // Find the next session by this user that started after this one
      const nextSession = userAllSessions.find(
        (s) => s.sessionId !== session.sessionId && new Date(s.startedAt).getTime() > sessionStartMs,
      );

      let leftAt: string;
      let reason: LeaveReason;

      if (nextSession) {
        leftAt = nextSession.startedAt;
        reason = 'fallback_next_session';
      } else {
        leftAt = endOfDay;
        reason = 'fallback_end_of_day';
      }

      const leftMs = new Date(leftAt).getTime();
      const rawDwell = Math.round((leftMs - sessionStartMs) / 1000);
      const dwellTime = Math.min(Math.max(rawDwell, 0), MAX_DWELL_SECONDS);

      try {
        await updateItem(
          'game-sessions',
          { sessionId: session.sessionId },
          'SET leftAt = :leftAt, dwellTime = :dwellTime, leaveReason = :reason',
          { ':leftAt': leftAt, ':dwellTime': dwellTime, ':reason': reason },
          undefined,
          'attribute_not_exists(leftAt) OR leftAt = :null',
        );
        patchedCount++;
      } catch (err) {
        // Condition check failure = already patched (idempotent)
        const errName = (err as { name?: string })?.name;
        if (errName !== 'ConditionalCheckFailedException') {
          console.error(`[computeDwellFallbacks] Failed to patch session ${session.sessionId}:`, err);
        }
      }
    }
  }

  console.log(`[computeDwellFallbacks] Patched ${patchedCount} sessions`);
}
