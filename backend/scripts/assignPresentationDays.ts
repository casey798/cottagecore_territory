/**
 * Assign daily locations + spaces for one or more players across a date range.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/assignPresentationDays.ts [options]
 *
 * Options (all optional — defaults shown):
 *   --email   <email>        Player email to assign  (default: karthikrajak@student.tce.edu)
 *   --from    <YYYY-MM-DD>   Start date in IST       (default: today)
 *   --to      <YYYY-MM-DD>   End date in IST         (default: today + 3 days)
 *   --days    <N>            Number of days from --from (alternative to --to)
 *
 * Examples:
 *   # Default: assign karthikrajak for today + next 3 days
 *   npx ts-node --project tsconfig.json scripts/assignPresentationDays.ts
 *
 *   # Assign a different player for 5 days starting today
 *   npx ts-node --project tsconfig.json scripts/assignPresentationDays.ts --email someone@tce.edu --days 5
 *
 *   # Assign for a specific date range
 *   npx ts-node --project tsconfig.json scripts/assignPresentationDays.ts --from 2026-05-01 --to 2026-05-04
 *
 *   # Assign just one specific day
 *   npx ts-node --project tsconfig.json scripts/assignPresentationDays.ts --from 2026-04-22 --days 1
 */
import crypto from 'crypto';
import { format, addDays, parseISO, eachDayOfInterval } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { generatePlayerAssignment } from '../shared/generatePlayerAssignment';
import { generateSpaceAssignment, getActiveSpaceIds } from '../shared/spaceAssignment';
import { getItem, putItem, deleteItem, scan, updateItem } from '../shared/db';
import { getTodayISTString } from '../shared/time';
import { User, DailyConfig, DailyConfigStatus, Location } from '../shared/types';

// ─── CONFIG DEFAULTS ────────────────────────────────────────────────────────
const DEFAULT_EMAIL = 'karthikrajak@student.tce.edu';
const DEFAULT_DAYS  = 4;   // today + 3 more = 4 total
// ────────────────────────────────────────────────────────────────────────────

const IST_TIMEZONE = 'Asia/Kolkata';

// Parse CLI args: --key value
function parseArgs(): { email: string; fromDate: string; toDate: string } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : null;
  };

  const email    = get('--email') ?? DEFAULT_EMAIL;
  const today    = getTodayISTString();
  const fromDate = get('--from') ?? today;

  let toDate: string;
  if (get('--to')) {
    toDate = get('--to')!;
  } else {
    const days = parseInt(get('--days') ?? String(DEFAULT_DAYS), 10);
    toDate = format(addDays(parseISO(fromDate), days - 1), 'yyyy-MM-dd');
  }

  return { email, fromDate, toDate };
}


async function getAllActiveLocationIds(): Promise<string[]> {
  const ids: string[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<Location>('locations', {
      filterExpression: 'active = :t',
      expressionValues: { ':t': true },
      exclusiveStartKey: lastKey,
    });
    for (const loc of result.items) ids.push(loc.locationId);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return ids;
}

async function ensureDailyConfig(date: string, templateConfig: DailyConfig | null, allLocationIds: string[]): Promise<void> {
  const existing = await getItem<DailyConfig>('daily-config', { date });

  if (existing) {
    const updates: string[] = [];
    const values: Record<string, unknown> = {};

    // Ensure resetSeq is set (generatePlayerAssignment requires it)
    if (existing.resetSeq == null) {
      updates.push('resetSeq = :seq');
      values[':seq'] = 1;
    }
    // Populate activeLocationIds if empty
    if (!existing.activeLocationIds || existing.activeLocationIds.length === 0) {
      const locationIds = templateConfig?.activeLocationIds?.length
        ? templateConfig.activeLocationIds
        : allLocationIds;
      updates.push('activeLocationIds = :locs');
      values[':locs'] = locationIds;
    }
    // Always ensure quiet mode is off for assigned dates
    if (existing.quietMode !== false) {
      updates.push('quietMode = :qm');
      values[':qm'] = false;
    }

    if (updates.length > 0) {
      await updateItem(
        'daily-config',
        { date },
        `SET ${updates.join(', ')}`,
        values,
      );
      console.log(`  [daily-config] Updated for ${date}: ${updates.join(', ')}`);
    } else {
      console.log(`  [daily-config] Already exists for ${date} (resetSeq=${existing.resetSeq}, ${existing.activeLocationIds.length} locations)`);
    }
    return;
  }

  // Create a new daily-config for this date
  const activeLocationIds = templateConfig?.activeLocationIds?.length
    ? templateConfig.activeLocationIds
    : allLocationIds;

  const targetSpace = templateConfig?.targetSpace ?? {
    name: 'Presentation Demo',
    description: 'Demo day target space',
    mapOverlayId: 'demo',
  };

  const config: DailyConfig = {
    date,
    activeLocationIds,
    targetSpace,
    qrSecret: crypto.randomBytes(16).toString('hex'),
    winnerClan: null,
    status: DailyConfigStatus.Active,
    resetSeq: 1,
    quietMode: false,
  };

  await putItem('daily-config', config as unknown as Record<string, unknown>);
  console.log(`  [daily-config] Created for ${date} with ${activeLocationIds.length} locations`);
}

async function assignForDate(userId: string, date: string, activeSpaceIds: string[]): Promise<void> {
  const dateUserId = `${date}#${userId}`;

  // Delete existing player-assignment so we can regenerate fresh
  try {
    await deleteItem('player-assignments', { dateUserId });
    console.log(`  Deleted existing player-assignment`);
  } catch { /* didn't exist */ }

  // Generate player assignment (location minigames)
  const pa = await generatePlayerAssignment(userId, date);
  console.log(`  Locations (${pa.assignedLocationIds.length}): ${pa.assignedLocationIds.join(', ')}`);
  console.log(`  Co-op slots (${pa.coopLocationIds?.length ?? 0}): ${(pa.coopLocationIds ?? []).join(', ')}`);

  // Delete existing space-assignment
  try {
    await deleteItem('space-assignments', { dateUserId });
    console.log(`  Deleted existing space-assignment`);
  } catch { /* didn't exist */ }

  // Generate space assignment
  if (activeSpaceIds.length > 0) {
    const sa = await generateSpaceAssignment(userId, date, activeSpaceIds);
    console.log(`  Spaces (${sa.assignedSpaceIds.length}): ${sa.assignedSpaceIds.join(', ')}`);
  } else {
    console.log(`  No active spaces — skipping space assignment`);
  }
}

async function main() {
  const { email, fromDate, toDate } = parseArgs();
  const today = getTodayISTString();

  const dates = eachDayOfInterval({
    start: parseISO(fromDate),
    end:   parseISO(toDate),
  }).map((d) => format(d, 'yyyy-MM-dd'));

  console.log(`Target:  ${email}`);
  console.log(`Dates:   ${dates.join(', ')}\n`);

  // 1. Look up user
  const { items } = await scan<User>('users', {
    filterExpression: 'email = :email',
    expressionValues: { ':email': email },
  });
  if (items.length === 0) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }
  const user = items[0];
  console.log(`User: ${user.displayName ?? user.email} (${user.userId}), clan: ${user.clan}\n`);

  // 2. Load today's config as template for future days
  const templateConfig = (await getItem<DailyConfig>('daily-config', { date: today })) ?? null;
  if (templateConfig) {
    console.log(`Today's config: ${templateConfig.activeLocationIds.length} active locations`);
  } else {
    console.log(`No daily-config for today — will use all active locations for all 3 days`);
  }

  // 3. Load all active location IDs as fallback
  const allLocationIds = await getAllActiveLocationIds();
  console.log(`All active locations in DB: ${allLocationIds.length}\n`);

  if (allLocationIds.length === 0) {
    console.error('No active locations found in DB. Seed locations first.');
    process.exit(1);
  }

  // 4. Load active space IDs once
  const activeSpaceIds = await getActiveSpaceIds();
  console.log(`Active spaces: ${activeSpaceIds.length}\n`);

  // 5. Process each date
  for (const date of dates) {
    console.log(`=== ${date} ===`);
    await ensureDailyConfig(date, templateConfig, allLocationIds);
    await assignForDate(user.userId, date, activeSpaceIds);
    console.log();
  }

  console.log(`Done! ${dates.length} day(s) assigned.`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
