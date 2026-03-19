import { ScheduledEvent } from 'aws-lambda';
import { getItem, putItem, scan, updateItem, batchWrite, deleteItem } from '../../shared/db';
import { getTodayISTString, toISTString } from '../../shared/time';
import { sendToAll } from '../../shared/notifications';
import { assignLocationsForAllPlayers } from '../../shared/locationAssignment';
import { User, DailyConfig, Clan, ClanId, DailyConfigStatus, GameSession, LocationMasterConfig, PlayerAssignment, PlayerLock, WsConnection } from '../../shared/types';
import { addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

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

  // Step 2b: Reset streaks for users who missed yesterday
  const yesterdayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let streaksReset = 0;
  for (const user of allUsers) {
    if (user.lastActiveDate && user.lastActiveDate !== yesterdayIST) {
      await updateItem(
        'users',
        { userId: user.userId },
        'SET currentStreak = :zero',
        { ':zero': 0 }
      );
      streaksReset++;
    }
  }
  console.log(`Reset ${streaksReset} user streaks (missed ${yesterdayIST})`);

  // Step 3: Reset all 5 clans: todayXp = 0, clear todayXpTimestamp
  const clanIds = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];
  for (const clanId of clanIds) {
    await updateItem(
      'clans',
      { clanId },
      'SET todayXp = :zero, todayParticipants = :zero REMOVE todayXpTimestamp',
      { ':zero': 0 }
    );
  }
  console.log('Reset all clan daily XP');

  // Step 4: Explicitly delete yesterday's player-locks (TTL can lag up to 48h)
  const lockPrefix = `${yesterdayDate}#`;
  let lockLastKey: Record<string, unknown> | undefined;
  let locksDeleted = 0;
  do {
    const lockResult = await scan<PlayerLock>('player-locks', {
      filterExpression: 'begins_with(dateUserLocation, :prefix)',
      expressionValues: { ':prefix': lockPrefix },
      exclusiveStartKey: lockLastKey,
    });
    for (const lock of lockResult.items) {
      await deleteItem('player-locks', { dateUserLocation: lock.dateUserLocation });
      locksDeleted++;
    }
    lockLastKey = lockResult.lastEvaluatedKey;
  } while (lockLastKey);
  console.log(`Deleted ${locksDeleted} yesterday's player-locks`);

  // Step 5: Generate player location assignments for today
  const todayConfig = await getItem<DailyConfig>('daily-config', { date: today });
  if (todayConfig && todayConfig.activeLocationIds.length > 0) {
    const count = await assignLocationsForAllPlayers(today, todayConfig.activeLocationIds);
    console.log(`Created ${count} player assignments`);
  } else {
    console.warn('No daily-config found for today or no active locations');
  }

  // Step 5b: Write resetSeq to today's daily-config for foreground-poll detection
  const resetSeq = Date.now();
  if (todayConfig) {
    await updateItem(
      'daily-config',
      { date: today },
      'SET resetSeq = :seq',
      { ':seq': resetSeq }
    );
    console.log(`Set resetSeq=${resetSeq} on daily-config for ${today}`);
  }

  // Step 6: Send day-start push notification
  if (todayConfig?.targetSpace) {
    const delivered = await sendToAll({
      notification: {
        title: 'A new day dawns!',
        body: `Today's prize: ${todayConfig.targetSpace.name}. Go claim it!`,
      },
      data: {
        type: 'DAY_START',
        targetSpace: todayConfig.targetSpace.name,
        date: today,
      },
    });
    console.log(`Sent day-start notifications: ${delivered} delivered`);
  }

  // Step 7: Broadcast DAILY_RESET event via WebSocket
  try {
    const wsEndpoint = process.env.WEBSOCKET_API_ENDPOINT;
    if (wsEndpoint) {
      const apiGw = new ApiGatewayManagementApiClient({ endpoint: wsEndpoint });
      const connectionsResult = await scan<WsConnection>('ws-connections');
      const connections = connectionsResult.items;

      const payload = JSON.stringify({
        type: 'DAILY_RESET',
        data: { date: today, resetSeq },
      });

      for (const conn of connections) {
        try {
          await apiGw.send(
            new PostToConnectionCommand({
              ConnectionId: conn.connectionId,
              Data: new TextEncoder().encode(payload),
            })
          );
        } catch (wsErr) {
          console.warn(`Failed to send to connection ${conn.connectionId}:`, wsErr);
        }
      }
      console.log(`Broadcast DAILY_RESET to ${connections.length} connections`);
    }
  } catch (broadcastErr) {
    console.error('WebSocket broadcast failed (non-fatal):', broadcastErr);
  }

  // Step 8: Revert bonusXP on all LocationMasterConfig records (Dead Zone Revival auto-clear)
  try {
    const boostedLocations: LocationMasterConfig[] = [];
    let bmLastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<LocationMasterConfig>('location-master-config', {
        filterExpression: 'bonusXP = :true',
        expressionValues: { ':true': true },
        exclusiveStartKey: bmLastKey,
      });
      boostedLocations.push(...result.items);
      bmLastKey = result.lastEvaluatedKey;
    } while (bmLastKey);

    if (boostedLocations.length > 0) {
      for (const loc of boostedLocations) {
        await updateItem(
          'location-master-config',
          { locationId: loc.locationId },
          'SET bonusXP = :false',
          { ':false': false }
        );
      }
      console.log(`bonusXP reverted on ${boostedLocations.length} locations`);
    } else {
      console.log('No locations with bonusXP to revert');
    }
  } catch (bonusErr) {
    console.error('bonusXP revert failed (non-fatal):', bonusErr);
  }

  // Step 9: Update rolling 3-day visit counts for all locations
  try {
    // Fetch all LocationMasterConfig records
    const allMasterLocations: LocationMasterConfig[] = [];
    let mlLastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<LocationMasterConfig>('location-master-config', {
        exclusiveStartKey: mlLastKey,
      });
      allMasterLocations.push(...result.items);
      mlLastKey = result.lastEvaluatedKey;
    } while (mlLastKey);

    // Query yesterday's game sessions (scan with filter — 30 locations × small count is acceptable)
    const allYesterdaySessions: GameSession[] = [];
    let gsLastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<GameSession>('game-sessions', {
        filterExpression: '#d = :yesterday',
        expressionValues: { ':yesterday': yesterdayDate },
        expressionNames: { '#d': 'date' },
        exclusiveStartKey: gsLastKey,
      });
      allYesterdaySessions.push(...result.items);
      gsLastKey = result.lastEvaluatedKey;
    } while (gsLastKey);

    // Count sessions per locationId
    const visitCounts = new Map<string, number>();
    for (const session of allYesterdaySessions) {
      visitCounts.set(session.locationId, (visitCounts.get(session.locationId) ?? 0) + 1);
    }

    // Update all locations in parallel
    const visitSummary: string[] = [];
    await Promise.all(
      allMasterLocations.map(async (loc) => {
        const yesterdayVisits = visitCounts.get(loc.locationId) ?? 0;
        const oldVisits = loc.last3DaysVisits ?? [0, 0, 0];
        const newVisits: [number, number, number] = [
          yesterdayVisits,
          oldVisits[0],
          oldVisits[1],
        ];

        await updateItem(
          'location-master-config',
          { locationId: loc.locationId },
          'SET last3DaysVisits = :visits',
          { ':visits': newVisits }
        );

        if (yesterdayVisits > 0) {
          visitSummary.push(`#${loc.qrNumber}: ${yesterdayVisits}`);
        }
      })
    );

    console.log(
      `Visit counts updated for ${allMasterLocations.length} locations. Yesterday's totals: [${visitSummary.join(', ') || 'none'}]`
    );
  } catch (visitErr) {
    console.error('Visit count update failed (non-fatal):', visitErr);
  }

  console.log('Daily reset complete');
  } catch (err) {
    console.error('Daily reset failed:', err);
    throw err;
  }
};
