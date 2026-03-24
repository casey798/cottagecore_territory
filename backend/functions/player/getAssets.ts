import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { extractUserId } from '../../shared/auth';
import { query, tableName } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { PlayerAsset, AssetCatalog } from '../../shared/types';

const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' }),
  { marshallOptions: { removeUndefinedValues: true } },
);

const CHUNK_SIZE = 100;

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

    const now = Date.now();
    const activeAssets = playerAssets.filter((asset) => {
      if (asset.expired) return false;
      if (asset.expiresAt && new Date(asset.expiresAt).getTime() <= now) return false;
      return true;
    });

    if (activeAssets.length === 0) {
      return success({ assets: [] });
    }

    // Batch fetch all catalog entries (max 100 per BatchGet request)
    const catalogMap = new Map<string, AssetCatalog>();
    const assetIds = [...new Set(activeAssets.map((a) => a.assetId))];

    for (let i = 0; i < assetIds.length; i += CHUNK_SIZE) {
      const chunk = assetIds.slice(i, i + CHUNK_SIZE);
      const result = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [tableName('asset-catalog')]: {
              Keys: chunk.map((id) => ({ assetId: id })),
            },
          },
        })
      );
      const responses = result.Responses?.[tableName('asset-catalog')] ?? [];
      for (const item of responses) {
        const catalog = item as AssetCatalog;
        catalogMap.set(catalog.assetId, catalog);
      }
    }

    const enrichedAssets = activeAssets.map((playerAsset) => {
      const catalog = catalogMap.get(playerAsset.assetId);
      return {
        userAssetId: playerAsset.userAssetId,
        assetId: playerAsset.assetId,
        name: catalog?.name ?? 'Unknown',
        category: catalog?.category ?? 'special',
        rarity: catalog?.rarity ?? 'common',
        imageKey: catalog?.imageKey ?? '',
        obtainedAt: playerAsset.obtainedAt,
        obtainedFrom: playerAsset.obtainedFrom,
        placed: playerAsset.placed,
        expiresAt: playerAsset.expiresAt,
        permanent: playerAsset.permanent ?? false,
      };
    });

    return success({ assets: enrichedAssets });
  } catch (err) {
    console.error('getAssets error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get assets', 500);
  }
};
