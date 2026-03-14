import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, scan, query } from '../../shared/db';
import { sendToTokens, sendToAll, sendToClan } from '../../shared/notifications';
import { getTodayISTString } from '../../shared/time';
import type { User, Clan, DailyConfig } from '../../shared/types';
import { ClanId } from '../../shared/types';

type WindowType = 'morning' | 'lunch' | 'final' | 'day_start' | 'capture' | 'asset_expiry';

const VALID_WINDOWS: WindowType[] = ['morning', 'lunch', 'final', 'day_start', 'capture', 'asset_expiry'];
const CLAN_IDS: ClanId[] = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];

function clanDisplayName(clanId: ClanId): string {
  return clanId.charAt(0).toUpperCase() + clanId.slice(1);
}

async function getTargetTokens(targetUserId?: string): Promise<string[]> {
  if (targetUserId) {
    const user = await getItem<User>('users', { userId: targetUserId });
    return user?.fcmToken ? [user.fcmToken] : [];
  }
  return [];
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const body = JSON.parse(event.body || '{}');
    const window = body.window as WindowType;
    const targetUserId = body.targetUserId as string | undefined;

    if (!window || !VALID_WINDOWS.includes(window)) {
      return error(ErrorCode.VALIDATION_ERROR, `Invalid window. Must be one of: ${VALID_WINDOWS.join(', ')}`, 400);
    }

    let deliveryCount = 0;

    if (window === 'morning') {
      if (targetUserId) {
        const tokens = await getTargetTokens(targetUserId);
        deliveryCount = await sendToTokens(tokens, {
          notification: { title: 'Break time!', body: 'The grove has fresh challenges waiting nearby.' },
          data: { type: 'EVENT_WINDOW', window: 'morning' },
        });
      } else {
        deliveryCount = await sendToAll({
          notification: { title: 'Break time!', body: 'The grove has fresh challenges waiting nearby.' },
          data: { type: 'EVENT_WINDOW', window: 'morning' },
        });
      }
    }

    if (window === 'lunch') {
      if (targetUserId) {
        const tokens = await getTargetTokens(targetUserId);
        deliveryCount = await sendToTokens(tokens, {
          notification: { title: 'Lunch break!', body: 'Perfect time to earn XP for your clan!' },
          data: { type: 'EVENT_WINDOW', window: 'lunch' },
        });
      } else {
        deliveryCount = await sendToAll({
          notification: { title: 'Lunch break!', body: 'Perfect time to earn XP for your clan!' },
          data: { type: 'EVENT_WINDOW', window: 'lunch' },
        });
      }
    }

    if (window === 'final') {
      const clans = await Promise.all(
        CLAN_IDS.map((clanId) => getItem<Clan>('clans', { clanId }))
      );
      const validClans = clans.filter((c): c is Clan => c !== undefined);
      const allZero = validClans.every((c) => c.todayXp === 0);

      if (allZero) {
        if (targetUserId) {
          const tokens = await getTargetTokens(targetUserId);
          deliveryCount = await sendToTokens(tokens, {
            notification: { title: 'Last hour!', body: 'No clan has scored yet — be the first!' },
            data: { type: 'FINAL_PUSH', leadingClan: '', deficit: '0' },
          });
        } else {
          deliveryCount = await sendToAll({
            notification: { title: 'Last hour!', body: 'No clan has scored yet — be the first!' },
            data: { type: 'FINAL_PUSH', leadingClan: '', deficit: '0' },
          });
        }
      } else {
        const maxXp = Math.max(...validClans.map((c) => c.todayXp));
        const leadingClan = validClans.find((c) => c.todayXp === maxXp)!;
        const leadingName = clanDisplayName(leadingClan.clanId);

        if (targetUserId) {
          // Send the leading clan's message to the target user
          const tokens = await getTargetTokens(targetUserId);
          deliveryCount = await sendToTokens(tokens, {
            notification: {
              title: 'Last hour!',
              body: `${leadingName} is leading! Hold your ground — one hour left.`,
            },
            data: { type: 'FINAL_PUSH', leadingClan: leadingClan.clanId, deficit: '0' },
          });
        } else {
          for (const clan of validClans) {
            const name = clanDisplayName(clan.clanId);
            const deficit = maxXp - clan.todayXp;
            if (clan.clanId === leadingClan.clanId) {
              deliveryCount += await sendToClan(clan.clanId, {
                notification: { title: 'Last hour!', body: `${name} is leading! Hold your ground — one hour left.` },
                data: { type: 'FINAL_PUSH', leadingClan: leadingClan.clanId, deficit: '0' },
              });
            } else {
              deliveryCount += await sendToClan(clan.clanId, {
                notification: { title: 'Last hour!', body: `${name} is ${deficit} XP behind ${leadingName}. Every win counts!` },
                data: { type: 'FINAL_PUSH', leadingClan: leadingClan.clanId, deficit: String(deficit) },
              });
            }
          }
        }
      }
    }

    if (window === 'day_start') {
      const today = getTodayISTString();
      const config = await getItem<DailyConfig>('daily-config', { date: today });
      const spaceName = config?.targetSpace?.name ?? 'the territory';

      if (targetUserId) {
        const tokens = await getTargetTokens(targetUserId);
        deliveryCount = await sendToTokens(tokens, {
          notification: { title: 'A new day dawns!', body: `Today's prize: ${spaceName}. Go claim it!` },
          data: { type: 'DAY_START', targetSpace: spaceName, date: today },
        });
      } else {
        deliveryCount = await sendToAll({
          notification: { title: 'A new day dawns!', body: `Today's prize: ${spaceName}. Go claim it!` },
          data: { type: 'DAY_START', targetSpace: spaceName, date: today },
        });
      }
    }

    if (window === 'capture') {
      const today = getTodayISTString();
      const config = await getItem<DailyConfig>('daily-config', { date: today });
      const spaceName = config?.targetSpace?.name ?? 'the territory';

      // Find current leading clan
      const clans = await Promise.all(
        CLAN_IDS.map((clanId) => getItem<Clan>('clans', { clanId }))
      );
      const validClans = clans.filter((c): c is Clan => c !== undefined);
      const maxXp = Math.max(...validClans.map((c) => c.todayXp), 0);
      const winnerClan = validClans.find((c) => c.todayXp === maxXp);
      const winnerName = winnerClan ? clanDisplayName(winnerClan.clanId) : 'No clan';

      if (targetUserId) {
        const tokens = await getTargetTokens(targetUserId);
        deliveryCount = await sendToTokens(tokens, {
          notification: { title: `${winnerName} wins!`, body: `${winnerName} has captured ${spaceName}!` },
          data: { type: 'CAPTURE_RESULT', winnerClan: winnerClan?.clanId ?? '', spaceName },
        });
      } else {
        deliveryCount = await sendToAll({
          notification: { title: `${winnerName} wins!`, body: `${winnerName} has captured ${spaceName}!` },
          data: { type: 'CAPTURE_RESULT', winnerClan: winnerClan?.clanId ?? '', spaceName },
        });
      }
    }

    if (window === 'asset_expiry') {
      // For asset_expiry, always send to a single user only
      if (!targetUserId) {
        // Find a single test user with an fcmToken
        const { items } = await scan<User>('users', {
          filterExpression: 'attribute_exists(fcmToken) AND fcmToken <> :empty',
          expressionValues: { ':empty': '' },
          limit: 1,
        });
        if (items.length > 0 && items[0].fcmToken) {
          deliveryCount = await sendToTokens([items[0].fcmToken], {
            notification: { title: 'Items expiring soon!', body: 'Some of your items expire at midnight. Use them before they vanish!' },
            data: { type: 'ASSET_EXPIRY_WARNING' },
          });
        }
      } else {
        const tokens = await getTargetTokens(targetUserId);
        deliveryCount = await sendToTokens(tokens, {
          notification: { title: 'Items expiring soon!', body: 'Some of your items expire at midnight. Use them before they vanish!' },
          data: { type: 'ASSET_EXPIRY_WARNING' },
        });
      }
    }

    return success({
      window,
      deliveryCount,
      message: 'Test notification sent',
    });
  } catch (err) {
    console.error('testNotification error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
