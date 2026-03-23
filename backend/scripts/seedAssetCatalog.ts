import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Seeds the asset-catalog table with entries whose assetId values match
 * the ASSET_POOL in completeMinigame.ts.  Run with:
 *
 *   npx ts-node backend/scripts/seedAssetCatalog.ts
 */

const TABLE_NAME = process.env.ASSET_CATALOG_TABLE || 'grovewars-dev-asset-catalog';
const REGION = process.env.AWS_REGION || 'ap-south-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// ── Catalog entries keyed to ASSET_POOL ids in completeMinigame.ts ──

interface CatalogEntry {
  assetId: string;
  name: string;
  category: string;
  rarity: string;
  imageKey: string;
  dropWeight: number;
}

// SYNC: keep assetId values in sync with completeMinigame.ts ASSET_POOL ids
const CATALOG: CatalogEntry[] = [
  // ── Banners (common, dropWeight 30) ──
  { assetId: 'banner_ember',    name: 'Ember Banner',         category: 'banner',    rarity: 'common',    imageKey: 'assets/banners/banner_ember.png',    dropWeight: 30 },
  { assetId: 'banner_bloom',    name: 'Bloom Banner',         category: 'banner',    rarity: 'common',    imageKey: 'assets/banners/banner_bloom.png',    dropWeight: 30 },
  { assetId: 'banner_tide',     name: 'Tide Banner',          category: 'banner',    rarity: 'common',    imageKey: 'assets/banners/banner_tide.png',     dropWeight: 30 },
  { assetId: 'banner_gale',     name: 'Gale Banner',          category: 'banner',    rarity: 'common',    imageKey: 'assets/banners/banner_gale.png',     dropWeight: 30 },
  { assetId: 'banner_hearth',   name: 'Hearth Banner',        category: 'banner',    rarity: 'common',    imageKey: 'assets/banners/banner_hearth.png',   dropWeight: 30 },

  // ── Statues (uncommon, dropWeight 15) ──
  { assetId: 'statue_fox',      name: 'Stone Fox',            category: 'statue',    rarity: 'uncommon',  imageKey: 'assets/statues/statue_fox.png',      dropWeight: 15 },
  { assetId: 'statue_owl',      name: 'Mossy Owl',            category: 'statue',    rarity: 'uncommon',  imageKey: 'assets/statues/statue_owl.png',      dropWeight: 15 },
  { assetId: 'statue_frog',     name: 'Frog on Lily Pad',     category: 'statue',    rarity: 'uncommon',  imageKey: 'assets/statues/statue_frog.png',     dropWeight: 15 },
  { assetId: 'statue_gnome',    name: 'Garden Gnome',         category: 'statue',    rarity: 'uncommon',  imageKey: 'assets/statues/statue_gnome.png',    dropWeight: 15 },
  { assetId: 'statue_birdbath', name: 'Bird Bath',            category: 'statue',    rarity: 'uncommon',  imageKey: 'assets/statues/statue_birdbath.png', dropWeight: 15 },
  { assetId: 'statue_mushroom', name: 'Mushroom Totem',       category: 'statue',    rarity: 'uncommon',  imageKey: 'assets/statues/statue_mushroom.png', dropWeight: 15 },

  // ── Furniture (common, dropWeight 25) ──
  { assetId: 'furn_bench',      name: 'Wooden Bench',         category: 'furniture', rarity: 'common',    imageKey: 'assets/furniture/furn_bench.png',      dropWeight: 25 },
  { assetId: 'furn_archway',    name: 'Vine Archway',         category: 'furniture', rarity: 'common',    imageKey: 'assets/furniture/furn_archway.png',    dropWeight: 25 },
  { assetId: 'furn_lantern',    name: 'Lantern Post',         category: 'furniture', rarity: 'common',    imageKey: 'assets/furniture/furn_lantern.png',    dropWeight: 25 },
  { assetId: 'furn_flowercart', name: 'Flower Cart',          category: 'furniture', rarity: 'common',    imageKey: 'assets/furniture/furn_flowercart.png', dropWeight: 25 },
  { assetId: 'furn_table',      name: 'Potting Table',        category: 'furniture', rarity: 'common',    imageKey: 'assets/furniture/furn_table.png',      dropWeight: 25 },
  { assetId: 'furn_books',      name: 'Reading Nook',         category: 'furniture', rarity: 'common',    imageKey: 'assets/furniture/furn_books.png',      dropWeight: 25 },
  { assetId: 'furn_picnic',     name: 'Picnic Blanket',       category: 'furniture', rarity: 'common',    imageKey: 'assets/furniture/furn_picnic.png',     dropWeight: 25 },

  // ── Murals (rare, dropWeight 8) ──
  { assetId: 'mural_1',         name: 'Vine Mural',           category: 'mural',     rarity: 'rare',      imageKey: 'assets/murals/mural_1.png',    dropWeight: 8 },
  { assetId: 'mural_2',         name: 'Cottage Scene',        category: 'mural',     rarity: 'rare',      imageKey: 'assets/murals/mural_2.png',    dropWeight: 8 },
  { assetId: 'mural_3',         name: 'Garden Path',          category: 'mural',     rarity: 'rare',      imageKey: 'assets/murals/mural_3.png',    dropWeight: 8 },
  { assetId: 'mural_4',         name: 'Starry Night',         category: 'mural',     rarity: 'rare',      imageKey: 'assets/murals/mural_4.png',    dropWeight: 8 },

  // ── Pets (rare, dropWeight 6) ──
  { assetId: 'pet_cat',         name: 'Pixel Cat',            category: 'pet',       rarity: 'rare',      imageKey: 'assets/pets/pet_cat.png',       dropWeight: 6 },
  { assetId: 'pet_fox',         name: 'Baby Fox',             category: 'pet',       rarity: 'rare',      imageKey: 'assets/pets/pet_fox.png',       dropWeight: 6 },
  { assetId: 'pet_hedgehog',    name: 'Hedgehog',             category: 'pet',       rarity: 'rare',      imageKey: 'assets/pets/pet_hedgehog.png',  dropWeight: 6 },
  { assetId: 'pet_robin',       name: 'Robin',                category: 'pet',       rarity: 'rare',      imageKey: 'assets/pets/pet_robin.png',     dropWeight: 6 },
  { assetId: 'pet_butterfly',   name: 'Butterfly',            category: 'pet',       rarity: 'rare',      imageKey: 'assets/pets/pet_butterfly.png', dropWeight: 6 },

  // ── Special (legendary, dropWeight 2) ──
  { assetId: 'special_tree',      name: 'Ancient Banyan',     category: 'special',   rarity: 'legendary', imageKey: 'assets/special/special_tree.png',      dropWeight: 2 },
  { assetId: 'special_champion',  name: 'Warrior Statue',     category: 'special',   rarity: 'legendary', imageKey: 'assets/special/special_champion.png',  dropWeight: 2 },
  { assetId: 'special_trophy',    name: 'Golden Trophy',      category: 'special',   rarity: 'legendary', imageKey: 'assets/special/special_trophy.png',    dropWeight: 2 },
  { assetId: 'special_fountain',  name: 'Crystal Fountain',   category: 'special',   rarity: 'legendary', imageKey: 'assets/special/special_fountain.png',  dropWeight: 2 },
];

async function main() {
  console.log(`Seeding ${CATALOG.length} items into ${TABLE_NAME} (region: ${REGION})`);

  // DynamoDB BatchWriteItem supports max 25 items per call
  const BATCH_SIZE = 25;

  for (let i = 0; i < CATALOG.length; i += BATCH_SIZE) {
    const batch = CATALOG.slice(i, i + BATCH_SIZE);

    const putRequests = batch.map((item) => ({
      PutRequest: { Item: item },
    }));

    const result = await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: putRequests,
        },
      }),
    );

    const unprocessed = result.UnprocessedItems?.[TABLE_NAME]?.length ?? 0;
    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: wrote ${batch.length - unprocessed}/${batch.length} items` +
        (unprocessed > 0 ? ` (${unprocessed} unprocessed — retry manually)` : ''),
    );
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
