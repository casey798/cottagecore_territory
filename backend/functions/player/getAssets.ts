import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { query, getItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { PlayerAsset, AssetCatalog } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const { items: playerAssets } = await query<PlayerAsset>(
      'player-assets',
      'userId = :uid',
      { ':uid': userId },
      { indexName: 'UserAssetsIndex' }
    );

    const activeAssets = playerAssets.filter((asset) => !asset.expired);

    const enrichedAssets = await Promise.all(
      activeAssets.map(async (playerAsset) => {
        const catalog = await getItem<AssetCatalog>('asset-catalog', {
          assetId: playerAsset.assetId,
        });

        return {
          userAssetId: playerAsset.userAssetId,
          assetId: playerAsset.assetId,
          name: catalog?.name ?? 'Unknown',
          category: catalog?.category ?? 'unknown',
          rarity: catalog?.rarity ?? 'unknown',
          imageKey: catalog?.imageKey ?? '',
          obtainedAt: playerAsset.obtainedAt,
          obtainedFrom: playerAsset.obtainedFrom,
          placed: playerAsset.placed,
          expiresAt: playerAsset.expiresAt,
        };
      })
    );

    return success({ assets: enrichedAssets });
  } catch (err) {
    console.error('getAssets error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get assets', 500);
  }
};
