import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { assignLocationsForAllPlayers } from '../../shared/locationAssignment';
import { DailyConfig } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const today = getTodayISTString();

    // Read today's daily config
    const config = await getItem<DailyConfig>('daily-config', { date: today });
    if (!config) {
      return error(ErrorCode.NOT_FOUND, 'No daily config found for today. Save config first.', 404);
    }

    if (config.activeLocationIds.length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'No active locations in today\'s config', 400);
    }

    // Reassign all players
    const assignedCount = await assignLocationsForAllPlayers(today, config.activeLocationIds);

    console.log(`[applyDailyConfig] Reassigned ${assignedCount} players for ${today}`);

    return success({
      date: today,
      assignedPlayerCount: assignedCount,
      activeLocationCount: config.activeLocationIds.length,
    });
  } catch (err) {
    console.error('[applyDailyConfig] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to apply daily config', 500);
  }
}
