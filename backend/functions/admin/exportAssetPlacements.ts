import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import { getTodayISTString } from '../../shared/time';
import type { SpaceDecorationSubmission, User, Space } from '../../shared/types';
import { toZonedTime } from 'date-fns-tz';
import { addDays, format } from 'date-fns';

// Static asset name catalog — matches mobile/src/data/decorationPacks.ts
const ASSET_NAMES: Record<string, string> = {
  // Furniture
  furniture_basket: 'Wicker Basket', furniture_bench: 'Garden Bench', furniture_bench1: 'Wooden Bench',
  furniture_bench2: 'Stone Bench', furniture_bench3: 'Park Bench', furniture_bench4: 'Carved Bench',
  furniture_bench5: 'Slat Bench', furniture_bench6: 'Rustic Bench', furniture_book: 'Open Book',
  furniture_books: 'Stack of Books', furniture_chair: 'Garden Chair', furniture_chair1: 'Wooden Chair',
  furniture_inkstand: 'Inkstand', furniture_lantern: 'Hanging Lantern', furniture_lectern: 'Lectern',
  furniture_light: 'Garden Light', furniture_light1: 'Lamp Post', furniture_picnic: 'Picnic Spread',
  furniture_roundtable: 'Round Table', furniture_sheetrack: 'Sheet Rack', furniture_sign: 'Wooden Sign',
  furniture_stool: 'Garden Stool', furniture_table: 'Side Table', furniture_table1: 'Long Table',
  furniture_table2: 'Rustic Table', furniture_table3: 'Small Table', furniture_table4: 'Writing Desk',
  furniture_table5: 'Study Table', furniture_tools: 'Garden Tools',
  // Aesthetics
  aesthetics_angelfount: 'Angel Fountain', aesthetics_arch: 'Stone Arch', aesthetics_arch1: 'Ornate Arch',
  aesthetics_archer: 'Archer Statue', aesthetics_bell: 'Bell', aesthetics_bell1: 'Bell Tower',
  aesthetics_biulder: 'Mason Figure', aesthetics_bird_stat: 'Bird Statue', aesthetics_blue_flag: 'Tide Clan Banner',
  aesthetics_fire: 'Campfire', aesthetics_flag1: 'Pennant I', aesthetics_flag2: 'Pennant II',
  aesthetics_flag3: 'Pennant III', aesthetics_flag4: 'Pennant IV', aesthetics_fount: 'Stone Fountain',
  aesthetics_fount1: 'Tiered Fountain', aesthetics_fountain: 'Grand Fountain', aesthetics_fox_stat: 'Fox Statue',
  aesthetics_frog_stat: 'Frog Statue', aesthetics_gnome_stat: 'Garden Gnome', aesthetics_grave: 'Gravestone',
  aesthetics_green_flag: 'Gale Clan Banner', aesthetics_lion: 'Lion Statue', aesthetics_mural1: 'Mural I',
  aesthetics_mural2: 'Mural II', aesthetics_mural3: 'Mural III', aesthetics_mural4: 'Mural IV',
  aesthetics_mush_stat: 'Mushroom Statue', aesthetics_owl_stat: 'Owl Statue', aesthetics_pill: 'Stone Pillar',
  aesthetics_pillbroken: 'Broken Pillar', aesthetics_purple_flag: 'Hearth Clan Banner',
  aesthetics_red_flag: 'Ember Clan Banner', aesthetics_rockfount: 'Rock Fountain', aesthetics_sarco: 'Sarcophagus',
  aesthetics_tower1: 'Stone Tower', aesthetics_trophy: 'Trophy', aesthetics_warrior: 'Warrior Statue',
  aesthetics_yellow_flag: 'Bloom Clan Banner',
  // Nature
  nature_banyan: 'Banyan Tree', nature_bird: 'Little Bird', nature_bush: 'Garden Bush',
  nature_bush1: 'Round Bush', nature_bush2: 'Low Bush', nature_bush3: 'Flowering Bush',
  nature_butterflypet: 'Butterfly', nature_cacti: 'Cactus', nature_cat: 'Stray Cat',
  nature_fern: 'Fern', nature_flowerbasket: 'Flower Basket', nature_flowers: 'Wildflowers',
  nature_fox: 'Fox', nature_hedge: 'Hedge', nature_logs: 'Log Pile',
  nature_nushes: 'Reed Grass', nature_plant: 'Potted Plant', nature_planter: 'Garden Planter',
  nature_planter2: 'Stone Planter', nature_planter3: 'Tall Planter', nature_pot2: 'Clay Pot',
  nature_pots1: 'Pot Cluster', nature_pots2: 'Small Pots', nature_stone: 'Garden Stone',
  nature_stonepath: 'Stone Path', nature_tree1: 'Oak Tree', nature_tree2: 'Pine Tree',
  nature_tree3: 'Maple Tree', nature_trellis: 'Trellis', nature_trellis1: 'Vine Trellis',
  nature_trellis2: 'Arched Trellis', nature_trellis3: 'Grand Trellis',
};

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

function getDefaultStartDate(): string {
  const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
  return format(addDays(nowIST, -7), 'yyyy-MM-dd');
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const params = event.queryStringParameters || {};
    const startDate = params.startDate || getDefaultStartDate();
    const endDate = params.endDate || getTodayISTString();

    // Parallel scans
    const [allDecorations, allUsers, allSpaces] = await Promise.all([
      scanAll<SpaceDecorationSubmission>('space-decorations', {
        filterExpression: '#d BETWEEN :start AND :end',
        expressionNames: { '#d': 'date' },
        expressionValues: { ':start': startDate, ':end': endDate },
      }),
      scanAll<User>('users'),
      scanAll<Space>('spaces'),
    ]);

    // Build lookup maps
    const userMap = new Map<string, User>();
    for (const u of allUsers) userMap.set(u.userId, u);

    const spaceMap = new Map<string, string>();
    for (const s of allSpaces) spaceMap.set(s.spaceId, s.name);

    // One row per decoration submission — assets joined as semicolon-separated list
    const header = 'date,submittedAt,spaceId,spaceName,userId,displayName,clan,phase1Cluster,totalItems,furnitureCount,aestheticsCount,natureCount,assetNames,assetIds';

    // Sort decorations: date ASC, spaceName ASC, submittedAt ASC
    allDecorations.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const sA = spaceMap.get(a.spaceId) || a.spaceId;
      const sB = spaceMap.get(b.spaceId) || b.spaceId;
      if (sA !== sB) return sA.localeCompare(sB);
      return a.submittedAt.localeCompare(b.submittedAt);
    });

    const rows = allDecorations.map((d) => {
      const user = userMap.get(d.userId);
      const spaceName = spaceMap.get(d.spaceId) || d.spaceId;
      const assets = d.layout?.placedAssets ?? [];

      const assetNames = assets.map((a) => ASSET_NAMES[a.assetId] ?? a.assetId).join('; ');
      const assetIds = assets.map((a) => a.assetId).join('; ');
      const furniture = assets.filter((a) => a.packCategory === 'furniture').length;
      const aesthetics = assets.filter((a) => a.packCategory === 'aesthetics').length;
      const nature = assets.filter((a) => a.packCategory === 'nature').length;

      return csvRow([
        d.date,
        d.submittedAt,
        d.spaceId,
        spaceName,
        d.userId,
        user?.displayName ?? '',
        d.clan,
        user?.phase1Cluster ?? '',
        assets.length,
        furniture,
        aesthetics,
        nature,
        assetNames,
        assetIds,
      ]);
    });

    const filename = `asset-placements-${startDate}-to-${endDate}.csv`;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportAssetPlacements] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
