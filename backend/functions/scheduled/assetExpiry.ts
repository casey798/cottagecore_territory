import { ScheduledEvent } from 'aws-lambda';
import { scan, updateItem } from '../../shared/db';
import { PlayerAsset } from '../../shared/types';

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  try {
  const now = new Date().toISOString();
  console.log(`Asset expiry check running at: ${now}`);

  // Scan player-assets where placed = false AND expired = false
  const expiredAssets: PlayerAsset[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await scan<PlayerAsset>('player-assets', {
      filterExpression: 'placed = :false AND expired = :false AND expiresAt <= :now',
      expressionValues: {
        ':false': false,
        ':now': now,
      },
      exclusiveStartKey: lastKey,
    });
    expiredAssets.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  console.log(`Found ${expiredAssets.length} assets to expire`);

  // Batch update all matching: set expired = true
  for (const asset of expiredAssets) {
    await updateItem(
      'player-assets',
      { userAssetId: asset.userAssetId },
      'SET expired = :true',
      { ':true': true }
    );
  }

  console.log(`Expired ${expiredAssets.length} assets`);
  } catch (err) {
    console.error('Asset expiry failed:', err);
    throw err;
  }
};
