import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScheduledEvent } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';

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
        const { handler: dailyResetHandler } = await import('../scheduled/dailyReset');
        await dailyResetHandler(fakeScheduledEvent);
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
