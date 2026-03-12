import { ScheduledEvent } from 'aws-lambda';
import { getItem, putItem, scan, updateItem, batchWrite } from '../../shared/db';
import { getTodayISTString, toISTString } from '../../shared/time';
import { sendToTokens } from '../../shared/notifications';
import { assignLocationsForAllPlayers } from '../../shared/locationAssignment';
import { User, DailyConfig, Clan, ClanId, DailyConfigStatus, PlayerAssignment } from '../../shared/types';
import { addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  try {
  const today = getTodayISTString();
  const yesterdayDate = toISTString(addDays(toZonedTime(new Date(), 'Asia/Kolkata'), -1));

  console.log(`Daily reset running. Today: ${today}, Yesterday: ${yesterdayDate}`);

  // Step 1: Set yesterday's daily-config status to 'complete' if not already
  const yesterdayConfig = await getItem<DailyConfig>('daily-config', { date: yesterdayDate });
  if (yesterdayConfig && yesterdayConfig.status !== DailyConfigStatus.Complete) {
    await updateItem(
      'daily-config',
      { date: yesterdayDate },
      'SET #status = :status',
      { ':status': DailyConfigStatus.Complete },
      { '#status': 'status' }
    );
    console.log(`Set yesterday's config (${yesterdayDate}) to complete`);
  }

  // Step 2: Scan all users, reset todayXp to 0
  const allUsers: User[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<User>('users', { exclusiveStartKey: lastKey });
    allUsers.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  console.log(`Found ${allUsers.length} users to reset`);

  for (const user of allUsers) {
    await updateItem(
      'users',
      { userId: user.userId },
      'SET todayXp = :zero',
      { ':zero': 0 }
    );
  }

  // Step 3: Reset all 4 clans: todayXp = 0, clear todayXpTimestamp
  const clanIds = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];
  for (const clanId of clanIds) {
    await updateItem(
      'clans',
      { clanId },
      'SET todayXp = :zero REMOVE todayXpTimestamp',
      { ':zero': 0 }
    );
  }
  console.log('Reset all clan daily XP');

  // Step 4: Player locks auto-expire via TTL (no action needed)

  // Step 5: Generate player location assignments for today
  const todayConfig = await getItem<DailyConfig>('daily-config', { date: today });
  if (todayConfig && todayConfig.activeLocationIds.length > 0) {
    const count = await assignLocationsForAllPlayers(today, todayConfig.activeLocationIds);
    console.log(`Created ${count} player assignments`);
  } else {
    console.warn('No daily-config found for today or no active locations');
  }

  // Step 6: Send push notification about today's prize
  if (todayConfig?.targetSpace) {
    const tokens = allUsers
      .map((u) => u.fcmToken)
      .filter((t): t is string => !!t);

    if (tokens.length > 0) {
      const result = await sendToTokens(
        tokens,
        'A new day dawns!',
        `Today's prize: ${todayConfig.targetSpace.name}`,
        { type: 'DAILY_RESET', date: today }
      );
      console.log(`Sent daily reset notifications: ${result.sent} delivered`);
    }
  }

  console.log('Daily reset complete');
  } catch (err) {
    console.error('Daily reset failed:', err);
    throw err;
  }
};
