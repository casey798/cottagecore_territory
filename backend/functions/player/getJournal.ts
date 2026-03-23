import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { toZonedTime, format } from 'date-fns-tz';
import { extractUserId } from '../../shared/auth';
import { getItem, query, tableName } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { GameSession, Location, PlayerAssignment, PlayerLock } from '../../shared/types';
import { DynamoDBDocumentClient, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const STAGE = process.env.STAGE || 'dev';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const IST_TIMEZONE = 'Asia/Kolkata';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    // Compute today's IST date
    const istNow = toZonedTime(new Date(), IST_TIMEZONE);
    const todayIST = format(istNow, 'yyyy-MM-dd', { timeZone: IST_TIMEZONE });

    // Validate optional date param
    const dateParam = event.queryStringParameters?.date;
    let targetDate = todayIST;

    if (dateParam) {
      if (!DATE_REGEX.test(dateParam)) {
        return error(ErrorCode.VALIDATION_ERROR, 'Invalid date format. Use YYYY-MM-DD', 400);
      }
      if (dateParam > todayIST) {
        return error(ErrorCode.VALIDATION_ERROR, 'Cannot query future dates', 400);
      }
      targetDate = dateParam;
    }

    // Fetch player assignment
    const assignment = await getItem<PlayerAssignment>('player-assignments', {
      dateUserId: `${targetDate}#${userId}`,
    });

    if (!assignment) {
      return success({ date: targetDate, totalXp: 0, locations: [] });
    }

    const assignedLocationIds = assignment.assignedLocationIds;
    if (!assignedLocationIds || assignedLocationIds.length === 0) {
      return success({ date: targetDate, totalXp: 0, locations: [] });
    }

    // Fetch game sessions via GSI
    const { items: sessions } = await query<GameSession>(
      'game-sessions',
      'userId = :uid AND #date = :date',
      { ':uid': userId, ':date': targetDate },
      {
        indexName: 'UserDateIndex',
        expressionNames: { '#date': 'date' },
      }
    );

    // Build map: locationId → best session (latest completedAt)
    const sessionByLocation = new Map<string, GameSession>();
    for (const session of sessions) {
      if (session.practiceSession) continue;
      const existing = sessionByLocation.get(session.locationId);
      if (!existing) {
        sessionByLocation.set(session.locationId, session);
      } else if (
        session.completedAt &&
        (!existing.completedAt || session.completedAt > existing.completedAt)
      ) {
        sessionByLocation.set(session.locationId, session);
      }
    }

    // BatchGetItem locations
    const locationsTableName = `grovewars-${STAGE}-locations`;
    const locationKeys = assignedLocationIds.map((id) => ({ locationId: id }));
    const locationMap = new Map<string, { name: string; category: string }>();

    if (locationKeys.length > 0) {
      const batchResult = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [locationsTableName]: { Keys: locationKeys },
          },
        })
      );
      const locationItems = batchResult.Responses?.[locationsTableName] ?? [];
      for (const loc of locationItems) {
        const l = loc as Location;
        locationMap.set(l.locationId, { name: l.name, category: l.category });
      }
    }

    // BatchGetItem player-locks
    const locksTableName = `grovewars-${STAGE}-player-locks`;
    const lockKeys = assignedLocationIds.map((id) => ({
      dateUserLocation: `${targetDate}#${userId}#${id}`,
    }));
    const lockedIds = new Set<string>();

    if (lockKeys.length > 0) {
      const lockResult = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [locksTableName]: { Keys: lockKeys },
          },
        })
      );
      const lockItems = lockResult.Responses?.[locksTableName] ?? [];
      for (const lock of lockItems) {
        const pl = lock as PlayerLock;
        // Extract locationId from the composite key: "date#userId#locationId"
        const parts = pl.dateUserLocation.split('#');
        if (parts.length >= 3) {
          lockedIds.add(parts.slice(2).join('#'));
        }
      }
    }

    // Build journal entries
    const locations = assignedLocationIds.map((locationId) => {
      const locInfo = locationMap.get(locationId);
      const session = sessionByLocation.get(locationId);
      const isLocked = lockedIds.has(locationId);

      let status: 'won' | 'lost' | 'locked' | 'pending';
      let xpEarned = 0;

      if (session && session.result === 'win') {
        status = 'won';
        xpEarned = session.xpEarned;
      } else if (session && (session.result === 'lose' || session.result === 'timeout')) {
        status = 'lost';
      } else if (isLocked) {
        status = 'locked';
      } else {
        status = 'pending';
      }

      return {
        locationId,
        name: locInfo?.name ?? 'Unknown',
        category: locInfo?.category ?? 'other',
        status,
        xpEarned,
        minigameId: session?.minigameId ?? null,
        completedAt: session?.completedAt ?? null,
        coopPartnerId: session?.coopPartnerId ?? null,
      };
    });

    const totalXp = locations.reduce((sum, l) => sum + l.xpEarned, 0);

    return success({ date: targetDate, totalXp, locations });
  } catch (err) {
    console.error('getJournal error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get journal', 500);
  }
};
