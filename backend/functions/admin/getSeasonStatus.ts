import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem } from '../../shared/db';

interface SeasonMeta {
  date: string; // PK = "season-meta"
  seasonNumber: number;
  seasonStartDate: string;
  seasonEndDate: string | null;
  seasonStatus: 'active' | 'complete';
  totalPlayers: number;
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const meta = await getItem<SeasonMeta>('daily-config', { date: 'season-meta' });

    if (!meta) {
      // No season metadata yet — return defaults
      return success({
        seasonNumber: 1,
        seasonStartDate: null,
        seasonEndDate: null,
        seasonStatus: 'active',
        totalPlayers: 0,
      });
    }

    return success({
      seasonNumber: meta.seasonNumber,
      seasonStartDate: meta.seasonStartDate,
      seasonEndDate: meta.seasonEndDate,
      seasonStatus: meta.seasonStatus,
      totalPlayers: meta.totalPlayers,
    });
  } catch (err) {
    console.error('[getSeasonStatus] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
