import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { query, scan } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { User, PlayerSearchResult } from '../../shared/types';

// Matches GRV-XXXX / GRV-XXXXX codes, or any 8-character alphanumeric string (bare player code)
const PLAYER_CODE_PATTERN = /^(grv-\d{4,5}|[a-z0-9]{8})$/i;
const MAX_RESULTS = 10;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);
    const q = (event.queryStringParameters?.q ?? '').trim();

    if (!q || q.length < 2) {
      return error(ErrorCode.VALIDATION_ERROR, 'Search query must be at least 2 characters', 400);
    }

    let players: PlayerSearchResult[] = [];

    if (PLAYER_CODE_PATTERN.test(q)) {
      // Exact playerCode lookup via PlayerCodeIndex GSI — O(1), no scan
      const code = q.toLowerCase();
      const { items } = await query<User>(
        'users',
        'playerCode = :code',
        { ':code': code },
        { indexName: 'PlayerCodeIndex', limit: MAX_RESULTS },
      );
      players = items
        .filter((u) => u.userId !== userId && u.playerCode)
        .slice(0, MAX_RESULTS)
        .map((u) => ({
          userId: u.userId,
          displayName: u.displayName,
          playerCode: u.playerCode,
          clan: u.clan,
        }));
    } else {
      // Display name search — server-side FilterExpression with Limit caps scan cost
      const { items } = await scan<User>('users', {
        filterExpression: 'contains(displayName, :q)',
        expressionValues: { ':q': q },
        limit: 50,
      });

      players = items
        .filter((u) => u.userId !== userId && u.playerCode)
        .slice(0, MAX_RESULTS)
        .map((u) => ({
          userId: u.userId,
          displayName: u.displayName,
          playerCode: u.playerCode,
          clan: u.clan,
        }));
    }

    return success({ players });
  } catch (err) {
    console.error('searchPlayer error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Search failed', 500);
  }
};
