import crypto from 'crypto';
import { getItem, putItem } from '../shared/db';
import { AssetCategory, Rarity } from '../shared/types';

/** Deterministic asset ID from name — makes script idempotent. */
function assetIdFromName(name: string): string {
  const hash = crypto.createHash('sha256').update(name).digest('hex');
  // Format as UUID v4-style for consistency: 8-4-4-4-12
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}

function toKebab(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

// Map category to plural folder name for imageKey paths
const CATEGORY_FOLDER: Record<AssetCategory, string> = {
  [AssetCategory.Banner]: 'banners',
  [AssetCategory.Statue]: 'statues',
  [AssetCategory.Furniture]: 'furniture',
  [AssetCategory.Mural]: 'murals',
  [AssetCategory.Pet]: 'pets',
  [AssetCategory.Special]: 'special',
};

interface AssetDef {
  name: string;
  category: AssetCategory;
  rarity: Rarity;
  dropWeight: number;
}

const CATALOG: AssetDef[] = [
  // ── Common (dropWeight: 30) ──
  { name: 'Ember Clan Banner',     category: AssetCategory.Banner,    rarity: Rarity.Common, dropWeight: 30 },
  { name: 'Tide Clan Banner',      category: AssetCategory.Banner,    rarity: Rarity.Common, dropWeight: 30 },
  { name: 'Bloom Clan Banner',     category: AssetCategory.Banner,    rarity: Rarity.Common, dropWeight: 30 },
  { name: 'Gale Clan Banner',      category: AssetCategory.Banner,    rarity: Rarity.Common, dropWeight: 30 },
  { name: 'Seasonal Flag Spring',  category: AssetCategory.Banner,    rarity: Rarity.Common, dropWeight: 30 },
  { name: 'Wooden Bench',          category: AssetCategory.Furniture, rarity: Rarity.Common, dropWeight: 30 },

  // ── Uncommon (dropWeight: 15) ──
  { name: 'Stone Fox',             category: AssetCategory.Statue,    rarity: Rarity.Uncommon, dropWeight: 15 },
  { name: 'Mossy Owl',             category: AssetCategory.Statue,    rarity: Rarity.Uncommon, dropWeight: 15 },
  { name: 'Mushroom Totem',        category: AssetCategory.Statue,    rarity: Rarity.Uncommon, dropWeight: 15 },
  { name: 'Garden Gnome',          category: AssetCategory.Statue,    rarity: Rarity.Uncommon, dropWeight: 15 },
  { name: 'Lantern Post',          category: AssetCategory.Furniture, rarity: Rarity.Uncommon, dropWeight: 15 },

  // ── Rare (dropWeight: 8) ──
  { name: 'Vine Wall Art',         category: AssetCategory.Mural,     rarity: Rarity.Rare, dropWeight: 8 },
  { name: 'Pixel Landscape',       category: AssetCategory.Mural,     rarity: Rarity.Rare, dropWeight: 8 },
  { name: 'Pixel Cat',             category: AssetCategory.Pet,       rarity: Rarity.Rare, dropWeight: 8 },
  { name: 'Baby Fox',              category: AssetCategory.Pet,       rarity: Rarity.Rare, dropWeight: 8 },

  // ── Legendary (dropWeight: 2) ──
  { name: 'Golden Trophy',         category: AssetCategory.Special,   rarity: Rarity.Legendary, dropWeight: 2 },
  { name: 'Crystal Fountain',      category: AssetCategory.Special,   rarity: Rarity.Legendary, dropWeight: 2 },
  { name: 'Ancient Tree',          category: AssetCategory.Special,   rarity: Rarity.Legendary, dropWeight: 2 },
];

async function main() {
  const stage = process.env.STAGE || 'dev';
  console.log(`Seeding asset catalog for stage: ${stage}`);

  let seeded = 0;
  let skipped = 0;

  for (const def of CATALOG) {
    const assetId = assetIdFromName(def.name);
    const existing = await getItem('asset-catalog', { assetId });

    if (existing) {
      skipped++;
      continue;
    }

    const folder = CATEGORY_FOLDER[def.category];
    const imageKey = `assets/${folder}/${toKebab(def.name)}.png`;

    await putItem('asset-catalog', {
      assetId,
      name: def.name,
      category: def.category,
      rarity: def.rarity,
      imageKey,
      dropWeight: def.dropWeight,
    });

    console.log(`  + ${def.name} (${def.rarity})`);
    seeded++;
  }

  console.log(`\nSeeded ${seeded} new assets, skipped ${skipped} existing`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
