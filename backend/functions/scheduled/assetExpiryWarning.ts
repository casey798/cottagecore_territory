import { ScheduledEvent } from 'aws-lambda';
import { scan, getItem } from '../../shared/db';
import { sendToTokens } from '../../shared/notifications';
import { PlayerAsset, User } from '../../shared/types';
import { getMidnightISTAsISO } from '../../shared/time';
import { isQuietModeActive } from '../../shared/quietMode';

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  try {
  if (await isQuietModeActive()) {
    console.log('Quiet mode active — skipping asset expiry warning');
    return;
  }
  console.log('Asset expiry warning check running');

  const nextMidnight = getMidnightISTAsISO();

  // Scan player-assets where placed = false AND expired = false AND expiresAt <= next midnight
  const unplacedAssets: PlayerAsset[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await scan<PlayerAsset>('player-assets', {
      filterExpression: 'placed = :false AND expired = :false AND expiresAt <= :nextMidnight',
      expressionValues: {
        ':false': false,
        ':nextMidnight': nextMidnight,
      },
      exclusiveStartKey: lastKey,
    });
    unplacedAssets.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  console.log(`Found ${unplacedAssets.length} unplaced assets expiring tonight`);

  // Group by userId
  const userAssetCounts = new Map<string, number>();
  for (const asset of unplacedAssets) {
    const current = userAssetCounts.get(asset.userId) || 0;
    userAssetCounts.set(asset.userId, current + 1);
  }

  console.log(`${userAssetCounts.size} users have unplaced assets`);

  // MODIFIED: asset expiry notifications disabled in playtest version
  // for (const [userId, count] of userAssetCounts.entries()) {
  //   try {
  //     const user = await getItem<User>('users', { userId });
  //     if (user?.fcmToken) {
  //       await sendToTokens([user.fcmToken], {
  //         notification: {
  //           title: 'Items fading...',
  //           body: `You have ${count} unplaced item${count > 1 ? 's' : ''} — place them before midnight!`,
  //         },
  //         data: { type: 'ASSET_EXPIRY_WARNING', count: String(count) },
  //       });
  //     }
  //   } catch (err) {
  //     console.error(`Failed to send warning to user ${userId}:`, err);
  //   }
  // }

  console.log('Asset expiry warnings complete');
  } catch (err) {
    console.error('Asset expiry warning failed:', err);
    throw err;
  }
};
