import { ScheduledEvent } from 'aws-lambda';
import { getItem, scan, updateItem, putItem } from '../../shared/db';
import { getTodayISTString, toISTString } from '../../shared/time';
import { sendToAll } from '../../shared/notifications';
import { User, DailyConfig, Clan, ClanId, DailyConfigStatus, CapturedSpace, WsConnection } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  try {
  const today = getTodayISTString();
  console.log(`Daily scoring running for: ${today}`);

  // Step 1: Set today's daily-config status to 'scoring'
  await updateItem(
    'daily-config',
    { date: today },
    'SET #status = :status',
    { ':status': DailyConfigStatus.Scoring },
    { '#status': 'status' }
  );

  // Step 2: Scan clans table
  const clansResult = await scan<Clan>('clans');
  const clans = clansResult.items;

  // Step 3: Determine winner with tiebreaker
  let winnerClan: Clan | null = null;

  for (const clan of clans) {
    if (!winnerClan) {
      winnerClan = clan;
      continue;
    }

    if (clan.todayXp > winnerClan.todayXp) {
      winnerClan = clan;
    } else if (clan.todayXp === winnerClan.todayXp) {
      // TIEBREAKER: earlier todayXpTimestamp wins
      // If a tied clan has no timestamp, they lose
      if (!winnerClan.todayXpTimestamp && clan.todayXpTimestamp) {
        winnerClan = clan;
      } else if (winnerClan.todayXpTimestamp && clan.todayXpTimestamp) {
        if (clan.todayXpTimestamp < winnerClan.todayXpTimestamp) {
          winnerClan = clan;
        }
      }
      // If both lack timestamps or winner has earlier, keep winner
    }
  }

  if (!winnerClan || winnerClan.todayXp === 0) {
    console.log('No clan earned XP today. No winner.');
    await updateItem(
      'daily-config',
      { date: today },
      'SET #status = :status',
      { ':status': DailyConfigStatus.Complete },
      { '#status': 'status' }
    );
    return;
  }

  console.log(`Winner: ${winnerClan.clanId} with ${winnerClan.todayXp} XP`);

  // Step 4: Get today's daily-config for targetSpace info
  const todayConfig = await getItem<DailyConfig>('daily-config', { date: today });
  if (!todayConfig) {
    console.error('No daily-config found for today');
    return;
  }

  // Step 5: Create captured-space record
  const capturedSpace: CapturedSpace = {
    spaceId: uuidv4(),
    dateCaptured: today,
    clan: winnerClan.clanId,
    spaceName: todayConfig.targetSpace.name,
    season: '1', // Current season
    mapOverlayId: todayConfig.targetSpace.mapOverlayId,
    polygonPoints: todayConfig.targetSpace.polygonPoints,
    gridCells: todayConfig.targetSpace.gridCells,
  };

  await putItem('captured-spaces', capturedSpace as unknown as Record<string, unknown>);
  console.log(`Created captured space: ${capturedSpace.spaceId}`);

  // Step 6: Update daily-config with winner and status
  await updateItem(
    'daily-config',
    { date: today },
    'SET winnerClan = :winner, #status = :status',
    { ':winner': winnerClan.clanId, ':status': DailyConfigStatus.Complete },
    { '#status': 'status' }
  );

  // Step 8: Send capture result push notification
  const clanName = winnerClan.clanId.charAt(0).toUpperCase() + winnerClan.clanId.slice(1);
  const delivered = await sendToAll({
    notification: {
      title: `${clanName} wins!`,
      body: `${clanName} has captured ${todayConfig.targetSpace.name}! See the updated map.`,
    },
    data: {
      type: 'CAPTURE_RESULT',
      winnerClan: winnerClan.clanId,
      spaceName: todayConfig.targetSpace.name,
    },
  });
  console.log(`Sent capture notifications: ${delivered} delivered`);

  // Step 9: Broadcast CAPTURE event via WebSocket
  try {
    const wsEndpoint = process.env.WEBSOCKET_API_ENDPOINT;
    if (wsEndpoint) {
      const apiGw = new ApiGatewayManagementApiClient({ endpoint: wsEndpoint });
      const connectionsResult = await scan<WsConnection>('ws-connections');
      const connections = connectionsResult.items;

      const payload = JSON.stringify({
        type: 'CAPTURE',
        data: {
          winnerClan: winnerClan.clanId,
          spaceName: todayConfig.targetSpace.name,
          mapOverlayId: todayConfig.targetSpace.mapOverlayId,
        },
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
      // Also broadcast SCORING_COMPLETE
      const scoringPayload = JSON.stringify({
        type: 'SCORING_COMPLETE',
        data: {
          winnerClan: winnerClan.clanId,
          spaceName: todayConfig.targetSpace.name,
          mapOverlayId: todayConfig.targetSpace.mapOverlayId,
        },
      });

      for (const conn of connections) {
        try {
          await apiGw.send(
            new PostToConnectionCommand({
              ConnectionId: conn.connectionId,
              Data: new TextEncoder().encode(scoringPayload),
            })
          );
        } catch (wsErr) {
          console.warn(`Failed to send SCORING_COMPLETE to ${conn.connectionId}:`, wsErr);
        }
      }
      console.log(`Broadcast CAPTURE + SCORING_COMPLETE to ${connections.length} connections`);
    }
  } catch (broadcastErr) {
    console.error('WebSocket broadcast failed (non-fatal):', broadcastErr);
  }

  // Step 10: Update streaks for all users
  const allUsers: User[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<User>('users', { exclusiveStartKey: lastKey });
    allUsers.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  const yesterdayDate = toISTString(addDays(toZonedTime(new Date(), 'Asia/Kolkata'), -1));

  for (const user of allUsers) {
    if (user.todayXp > 0) {
      // User played today - increment streak if lastActiveDate is not today
      if (user.lastActiveDate !== today) {
        const newStreak = user.currentStreak + 1;
        const newBest = Math.max(newStreak, user.bestStreak);
        await updateItem(
          'users',
          { userId: user.userId },
          'SET currentStreak = :streak, bestStreak = :best, lastActiveDate = :today',
          { ':streak': newStreak, ':best': newBest, ':today': today }
        );
      }
    } else if (user.todayXp === 0 && user.lastActiveDate === yesterdayDate) {
      // User didn't play today but played yesterday - reset streak
      await updateItem(
        'users',
        { userId: user.userId },
        'SET currentStreak = :zero',
        { ':zero': 0 }
      );
    }
  }

  console.log('Daily scoring complete');
  } catch (err) {
    console.error('Daily scoring failed:', err);
    throw err;
  }
};
