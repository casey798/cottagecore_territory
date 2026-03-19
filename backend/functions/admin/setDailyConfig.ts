import crypto from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { setDailyConfigSchema } from '../../shared/schemas';
import { getItem, putItem } from '../../shared/db';
import { DailyConfigStatus } from '../../shared/types';
import type { DailyConfig } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.log('[setDailyConfig] Incoming event body:', event.body);

    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);

    // Validate input
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    console.log('[setDailyConfig] Parsed body:', JSON.stringify(body));
    const parsed = setDailyConfigSchema.safeParse(body);
    if (!parsed.success) {
      console.error('[setDailyConfig] Validation failed:', parsed.error.message);
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { date, activeLocationIds, targetSpace, quietMode } = parsed.data;

    // Check if config already exists for this date — reuse qrSecret if so
    const existing = await getItem<DailyConfig>('daily-config', { date });
    const qrSecret = existing?.qrSecret ?? crypto.randomBytes(32).toString('hex');
    console.log('[setDailyConfig] qrSecret:', existing ? 'reused existing' : 'generated new');

    // Create daily config record, preserving existing qrCodes if present
    const dailyConfig: Record<string, unknown> = {
      date,
      activeLocationIds: activeLocationIds ?? [],
      targetSpace: targetSpace ?? null,
      qrSecret,
      winnerClan: null,
      status: DailyConfigStatus.Active,
      quietMode: quietMode ?? false,
    };

    if (existing && (existing as unknown as Record<string, unknown>).qrCodes) {
      dailyConfig.qrCodes = (existing as unknown as Record<string, unknown>).qrCodes;
    }

    console.log('[setDailyConfig] Writing to DynamoDB:', JSON.stringify(dailyConfig));
    await putItem<Record<string, unknown>>('daily-config', dailyConfig);
    console.log('[setDailyConfig] Write successful for date:', date);

    return success({
      date,
      qrSecret,
      status: DailyConfigStatus.Active,
    });
  } catch (err) {
    console.error('[setDailyConfig] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
