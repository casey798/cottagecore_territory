import { randomUUID } from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { batchWrite } from '../../shared/db';
import { ClanId } from '../../shared/types';
import type { User } from '../../shared/types';

const VALID_CLANS = new Set<string>([
  ClanId.Ember,
  ClanId.Tide,
  ClanId.Bloom,
  ClanId.Gale,
  ClanId.Hearth,
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RosterError {
  line: number;
  reason: string;
  raw: string;
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);

    // Parse body
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const csvData = body.csvData;
    if (typeof csvData !== 'string' || csvData.trim().length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'csvData is required and must be a non-empty string', 400);
    }

    const lines = csvData.trim().split('\n').map((line) => line.trim()).filter(Boolean);
    const errors: RosterError[] = [];
    const usersToWrite: Record<string, unknown>[] = [];
    let skipped = 0;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const parts = raw.split(',').map((p) => p.trim());

      if (parts.length < 2) {
        errors.push({ line: i + 1, reason: 'Invalid format, expected email,house', raw });
        skipped++;
        continue;
      }

      const email = parts[0].toLowerCase();
      const clan = parts[1].toLowerCase();

      if (!EMAIL_REGEX.test(email)) {
        errors.push({ line: i + 1, reason: 'Invalid email format', raw });
        skipped++;
        continue;
      }

      if (!VALID_CLANS.has(clan)) {
        errors.push({ line: i + 1, reason: `Invalid clan: ${clan}. Must be ember/tide/bloom/gale/hearth`, raw });
        skipped++;
        continue;
      }

      const now = new Date().toISOString();
      const userRecord: User = {
        userId: randomUUID(),
        email,
        displayName: email.split('@')[0].substring(0, 20),
        clan: clan as ClanId,
        avatarConfig: {
          hairStyle: 0,
          hairColor: 0,
          skinTone: 0,
          outfit: 0,
          accessory: 0,
        },
        todayXp: 0,
        seasonXp: 0,
        totalWins: 0,
        currentStreak: 0,
        bestStreak: 0,
        lastActiveDate: '',
        tutorialDone: false,
        fcmToken: '',
        createdAt: now,
      };

      usersToWrite.push(userRecord as unknown as Record<string, unknown>);
    }

    // Batch write users
    if (usersToWrite.length > 0) {
      await batchWrite('users', usersToWrite);
    }

    return success({
      imported: usersToWrite.length,
      skipped,
      errors,
    });
  } catch (err) {
    console.error('importRoster error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
