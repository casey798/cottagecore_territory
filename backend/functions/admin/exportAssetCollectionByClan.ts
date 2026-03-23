import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import { toZonedTime } from 'date-fns-tz';
import { addDays, format } from 'date-fns';
import type { PlayerAsset, User, AssetCatalog } from '../../shared/types';

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
const ASSET_POOL_FALLBACK: Array<{ id: string; name: string; category: string; rarity: string; dropWeight: number }> = [
  { id: 'banner_ember',       name: 'Ember Banner',       category: 'banner',    rarity: 'common',    dropWeight: 30 },
  { id: 'banner_bloom',       name: 'Bloom Banner',       category: 'banner',    rarity: 'common',    dropWeight: 30 },
  { id: 'banner_tide',        name: 'Tide Banner',        category: 'banner',    rarity: 'common',    dropWeight: 30 },
  { id: 'banner_gale',        name: 'Gale Banner',        category: 'banner',    rarity: 'common',    dropWeight: 30 },
  { id: 'banner_hearth',      name: 'Hearth Banner',      category: 'banner',    rarity: 'common',    dropWeight: 30 },
  { id: 'statue_fox',         name: 'Stone Fox',          category: 'statue',    rarity: 'uncommon',  dropWeight: 15 },
  { id: 'statue_owl',         name: 'Mossy Owl',          category: 'statue',    rarity: 'uncommon',  dropWeight: 15 },
  { id: 'statue_frog',        name: 'Frog on Lily Pad',   category: 'statue',    rarity: 'uncommon',  dropWeight: 15 },
  { id: 'statue_gnome',       name: 'Garden Gnome',       category: 'statue',    rarity: 'uncommon',  dropWeight: 15 },
  { id: 'statue_birdbath',    name: 'Bird Bath',          category: 'statue',    rarity: 'uncommon',  dropWeight: 15 },
  { id: 'statue_mushroom',    name: 'Mushroom Totem',     category: 'statue',    rarity: 'uncommon',  dropWeight: 15 },
  { id: 'furn_bench',         name: 'Wooden Bench',       category: 'furniture', rarity: 'common',    dropWeight: 25 },
  { id: 'furn_archway',       name: 'Vine Archway',       category: 'furniture', rarity: 'common',    dropWeight: 25 },
  { id: 'furn_lantern',       name: 'Lantern Post',       category: 'furniture', rarity: 'common',    dropWeight: 25 },
  { id: 'furn_flowercart',    name: 'Flower Cart',        category: 'furniture', rarity: 'common',    dropWeight: 25 },
  { id: 'furn_table',         name: 'Potting Table',      category: 'furniture', rarity: 'common',    dropWeight: 25 },
  { id: 'furn_books',         name: 'Reading Nook',       category: 'furniture', rarity: 'common',    dropWeight: 25 },
  { id: 'furn_picnic',        name: 'Picnic Blanket',     category: 'furniture', rarity: 'common',    dropWeight: 25 },
  { id: 'mural_1',            name: 'Vine Mural',         category: 'mural',     rarity: 'rare',      dropWeight: 8  },
  { id: 'mural_2',            name: 'Cottage Scene',      category: 'mural',     rarity: 'rare',      dropWeight: 8  },
  { id: 'mural_3',            name: 'Garden Path',        category: 'mural',     rarity: 'rare',      dropWeight: 8  },
  { id: 'mural_4',            name: 'Starry Night',       category: 'mural',     rarity: 'rare',      dropWeight: 8  },
  { id: 'pet_cat',            name: 'Pixel Cat',          category: 'pet',       rarity: 'rare',      dropWeight: 6  },
  { id: 'pet_fox',            name: 'Baby Fox',           category: 'pet',       rarity: 'rare',      dropWeight: 6  },
  { id: 'pet_hedgehog',       name: 'Hedgehog',           category: 'pet',       rarity: 'rare',      dropWeight: 6  },
  { id: 'pet_robin',          name: 'Robin',              category: 'pet',       rarity: 'rare',      dropWeight: 6  },
  { id: 'pet_butterfly',      name: 'Butterfly',          category: 'pet',       rarity: 'rare',      dropWeight: 6  },
  { id: 'special_tree',       name: 'Ancient Banyan',     category: 'special',   rarity: 'legendary', dropWeight: 2  },
  { id: 'special_champion',   name: 'Warrior Statue',     category: 'special',   rarity: 'legendary', dropWeight: 2  },
  { id: 'special_trophy',     name: 'Golden Trophy',      category: 'special',   rarity: 'legendary', dropWeight: 2  },
  { id: 'special_fountain',   name: 'Crystal Fountain',   category: 'special',   rarity: 'legendary', dropWeight: 2  },
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

    // Step A: Load asset catalog (fallback to hardcoded pool)
    const catalogItems = await scanAll<AssetCatalog>('asset-catalog');
    const assetCatalog = new Map<string, { name: string; category: string; rarity: string; dropWeight: number }>();

    if (catalogItems.length > 0) {
      for (const a of catalogItems) {
        assetCatalog.set(a.assetId, { name: a.name, category: a.category, rarity: a.rarity, dropWeight: a.dropWeight });
      }
    } else {
      for (const a of ASSET_POOL_FALLBACK) {
        assetCatalog.set(a.id, { name: a.name, category: a.category, rarity: a.rarity, dropWeight: a.dropWeight });
      }
    }

    // Step B: Scan player-assets with date filter
    const allAssets = await scanAll<PlayerAsset>('player-assets', {
      filterExpression: 'obtainedAt BETWEEN :start AND :end',
      expressionValues: { ':start': startISO, ':end': endISO },
    });

    // Step C: Load users for clan mapping
    const usersData = await scanAll<User>('users');
    const userMap = new Map<string, { clan: string; phase1Cluster: string }>();
    for (const u of usersData) {
      userMap.set(u.userId, { clan: u.clan, phase1Cluster: u.phase1Cluster ?? '' });
    }

    // Build rows
    const rows: string[] = [];

    for (const clan of CLAN_ORDER) {
      // All assets for this clan
      const clanAssets = allAssets.filter((a) => {
        const user = userMap.get(a.userId);
        return user?.clan === clan;
      });

      // Group by assetId
      const byAssetId = new Map<string, PlayerAsset[]>();
      for (const a of clanAssets) {
        const list = byAssetId.get(a.assetId) || [];
        list.push(a);
        byAssetId.set(a.assetId, list);
      }

      // Build one row per asset in catalog
      const clanRows: Array<{ assetId: string; totalCollected: number; row: unknown[] }> = [];

      for (const [assetId, meta] of assetCatalog) {
        const assets = byAssetId.get(assetId) || [];
        const totalCollected = assets.length;
        const placedCount = assets.filter((a) => a.placed).length;
        const expiredCount = assets.filter((a) => a.expired).length;
        const activeCount = totalCollected - expiredCount;
        const collectedFromChest = assets.filter((a) => a.obtainedFrom === 'chest').length;
        const collectedFromReward = assets.filter((a) => a.obtainedFrom === 'reward').length;
        const collectedFromEvent = assets.filter((a) => a.obtainedFrom === 'event').length;

        clanRows.push({
          assetId,
          totalCollected,
          row: [
            0, // rank placeholder
            clan,
            assetId,
            meta.name,
            meta.category,
            meta.rarity,
            meta.dropWeight,
            totalCollected,
            placedCount,
            expiredCount,
            activeCount,
            collectedFromChest,
            collectedFromReward,
            collectedFromEvent,
          ],
        });
      }

      // Sort ascending by totalCollected
      clanRows.sort((a, b) => a.totalCollected - b.totalCollected);

      // Assign rank
      for (let i = 0; i < clanRows.length; i++) {
        clanRows[i].row[0] = i + 1;
        rows.push(csvRow(clanRows[i].row));
      }
    }

    const header = 'rank,clan,assetId,assetName,category,rarity,dropWeight,totalCollected,placedCount,expiredCount,activeCount,collectedFromChest,collectedFromReward,collectedFromEvent';

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="asset-collection-by-clan-${startDate}-to-${endDate}.csv"`,
      },
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportAssetCollectionByClan] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
