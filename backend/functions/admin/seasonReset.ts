import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { seasonResetSchema } from '../../shared/schemas';
import { scan, updateItem } from '../../shared/db';
import type { User, Clan, CapturedSpace } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const claims = event.requestContext.authorizer?.claims;
    if (!claims) return error(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    const groups: string[] = (claims['cognito:groups'] as string || '').split(',').filter(Boolean);
    if (!groups.some((g) => g.toLowerCase() === 'admin')) return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);

    // Validate input
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const parsed = seasonResetSchema.safeParse(body);
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { resetTerritories, newSeasonNumber } = parsed.data;

    // Reset all users
    let usersReset = 0;
    let lastUserKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<User>('users', {
        exclusiveStartKey: lastUserKey,
      });
      for (const user of result.items) {
        await updateItem(
          'users',
          { userId: user.userId },
          'SET seasonXp = :zero, todayXp = :zero, currentStreak = :zero, bestStreak = :zero',
          { ':zero': 0 }
        );
        usersReset++;
      }
      lastUserKey = result.lastEvaluatedKey;
    } while (lastUserKey);

    // Reset all clans
    let clansReset = 0;
    let lastClanKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<Clan>('clans', {
        exclusiveStartKey: lastClanKey,
      });
      for (const clan of result.items) {
        await updateItem(
          'clans',
          { clanId: clan.clanId },
          'SET todayXp = :zero, seasonXp = :zero, spacesCaptured = :zero REMOVE todayXpTimestamp',
          { ':zero': 0 }
        );
        clansReset++;
      }
      lastClanKey = result.lastEvaluatedKey;
    } while (lastClanKey);

    // Reset territories if requested
    let territoriesReset = 0;
    if (resetTerritories) {
      let lastSpaceKey: Record<string, unknown> | undefined;
      do {
        const result = await scan<CapturedSpace>('captured-spaces', {
          exclusiveStartKey: lastSpaceKey,
        });
        for (const space of result.items) {
          await updateItem(
            'captured-spaces',
            { spaceId: space.spaceId },
            'SET season = :prevSeason',
            { ':prevSeason': String(newSeasonNumber - 1) }
          );
          territoriesReset++;
        }
        lastSpaceKey = result.lastEvaluatedKey;
      } while (lastSpaceKey);
    }

    return success({
      message: 'Season reset completed',
      usersReset,
      clansReset,
      territoriesReset,
      newSeasonNumber,
    });
  } catch (err) {
    console.error('seasonReset error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
