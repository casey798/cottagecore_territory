import { ScheduledEvent } from 'aws-lambda';
import { getItem, scan, updateItem, putItem } from '../../shared/db';
import { getTodayISTString, toISTString } from '../../shared/time';
import { sendToAll, sendToPlayer } from '../../shared/notifications';
import { User, DailyConfig, Clan, ClanId, DailyConfigStatus, CapturedSpace, WsConnection, SpaceAssignment } from '../../shared/types';
import { clanDisplayName } from '../../shared/clanLabels';
import { v4 as uuidv4 } from 'uuid';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { isQuietModeActive } from '../../shared/quietMode';

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  try {
  const today = getTodayISTString();
  console.log(`Daily scoring running for: ${today}`);

  // Quiet mode check — skip scoring entirely to avoid false captures from stale XP
  if (await isQuietModeActive()) {
    console.log(`Quiet mode active for ${today} — skipping scoring, streaks, and notifications`);
    return;
  }

  // Step 1: Set today's daily-config status to 'scoring'
  await updateItem(
    'daily-config',
    { date: today },
    'SET #status = :status',
    { ':status': DailyConfigStatus.Scoring },
    { '#status': 'status' }
  );

  // Step 2: Scan clans table (paginated)
  const clans: Clan[] = [];
  let clansLastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<Clan>('clans', { exclusiveStartKey: clansLastKey });
    clans.push(...result.items);
    clansLastKey = result.lastEvaluatedKey;
  } while (clansLastKey);

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

  // Build clan XP snapshot from the clan records we already read
  const clanXpSnapshot: Record<string, number> = {};
  let totalDayXp = 0;
  for (const clan of clans) {
    clanXpSnapshot[clan.clanId] = clan.todayXp;
    totalDayXp += clan.todayXp;
  }

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
    clanXpSnapshot,
    totalDayXp,
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

  // MODIFIED: territory capture notifications disabled in playtest version
  // const clanName = clanDisplayName(winnerClan.clanId);
  // const delivered = await sendToAll({
  //   notification: {
  //     title: `${clanName} wins!`,
  //     body: `${clanName} has captured ${todayConfig.targetSpace.name}! See the updated map.`,
  //   },
  //   data: {
  //     type: 'CAPTURE_RESULT',
  //     winnerClan: winnerClan.clanId,
  //     spaceName: todayConfig.targetSpace.name,
  //   },
  // });
  // console.log(`Sent capture notifications: ${delivered} delivered`);

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

  // Step 11: Per-player end-of-day recap notification
  try {
    console.log(`Sending end-of-day recap to ${allUsers.length} users`);
    let recapsSent = 0;
    const BATCH_SIZE = 25;
    for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
      const batch = allUsers.slice(i, i + BATCH_SIZE);
      for (const user of batch) {
        try {
          const todayXp = user.todayXp ?? 0;
          const spaceAssignment = await getItem<SpaceAssignment>('space-assignments', {
            dateUserId: `${today}#${user.userId}`,
          });
          const completedCount = spaceAssignment?.completedSpaceIds?.length ?? 0;
          const plural = completedCount === 1 ? '' : 's';
          await sendToPlayer(user.userId, {
            notification: {
              title: "Today's Grove Report \uD83C\uDF3F",
              body: `You earned ${todayXp} XP today and decorated ${completedCount} space${plural}. See you tomorrow!`,
            },
            data: {
              type: 'DAY_RECAP',
              xp: String(todayXp),
              spacesDecorated: String(completedCount),
            },
          });
          recapsSent++;
        } catch (userErr) {
          console.error(`Recap failed for user ${user.userId}:`, userErr);
        }
      }
    }
    console.log(`End-of-day recap sent to ${recapsSent}/${allUsers.length} users`);
  } catch (recapErr) {
    console.error('End-of-day recap failed (non-fatal):', recapErr);
  }

  console.log('Daily scoring complete');
  } catch (err) {
    console.error('Daily scoring failed:', err);
    throw err;
  }
};
