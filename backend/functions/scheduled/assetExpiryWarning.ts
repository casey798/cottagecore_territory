import { ScheduledEvent } from 'aws-lambda';
import { scan, getItem } from '../../shared/db';
import { sendToTokens } from '../../shared/notifications';
import { PlayerAsset, User } from '../../shared/types';

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  try {
  console.log('Asset expiry warning check running');

  // Scan player-assets where placed = false AND expired = false AND expiresAt exists
  const unplacedAssets: PlayerAsset[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await scan<PlayerAsset>('player-assets', {
      filterExpression: 'placed = :false AND expired = :false AND attribute_exists(expiresAt)',
      expressionValues: {
        ':false': false,
      },
      exclusiveStartKey: lastKey,
    });
    unplacedAssets.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  console.log(`Found ${unplacedAssets.length} unplaced assets with expiry`);

  // Group by userId
  const userAssetCounts = new Map<string, number>();
  for (const asset of unplacedAssets) {
    const current = userAssetCounts.get(asset.userId) || 0;
    userAssetCounts.set(asset.userId, current + 1);
  }

  console.log(`${userAssetCounts.size} users have unplaced assets`);

  // Send notification to each user with unplaced assets
  for (const [userId, count] of userAssetCounts.entries()) {
    try {
      const user = await getItem<User>('users', { userId });
      if (user?.fcmToken) {
        await sendToTokens(
          [user.fcmToken],
          'Items expiring soon!',
          `You have ${count} unplaced item${count > 1 ? 's' : ''} - place them before midnight or they'll fade away!`,
          { type: 'ASSET_EXPIRY_WARNING', count: String(count) }
        );
      }
    } catch (err) {
      console.error(`Failed to send warning to user ${userId}:`, err);
    }
  }

  console.log('Asset expiry warnings complete');
  } catch (err) {
    console.error('Asset expiry warning failed:', err);
    throw err;
  }
};
