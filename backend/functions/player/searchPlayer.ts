import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { query, scan } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { User, PlayerSearchResult } from '../../shared/types';

const PLAYER_CODE_PATTERN = /^grv-\d{4,5}$/i;
const MAX_RESULTS = 5;

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
      // Exact playerCode lookup via GSI
      const code = q.toLowerCase();
      const { items } = await query<User>(
        'users',
        'playerCode = :code',
        { ':code': code },
        { indexName: 'PlayerCodeIndex', limit: 1 },
      );
      players = items
        .filter((u) => u.userId !== userId && u.playerCode)
        .map((u) => ({
          userId: u.userId,
          displayName: u.displayName,
          playerCode: u.playerCode,
          clan: u.clan,
        }));
    } else {
      // Display name search — scan without server-side filter (contains is case-sensitive)
      const searchLower = q.toLowerCase();
      const { items } = await scan<User>('users', {
        limit: 50,
      });

      // All filtering done client-side for case-insensitive matching
      players = items
        .filter((u) => u.userId !== userId && u.playerCode && u.displayName.toLowerCase().includes(searchLower))
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
