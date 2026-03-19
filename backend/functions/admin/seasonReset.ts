import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { seasonResetSchema } from '../../shared/schemas';
import { scan, updateItem, putItem, getItem } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { User, Clan, CapturedSpace } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);

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

    // Update season metadata
    const today = getTodayISTString();

    // Close previous season
    const prevMeta = await getItem<Record<string, unknown>>('daily-config', { date: 'season-meta' });
    if (prevMeta && !prevMeta.seasonEndDate) {
      await updateItem(
        'daily-config',
        { date: 'season-meta' },
        'SET seasonEndDate = :endDate, seasonStatus = :status',
        { ':endDate': today, ':status': 'complete' },
      );
    }

    // Write new season metadata
    await putItem('daily-config', {
      date: 'season-meta',
      seasonNumber: newSeasonNumber,
      seasonStartDate: today,
      seasonEndDate: null,
      seasonStatus: 'active',
      totalPlayers: usersReset,
    } as unknown as Record<string, unknown>);

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
