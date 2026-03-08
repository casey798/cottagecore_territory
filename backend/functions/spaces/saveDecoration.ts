import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem, putItem, query, updateItem } from '../../shared/db';
import { saveDecorationSchema } from '../../shared/schemas';
import { success, error, ErrorCode } from '../../shared/response';
import { CapturedSpace, PlayerAsset, User, SpaceDecoration } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);
    const spaceId = event.pathParameters?.spaceId;

    if (!spaceId) {
      return error(ErrorCode.VALIDATION_ERROR, 'Missing spaceId path parameter', 400);
    }

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const parsed = saveDecorationSchema.safeParse(body);

    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { layout } = parsed.data;

    // Verify player's clan owns this space
    const capturedSpace = await getItem<CapturedSpace>('captured-spaces', {
      spaceId,
    });

    if (!capturedSpace) {
      return error(ErrorCode.NOT_FOUND, 'Space not found', 404);
    }

    const user = await getItem<User>('users', { userId });

    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    if (capturedSpace.clan !== user.clan) {
      return error(ErrorCode.FORBIDDEN, 'Your clan does not own this space', 403);
    }

    // Verify all referenced assets exist in player's inventory and are non-expired
    const { items: playerAssets } = await query<PlayerAsset>(
      'player-assets',
      'userId = :uid',
      { ':uid': userId },
      { indexName: 'UserAssetsIndex' }
    );

    const activeAssetMap = new Map<string, PlayerAsset>();
    for (const asset of playerAssets) {
      if (!asset.expired) {
        activeAssetMap.set(asset.userAssetId, asset);
      }
    }

    for (const placedAsset of layout.placedAssets) {
      if (!activeAssetMap.has(placedAsset.assetId)) {
        return error(
          ErrorCode.VALIDATION_ERROR,
          `Asset ${placedAsset.assetId} not found in inventory or is expired`,
          400
        );
      }
    }

    // Mark placed assets as placed=true in player-assets
    const placedAssetIds = new Set(layout.placedAssets.map((a) => a.assetId));

    await Promise.all(
      playerAssets
        .filter((asset) => !asset.expired)
        .map(async (asset) => {
          const shouldBePlaced = placedAssetIds.has(asset.userAssetId);
          if (asset.placed !== shouldBePlaced) {
            await updateItem(
              'player-assets',
              { userAssetId: asset.userAssetId },
              'SET placed = :placed',
              { ':placed': shouldBePlaced }
            );
          }
        })
    );

    // Save decoration
    const decoration: SpaceDecoration = {
      userSpaceId: `${userId}#${spaceId}`,
      layout: { placedAssets: layout.placedAssets },
      updatedAt: new Date().toISOString(),
    };

    await putItem('space-decorations', decoration as unknown as Record<string, unknown>);

    return success({ saved: true });
  } catch (err) {
    console.error('saveDecoration error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to save decoration', 500);
  }
};
