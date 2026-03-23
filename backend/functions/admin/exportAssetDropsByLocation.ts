import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { toZonedTime } from 'date-fns-tz';
import { addDays, format } from 'date-fns';
import type { PlayerAsset, User, AssetCatalog, LocationMasterConfig } from '../../shared/types';

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

function getDefault14DaysAgo(): string {
  const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
  return format(addDays(nowIST, -14), 'yyyy-MM-dd');
}

async function scanAll<T>(table: string, opts?: Parameters<typeof scan>[1]): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, { ...opts, exclusiveStartKey: lastKey });
    items.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return items;
}

// Hardcoded fallback from completeMinigame.ts ASSET_POOL
const ASSET_POOL_FALLBACK: Array<{ id: string; name: string; category: string; rarity: string }> = [
  { id: 'banner_ember', name: 'Ember Banner', category: 'banner', rarity: 'common' },
  { id: 'banner_bloom', name: 'Bloom Banner', category: 'banner', rarity: 'common' },
  { id: 'banner_tide', name: 'Tide Banner', category: 'banner', rarity: 'common' },
  { id: 'banner_gale', name: 'Gale Banner', category: 'banner', rarity: 'common' },
  { id: 'banner_hearth', name: 'Hearth Banner', category: 'banner', rarity: 'common' },
  { id: 'statue_fox', name: 'Stone Fox', category: 'statue', rarity: 'uncommon' },
  { id: 'statue_owl', name: 'Mossy Owl', category: 'statue', rarity: 'uncommon' },
  { id: 'statue_frog', name: 'Frog on Lily Pad', category: 'statue', rarity: 'uncommon' },
  { id: 'statue_gnome', name: 'Garden Gnome', category: 'statue', rarity: 'uncommon' },
  { id: 'statue_birdbath', name: 'Bird Bath', category: 'statue', rarity: 'uncommon' },
  { id: 'statue_mushroom', name: 'Mushroom Totem', category: 'statue', rarity: 'uncommon' },
  { id: 'furn_bench', name: 'Wooden Bench', category: 'furniture', rarity: 'common' },
  { id: 'furn_archway', name: 'Vine Archway', category: 'furniture', rarity: 'common' },
  { id: 'furn_lantern', name: 'Lantern Post', category: 'furniture', rarity: 'common' },
  { id: 'furn_flowercart', name: 'Flower Cart', category: 'furniture', rarity: 'common' },
  { id: 'furn_table', name: 'Potting Table', category: 'furniture', rarity: 'common' },
  { id: 'furn_books', name: 'Reading Nook', category: 'furniture', rarity: 'common' },
  { id: 'furn_picnic', name: 'Picnic Blanket', category: 'furniture', rarity: 'common' },
  { id: 'mural_1', name: 'Vine Mural', category: 'mural', rarity: 'rare' },
  { id: 'mural_2', name: 'Cottage Scene', category: 'mural', rarity: 'rare' },
  { id: 'mural_3', name: 'Garden Path', category: 'mural', rarity: 'rare' },
  { id: 'mural_4', name: 'Starry Night', category: 'mural', rarity: 'rare' },
  { id: 'pet_cat', name: 'Pixel Cat', category: 'pet', rarity: 'rare' },
  { id: 'pet_fox', name: 'Baby Fox', category: 'pet', rarity: 'rare' },
  { id: 'pet_hedgehog', name: 'Hedgehog', category: 'pet', rarity: 'rare' },
  { id: 'pet_robin', name: 'Robin', category: 'pet', rarity: 'rare' },
  { id: 'pet_butterfly', name: 'Butterfly', category: 'pet', rarity: 'rare' },
  { id: 'special_tree', name: 'Ancient Banyan', category: 'special', rarity: 'legendary' },
  { id: 'special_champion', name: 'Warrior Statue', category: 'special', rarity: 'legendary' },
  { id: 'special_trophy', name: 'Golden Trophy', category: 'special', rarity: 'legendary' },
  { id: 'special_fountain', name: 'Crystal Fountain', category: 'special', rarity: 'legendary' },
];

const CLAN_ORDER = ['ember', 'tide', 'bloom', 'gale', 'hearth'] as const;

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const params = event.queryStringParameters || {};
    const today = getTodayISTString();
    const startDate = params.startDate || getDefault14DaysAgo();
    const endDate = params.endDate || today;

    const startISO = startDate + 'T00:00:00.000Z';
    const endISO = endDate + 'T23:59:59.999Z';

    // Load asset catalog for rarity lookup
    const catalogItems = await scanAll<AssetCatalog>('asset-catalog');
    const assetMeta = new Map<string, { name: string; rarity: string }>();
    if (catalogItems.length > 0) {
      for (const a of catalogItems) assetMeta.set(a.assetId, { name: a.name, rarity: a.rarity });
    } else {
      for (const a of ASSET_POOL_FALLBACK) assetMeta.set(a.id, { name: a.name, rarity: a.rarity });
    }

    // Parallel: player-assets, users, locations
    const [allAssets, usersData, locationsData] = await Promise.all([
      scanAll<PlayerAsset>('player-assets', {
        filterExpression: 'obtainedAt BETWEEN :start AND :end',
        expressionValues: { ':start': startISO, ':end': endISO },
      }),
      scanAll<User>('users'),
      scanAll<LocationMasterConfig>('location-master-config'),
    ]);

    const userMap = new Map<string, { clan: string }>();
    for (const u of usersData) userMap.set(u.userId, { clan: u.clan });

    const locationMap = new Map<string, LocationMasterConfig>();
    for (const l of locationsData) locationMap.set(l.locationId, l);

    // Group by (clan, locationId)
    const grouped = new Map<string, PlayerAsset[]>();
    for (const a of allAssets) {
      if (!a.locationId) continue;
      const user = userMap.get(a.userId);
      if (!user) continue;
      const key = `${user.clan}#${a.locationId}`;
      const list = grouped.get(key) || [];
      list.push(a);
      grouped.set(key, list);
    }

    const rows: string[] = [];

    for (const clan of CLAN_ORDER) {
      const clanEntries: Array<{ totalAssetsDropped: number; row: unknown[] }> = [];

      for (const [key, assets] of grouped) {
        const [keyClan, locationId] = key.split('#');
        if (keyClan !== clan) continue;

        const loc = locationMap.get(locationId);
        const totalAssetsDropped = assets.length;
        const uniqueAssetIds = new Set(assets.map((a) => a.assetId));

        // Most dropped asset
        const assetCounts = new Map<string, number>();
        for (const a of assets) {
          assetCounts.set(a.assetId, (assetCounts.get(a.assetId) || 0) + 1);
        }
        let mostDroppedAssetId = '';
        let mostDroppedCount = 0;
        for (const [aid, count] of assetCounts) {
          if (count > mostDroppedCount) {
            mostDroppedCount = count;
            mostDroppedAssetId = aid;
          }
        }
        const mostDroppedName = assetMeta.get(mostDroppedAssetId)?.name ?? mostDroppedAssetId;

        // Rarity breakdown
        let rarityCommon = 0, rarityUncommon = 0, rarityRare = 0, rarityLegendary = 0;
        for (const a of assets) {
          const rarity = assetMeta.get(a.assetId)?.rarity ?? '';
          if (rarity === 'common') rarityCommon++;
          else if (rarity === 'uncommon') rarityUncommon++;
          else if (rarity === 'rare') rarityRare++;
          else if (rarity === 'legendary') rarityLegendary++;
        }

        clanEntries.push({
          totalAssetsDropped,
          row: [
            clan,
            locationId,
            loc?.name ?? '',
            loc?.classification ?? '',
            totalAssetsDropped,
            uniqueAssetIds.size,
            mostDroppedName,
            mostDroppedCount,
            rarityCommon,
            rarityUncommon,
            rarityRare,
            rarityLegendary,
          ],
        });
      }

      // Sort descending by totalAssetsDropped
      clanEntries.sort((a, b) => b.totalAssetsDropped - a.totalAssetsDropped);
      for (const entry of clanEntries) {
        rows.push(csvRow(entry.row));
      }
    }

    const header = 'clan,locationId,locationName,classification,totalAssetsDropped,uniqueAssetTypes,mostDroppedAssetName,mostDroppedAssetCount,rarity_common,rarity_uncommon,rarity_rare,rarity_legendary';

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="asset-drops-by-location-${startDate}-to-${endDate}.csv"`,
      },
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportAssetDropsByLocation] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
