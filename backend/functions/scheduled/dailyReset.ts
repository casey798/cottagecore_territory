import { ScheduledEvent } from 'aws-lambda';
import { getItem, putItem, scan, updateItem, batchWrite, deleteItem } from '../../shared/db';
import { getTodayISTString, toISTString } from '../../shared/time';
import { sendToAll } from '../../shared/notifications';
import { assignLocationsForAllPlayers } from '../../shared/locationAssignment';
import { User, DailyConfig, Clan, ClanId, DailyConfigStatus, PlayerAssignment, PlayerLock, WsConnection } from '../../shared/types';
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

  // Step 3: Reset all 5 clans: todayXp = 0, clear todayXpTimestamp
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

  console.log('Daily reset complete');
  } catch (err) {
    console.error('Daily reset failed:', err);
    throw err;
  }
};
