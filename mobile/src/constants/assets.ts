export type AssetCategory = 'banner' | 'statue' | 'furniture' | 'mural' | 'pet' | 'special';
export type AssetRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type ClanId = 'ember' | 'tide' | 'bloom' | 'gale' | 'hearth';

export interface DecorationAssetDef {
  id: string;
  name: string;
  filename: string;
  image: ReturnType<typeof require>;
  category: AssetCategory;
  rarity: AssetRarity;
  displayWidth: number;   // px — use directly as rendered size (1x assets)
  displayHeight: number;
  gridW: number;          // cells wide  (displayWidth / 32)
  gridH: number;          // cells tall  (displayHeight / 32)
  clanLocked?: ClanId;    // if set, this asset only drops to players of this clan
  dropWeight: number;     // relative drop weight for chest system
}

export const DECORATION_ASSETS: readonly DecorationAssetDef[] = [
  // BANNERS (clan-locked, common, drop weight 30)  — 64×64 = 2×2 grid
  { id: 'banner_ember',   name: 'Ember Banner',   filename: 'red_flag.png',    image: require('../assets/decoration/red_flag.png'),    displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'banner', rarity: 'common',    clanLocked: 'ember',  dropWeight: 30 },
  { id: 'banner_bloom',   name: 'Bloom Banner',   filename: 'yellow_flag.png', image: require('../assets/decoration/yellow_flag.png'), displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'banner', rarity: 'common',    clanLocked: 'bloom',  dropWeight: 30 },
  { id: 'banner_tide',    name: 'Tide Banner',    filename: 'blue_flag.png',   image: require('../assets/decoration/blue_flag.png'),   displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'banner', rarity: 'common',    clanLocked: 'tide',   dropWeight: 30 },
  { id: 'banner_gale',    name: 'Gale Banner',    filename: 'green_flag.png',  image: require('../assets/decoration/green_flag.png'),  displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'banner', rarity: 'common',    clanLocked: 'gale',   dropWeight: 30 },
  { id: 'banner_hearth',  name: 'Hearth Banner',  filename: 'purple_flag.png', image: require('../assets/decoration/purple_flag.png'), displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'banner', rarity: 'common',    clanLocked: 'hearth', dropWeight: 30 },

  // STATUES (any clan, uncommon, drop weight 15)
  { id: 'statue_fox',      name: 'Stone Fox',        filename: 'fox_stat.png',   image: require('../assets/decoration/fox_stat.png'),   displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'statue', rarity: 'uncommon', dropWeight: 15 },
  { id: 'statue_owl',      name: 'Mossy Owl',         filename: 'owl_stat.png',   image: require('../assets/decoration/owl_stat.png'),   displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'statue', rarity: 'uncommon', dropWeight: 15 },
  { id: 'statue_frog',     name: 'Frog on Lily Pad',  filename: 'frog_stat.png',  image: require('../assets/decoration/frog_stat.png'),  displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'statue', rarity: 'uncommon', dropWeight: 15 },
  { id: 'statue_gnome',    name: 'Garden Gnome',      filename: 'gnome_stat.png', image: require('../assets/decoration/gnome_stat.png'), displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'statue', rarity: 'uncommon', dropWeight: 15 },
  { id: 'statue_birdbath', name: 'Bird Bath',         filename: 'bird_stat.png',  image: require('../assets/decoration/bird_stat.png'),  displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'statue', rarity: 'uncommon', dropWeight: 15 },
  { id: 'statue_mushroom', name: 'Mushroom Totem',    filename: 'mush_stat.png',  image: require('../assets/decoration/mush_stat.png'),  displayWidth: 32, displayHeight: 64, gridW: 1, gridH: 2, category: 'statue', rarity: 'uncommon', dropWeight: 15 },

  // FURNITURE (any clan, common, drop weight 25)
  { id: 'furn_bench',     name: 'Wooden Bench',  filename: 'bench.png',        image: require('../assets/decoration/bench.png'),        displayWidth: 64, displayHeight: 32, gridW: 2, gridH: 1, category: 'furniture', rarity: 'common', dropWeight: 25 },
  { id: 'furn_archway',   name: 'Vine Archway',  filename: 'arch.png',         image: require('../assets/decoration/arch.png'),         displayWidth: 32, displayHeight: 64, gridW: 1, gridH: 2, category: 'furniture', rarity: 'common', dropWeight: 25 },
  { id: 'furn_lantern',   name: 'Lantern Post',  filename: 'light.png',        image: require('../assets/decoration/light.png'),        displayWidth: 32, displayHeight: 64, gridW: 1, gridH: 2, category: 'furniture', rarity: 'common', dropWeight: 25 },
  { id: 'furn_flowercart', name: 'Flower Cart',   filename: 'flowerbasket.png', image: require('../assets/decoration/flowerbasket.png'), displayWidth: 32, displayHeight: 32, gridW: 1, gridH: 1, category: 'furniture', rarity: 'common', dropWeight: 25 },
  { id: 'furn_table',     name: 'Potting Table', filename: 'table.png',        image: require('../assets/decoration/table.png'),        displayWidth: 32, displayHeight: 32, gridW: 1, gridH: 1, category: 'furniture', rarity: 'common', dropWeight: 25 },
  { id: 'furn_books',     name: 'Reading Nook',  filename: 'books.png',        image: require('../assets/decoration/books.png'),        displayWidth: 32, displayHeight: 32, gridW: 1, gridH: 1, category: 'furniture', rarity: 'common', dropWeight: 25 },
  { id: 'furn_picnic',    name: 'Picnic Blanket', filename: 'picnic.png',       image: require('../assets/decoration/picnic.png'),       displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'furniture', rarity: 'common', dropWeight: 25 },

  // MURALS (any clan, rare, drop weight 8)  — 64×64 = 2×2 grid
  { id: 'mural_1', name: 'Vine Mural',    filename: 'mural1.png', image: require('../assets/decoration/mural1.png'), displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'mural', rarity: 'rare', dropWeight: 8 },
  { id: 'mural_2', name: 'Cottage Scene', filename: 'mural2.png', image: require('../assets/decoration/mural2.png'), displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'mural', rarity: 'rare', dropWeight: 8 },
  { id: 'mural_3', name: 'Garden Path',   filename: 'mural3.png', image: require('../assets/decoration/mural3.png'), displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'mural', rarity: 'rare', dropWeight: 8 },
  { id: 'mural_4', name: 'Starry Night',  filename: 'mural4.png', image: require('../assets/decoration/mural4.png'), displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'mural', rarity: 'rare', dropWeight: 8 },

  // PETS (any clan, rare, drop weight 6)
  { id: 'pet_cat',       name: 'Pixel Cat',  filename: 'cat.png',          image: require('../assets/decoration/cat.png'),          displayWidth: 32, displayHeight: 32, gridW: 1, gridH: 1, category: 'pet', rarity: 'rare', dropWeight: 6 },
  { id: 'pet_fox',       name: 'Baby Fox',   filename: 'fox.png',          image: require('../assets/decoration/fox.png'),          displayWidth: 64, displayHeight: 32, gridW: 2, gridH: 1, category: 'pet', rarity: 'rare', dropWeight: 6 },
  { id: 'pet_hedgehog',  name: 'Hedgehog',   filename: 'hedge.png',        image: require('../assets/decoration/hedge.png'),        displayWidth: 32, displayHeight: 32, gridW: 1, gridH: 1, category: 'pet', rarity: 'rare', dropWeight: 6 },
  { id: 'pet_robin',     name: 'Robin',      filename: 'bird.png',         image: require('../assets/decoration/bird.png'),         displayWidth: 32, displayHeight: 32, gridW: 1, gridH: 1, category: 'pet', rarity: 'rare', dropWeight: 6 },
  { id: 'pet_butterfly', name: 'Butterfly',  filename: 'butterflypet.png', image: require('../assets/decoration/butterflypet.png'), displayWidth: 32, displayHeight: 32, gridW: 1, gridH: 1, category: 'pet', rarity: 'rare', dropWeight: 6 },

  // SPECIAL / LEGENDARY (any clan, drop weight 2)  — 64×64 = 2×2 grid
  { id: 'special_tree',      name: 'Ancient Banyan',   filename: 'banyan.png',   image: require('../assets/decoration/banyan.png'),   displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'special', rarity: 'legendary', dropWeight: 2 },
  { id: 'special_champion',  name: 'Warrior Statue',   filename: 'warrior.png',  image: require('../assets/decoration/warrior.png'),  displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'special', rarity: 'legendary', dropWeight: 2 },
  { id: 'special_trophy',    name: 'Golden Trophy',    filename: 'trophy.png',   image: require('../assets/decoration/trophy.png'),   displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'special', rarity: 'legendary', dropWeight: 2 },
  { id: 'special_fountain',  name: 'Crystal Fountain', filename: 'fountain.png', image: require('../assets/decoration/fountain.png'), displayWidth: 64, displayHeight: 64, gridW: 2, gridH: 2, category: 'special', rarity: 'legendary', dropWeight: 2 },
] as const;

export const ASSET_MAP: Record<string, DecorationAssetDef> = Object.fromEntries(
  DECORATION_ASSETS.map(a => [a.id, a])
);

// Returns the eligible asset pool for a chest drop for a given clan.
// Clan-locked assets only appear if the player's clan matches.
export function getEligibleAssets(playerClan: ClanId): DecorationAssetDef[] {
  return DECORATION_ASSETS.filter(a => !a.clanLocked || a.clanLocked === playerClan);
}

// Weighted random pick from eligible assets. Call this once per chest drop.
export function pickChestDrop(playerClan: ClanId): DecorationAssetDef {
  const pool = getEligibleAssets(playerClan);
  const totalWeight = pool.reduce((sum, a) => sum + a.dropWeight, 0);
  let roll = Math.random() * totalWeight;
  for (const asset of pool) {
    roll -= asset.dropWeight;
    if (roll <= 0) return asset;
  }
  return pool[pool.length - 1];
}
