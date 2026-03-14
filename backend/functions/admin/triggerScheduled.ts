import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScheduledEvent } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, scan, updateItem, deleteItem } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { assignLocationsForAllPlayers } from '../../shared/locationAssignment';
import { User, DailyConfig, ClanId, DailyConfigStatus, PlayerLock, GameSession, WsConnection } from '../../shared/types';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

type JobType =
  | 'daily_reset'
  | 'daily_scoring'
  | 'event_morning'
  | 'event_lunch'
  | 'event_final'
  | 'asset_expiry'
  | 'asset_expiry_warning';

const VALID_JOBS: JobType[] = [
  'daily_reset',
  'daily_scoring',
  'event_morning',
  'event_lunch',
  'event_final',
  'asset_expiry',
  'asset_expiry_warning',
];

// Fake ScheduledEvent to satisfy handler signatures
const fakeScheduledEvent: ScheduledEvent = {
  version: '0',
  id: 'debug-trigger',
  'detail-type': 'Scheduled Event',
  source: 'admin.debug',
  account: '',
  time: new Date().toISOString(),
  region: process.env.AWS_REGION || 'ap-south-1',
  resources: [],
  detail: {},
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer || authorizer.isAdmin !== 'true') {
    return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
  }

  const body = JSON.parse(event.body || '{}');
  const job = body.job as JobType;

  if (!job || !VALID_JOBS.includes(job)) {
    return error(
      ErrorCode.VALIDATION_ERROR,
      `Invalid job. Must be one of: ${VALID_JOBS.join(', ')}`,
      400
    );
  }

  const executedAt = new Date().toISOString();
  let summary = '';

  // Capture console.log output to build summary
  const logs: string[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args: unknown[]) => {
    const msg = args.map(String).join(' ');
    logs.push(msg);
    originalLog.apply(console, args);
  };
  console.warn = (...args: unknown[]) => {
    const msg = args.map(String).join(' ');
    logs.push(`[warn] ${msg}`);
    originalWarn.apply(console, args);
  };

  try {
    switch (job) {
      case 'daily_reset': {
        const today = getTodayISTString();
        console.log(`Daily reset running. Today: ${today}`);

        // Step 1: Zero todayXp for all users
        const allUsers: User[] = [];
        let userLastKey: Record<string, unknown> | undefined;
        do {
          const result = await scan<User>('users', { exclusiveStartKey: userLastKey });
          allUsers.push(...result.items);
          userLastKey = result.lastEvaluatedKey;
        } while (userLastKey);

        console.log(`Found ${allUsers.length} users to reset`);
        for (const user of allUsers) {
          await updateItem(
            'users',
            { userId: user.userId },
            'SET todayXp = :zero',
            { ':zero': 0 }
          );
        }

        // Step 2: Zero todayXp for all 5 clans, clear todayXpTimestamp
        const clanIds = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];
        for (const clanId of clanIds) {
          await updateItem(
            'clans',
            { clanId },
            'SET todayXp = :zero, spacesCaptured = :zero REMOVE todayXpTimestamp',
            { ':zero': 0 }
          );
        }
        console.log('Reset all clan daily XP and spacesCaptured');

        // Step 3: Delete all player-locks for today's date
        const lockPrefix = `${today}#`;
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
        console.log(`Deleted ${locksDeleted} player-locks for today`);

        // Step 3b: Delete all game-sessions for today's date
        let sessionLastKey: Record<string, unknown> | undefined;
        let sessionsDeleted = 0;
        do {
          const sessionResult = await scan<GameSession>('game-sessions', {
            filterExpression: '#d = :today',
            expressionValues: { ':today': today },
            expressionNames: { '#d': 'date' },
            exclusiveStartKey: sessionLastKey,
          });
          for (const session of sessionResult.items) {
            await deleteItem('game-sessions', { sessionId: session.sessionId });
            sessionsDeleted++;
          }
          sessionLastKey = sessionResult.lastEvaluatedKey;
        } while (sessionLastKey);
        console.log(`Deleted ${sessionsDeleted} game-sessions for today`);

        // Step 4: Generate new player assignments from today's activeLocationIds
        const todayConfig = await getItem<DailyConfig>('daily-config', { date: today });
        if (todayConfig && todayConfig.activeLocationIds.length > 0) {
          const count = await assignLocationsForAllPlayers(today, todayConfig.activeLocationIds);
          console.log(`Created ${count} player assignments`);
        } else {
          console.warn('No daily-config found for today or no active locations');
        }

        // Step 5: Write resetSeq and status "active" into today's daily-config
        const resetSeq = Date.now();
        if (todayConfig) {
          await updateItem(
            'daily-config',
            { date: today },
            'SET resetSeq = :seq, #status = :status',
            { ':seq': resetSeq, ':status': DailyConfigStatus.Active },
            { '#status': 'status' }
          );
          console.log(`Set resetSeq=${resetSeq}, status=active on daily-config for ${today}`);
        }

        // Step 6: Broadcast DAILY_RESET via WebSocket to all connected clients
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
        summary = logs.join(' | ');
        break;
      }
      case 'daily_scoring': {
        const { handler: dailyScoringHandler } = await import('../scheduled/dailyScoring');
        await dailyScoringHandler(fakeScheduledEvent);
        summary = logs.join(' | ');
        break;
      }
      case 'event_morning': {
        process.env.WINDOW = 'morning';
        const { handler: eventHandler } = await import('../scheduled/eventWindowNotifications');
        await eventHandler(fakeScheduledEvent);
        summary = logs.join(' | ');
        break;
      }
      case 'event_lunch': {
        process.env.WINDOW = 'lunch';
        const { handler: eventHandler } = await import('../scheduled/eventWindowNotifications');
        await eventHandler(fakeScheduledEvent);
        summary = logs.join(' | ');
        break;
      }
      case 'event_final': {
        process.env.WINDOW = 'final';
        const { handler: eventHandler } = await import('../scheduled/eventWindowNotifications');
        await eventHandler(fakeScheduledEvent);
        summary = logs.join(' | ');
        break;
      }
      case 'asset_expiry': {
        const { handler: assetExpiryHandler } = await import('../scheduled/assetExpiry');
        await assetExpiryHandler(fakeScheduledEvent);
        summary = logs.join(' | ');
        break;
      }
      case 'asset_expiry_warning': {
        const { handler: assetExpiryWarningHandler } = await import('../scheduled/assetExpiryWarning');
        await assetExpiryWarningHandler(fakeScheduledEvent);
        summary = logs.join(' | ');
        break;
      }
    }

    return success({ job, summary, executedAt });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('triggerScheduled error:', err);
    return error(ErrorCode.INTERNAL_ERROR, `Job "${job}" failed: ${errorMsg}`, 500);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}
