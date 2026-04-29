import { getItem, putItem, scan, docClient, tableName } from './db';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { Space, SpaceAssignment } from './types';

const TOTAL_DAYS = 4;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Scan active spaces once — callers can cache the result and pass it to
 * generateSpaceAssignment to avoid redundant table scans.
 */
export async function getActiveSpaceIds(): Promise<string[]> {
  const ids: string[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<Space>('spaces', {
      filterExpression: 'active = :t',
      expressionValues: { ':t': true },
      exclusiveStartKey: lastKey,
    });
    for (const space of result.items) {
      ids.push(space.spaceId);
    }
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return ids;
}

/**
 * Generate a space assignment for a single user for today.
 * Uses a 4-day rotation window: avoids spaces assigned in the past 3 days.
 * PutItem uses a condition to avoid overwriting an existing assignment (race safety).
 *
 * @param activeSpaceIds — optional pre-fetched list; if omitted, scans the spaces table.
 */
export async function generateSpaceAssignment(
  userId: string,
  today: string,
  activeSpaceIds?: string[],
): Promise<SpaceAssignment> {
  // 1. Use pre-fetched list or scan the spaces table
  if (!activeSpaceIds) {
    activeSpaceIds = await getActiveSpaceIds();
  }

  if (activeSpaceIds.length === 0) {
    const record: SpaceAssignment = {
      dateUserId: `${today}#${userId}`,
      assignedSpaceIds: [],
      completedSpaceIds: [],
      createdAt: new Date().toISOString(),
    };
    await putItem('space-assignments', record as unknown as Record<string, unknown>);
    return record;
  }

  // 2. spacesPerDay = ceil(N / TOTAL_DAYS)
  const spacesPerDay = Math.ceil(activeSpaceIds.length / TOTAL_DAYS);

  // 3. Collect previously assigned space IDs from the last (TOTAL_DAYS - 1) PLAY days.
  //    Walk backwards through calendar days until we find enough assignments or hit a
  //    reasonable upper bound (14 days) to handle leave / quiet-mode gaps.
  const MAX_LOOKBACK_CALENDAR_DAYS = 14;
  const previouslyAssigned = new Set<string>();
  let playDaysFound = 0;
  for (let d = 1; d <= MAX_LOOKBACK_CALENDAR_DAYS && playDaysFound < TOTAL_DAYS - 1; d++) {
    const pastDate = subtractDays(today, d);
    const pa = await getItem<SpaceAssignment>('space-assignments', { dateUserId: `${pastDate}#${userId}` });
    if (pa && pa.assignedSpaceIds.length > 0) {
      for (const id of pa.assignedSpaceIds) {
        previouslyAssigned.add(id);
      }
      playDaysFound++;
    }
  }

  // 4. Build available pool (exclude previously assigned)
  const availablePool = activeSpaceIds.filter(id => !previouslyAssigned.has(id));

  // 5. Select, backfilling if pool is too small
  let selectedIds: string[];
  if (availablePool.length >= spacesPerDay) {
    selectedIds = shuffleArray(availablePool).slice(0, spacesPerDay);
  } else {
    const remaining = [...availablePool];
    const needed = spacesPerDay - remaining.length;
    const backfillPool = activeSpaceIds.filter(id => !remaining.includes(id));
    const backfill = shuffleArray(backfillPool).slice(0, needed);
    selectedIds = [...remaining, ...backfill];
  }

  // 6. Write SpaceAssignment record (conditional to avoid overwriting)
  const record: SpaceAssignment = {
    dateUserId: `${today}#${userId}`,
    assignedSpaceIds: selectedIds,
    completedSpaceIds: [],
    createdAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: tableName('space-assignments'),
    Item: record,
    ConditionExpression: 'attribute_not_exists(dateUserId)',
  }));

  return record;
}

/**
 * Get or create a space assignment for a user for today.
 * Handles the ConditionalCheckFailedException race condition gracefully.
 */
export async function getOrCreateSpaceAssignment(
  userId: string,
  today: string,
): Promise<SpaceAssignment> {
  const existing = await getItem<SpaceAssignment>(
    'space-assignments',
    { dateUserId: `${today}#${userId}` }
  );
  if (existing) return existing;

  try {
    return await generateSpaceAssignment(userId, today);
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === 'ConditionalCheckFailedException') {
      const created = await getItem<SpaceAssignment>(
        'space-assignments',
        { dateUserId: `${today}#${userId}` }
      );
      if (created) return created;
    }
    throw err;
  }
}
