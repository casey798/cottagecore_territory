import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { googleLoginSchema } from '../../shared/schemas';
import { query, putItem, deleteItem, getItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import { User, ClanId, DailyConfig, PlayerAssignment } from '../../shared/types';
import { ensureFirebaseInitialized, getFirebaseAdmin } from '../../shared/firebase';

const ALLOWED_EMAIL_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAIN || '')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

async function ensureTodayAssignment(userId: string): Promise<void> {
  const today = getTodayISTString();
  const dateUserId = `${today}#${userId}`;
  const existing = await getItem<PlayerAssignment>('player-assignments', { dateUserId });
  if (existing) return;

  const config = await getItem<DailyConfig>('daily-config', { date: today });
  if (!config || config.activeLocationIds.length === 0) return;

  const count = Math.floor(Math.random() * 3) + 3; // 3-5 locations
  const shuffled = [...config.activeLocationIds].sort(() => Math.random() - 0.5);
  const assigned = shuffled.slice(0, Math.min(count, shuffled.length));

  await putItem('player-assignments', {
    dateUserId,
    assignedLocationIds: assigned,
  } as unknown as Record<string, unknown>);
  console.log(`Created missing player assignment for ${userId} on login`);
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const parsed = googleLoginSchema.safeParse(body);

    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { idToken } = parsed.data;

    // Initialize Firebase
    const firebaseReady = await ensureFirebaseInitialized();
    if (!firebaseReady) {
      return error(ErrorCode.INTERNAL_ERROR, 'Firebase not configured', 500);
    }

    // Verify Firebase ID token
    const admin = getFirebaseAdmin();
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      console.error('Firebase token verification failed:', err);
      return error(ErrorCode.INVALID_CODE, 'Invalid or expired token', 401);
    }

    const email = decodedToken.email;
    if (!email) {
      return error(ErrorCode.VALIDATION_ERROR, 'Token does not contain an email', 400);
    }

    // Check email domain
    const domain = email.split('@')[1];
    if (ALLOWED_EMAIL_DOMAINS.length > 0 && !ALLOWED_EMAIL_DOMAINS.includes(domain)) {
      return error(
        ErrorCode.INVALID_DOMAIN,
        `Only @${ALLOWED_EMAIL_DOMAINS.join(' / @')} emails are allowed`,
        403
      );
    }

    // Look up user by email in DynamoDB via EmailIndex
    const { items } = await query<User>(
      'users',
      'email = :email',
      { ':email': email },
      { indexName: 'EmailIndex' }
    );

    let user = items[0];
    const firebaseUid = decodedToken.uid;

    if (!user) {
      // Look up roster to auto-assign clan
      const rosterEntry = await getItem<{ email: string; clan: string }>('roster', {
        email: email.toLowerCase(),
      });

      if (!rosterEntry) {
        return error(
          ErrorCode.NOT_IN_ROSTER,
          'Your email is not on the approved roster. Contact your administrator.',
          400,
        );
      }

      const clan = rosterEntry.clan as ClanId;

      // Create new user using Firebase UID as userId
      const now = new Date().toISOString();
      const newUser: Record<string, unknown> = {
        userId: firebaseUid,
        email,
        displayName: email.split('@')[0],
        clan,
        todayXp: 0,
        seasonXp: 0,
        totalWins: 0,
        currentStreak: 0,
        bestStreak: 0,
        tutorialDone: false,
        createdAt: now,
      };

      await putItem('users', newUser);
      user = newUser as unknown as User;
    } else if (user.userId !== firebaseUid) {
      // User exists (e.g. from roster import) but has a different userId.
      // Migrate to Firebase UID so it matches the Lambda authorizer's sub.
      console.log(`Migrating userId for ${email}: ${user.userId} -> ${firebaseUid}`);
      const oldUserId = user.userId;
      const migratedRecord: Record<string, unknown> = {
        ...(user as unknown as Record<string, unknown>),
        userId: firebaseUid,
      };
      await putItem('users', migratedRecord);
      await deleteItem('users', { userId: oldUserId });
      user = { ...user, userId: firebaseUid };

      // Fix 1: Migrate today's player-assignment from old userId to new Firebase UID
      const today = getTodayISTString();
      const oldKey = `${today}#${oldUserId}`;
      const oldAssignment = await getItem<PlayerAssignment>('player-assignments', { dateUserId: oldKey });
      if (oldAssignment) {
        await putItem('player-assignments', {
          ...oldAssignment,
          dateUserId: `${today}#${firebaseUid}`,
        } as unknown as Record<string, unknown>);
        await deleteItem('player-assignments', { dateUserId: oldKey });
        console.log(`Migrated player assignment from ${oldUserId} to ${firebaseUid}`);
      }
    }

    // Fix 3: Ensure a player-assignment exists for today (covers first login + missed resets)
    await ensureTodayAssignment(user.userId);

    return success({
      userId: user.userId,
      token: idToken,
      clan: user.clan ?? null,
      tutorialDone: user.tutorialDone ?? false,
    });
  } catch (err) {
    console.error('Google login error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Login failed', 500);
  }
};
