import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import type { User } from '../../shared/types';

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

const CSV_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'text/csv',
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const allItems: User[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<User>('users', { exclusiveStartKey: lastKey });
      allItems.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    const header = 'userId,email,displayName,clan,seasonXp,totalWins,currentStreak,bestStreak,lastActiveDate,tutorialDone,createdAt,phase1Cluster';
    const rows = allItems.map((u) =>
      csvRow([
        u.userId, u.email, u.displayName, u.clan, u.seasonXp,
        u.totalWins, u.currentStreak, u.bestStreak, u.lastActiveDate,
        u.tutorialDone, u.createdAt, u.phase1Cluster ?? '',
      ])
    );

    return {
      statusCode: 200,
      headers: CSV_HEADERS,
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportPlayerProfiles] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
