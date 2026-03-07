# GroveWars — Asset & Content Specification
### Complete Inventory of Art, Sprites, UI, and Content
**Version 1.0 — March 2026**

---

## 1. Art Direction Summary

All visual assets follow the **cottagecore pixel art** aesthetic inspired by Stardew Valley.

**Style rules:**
- **Map tile resolution: 32×32 px** — this is the foundational grid. All on-map elements must be 32px-aligned.
- Off-map sprites (profile, creation, inventory): 48×48 px for character sprites, varies for other elements
- Color palette: warm earth tones, muted pastels, forest greens, honey golds
- No harsh blacks — use dark brown (#3D2B1F) for outlines
- Shading: 2–3 tone shading, dithering for gradients
- No anti-aliasing — clean pixel edges throughout
- File format: PNG with transparency (unless noted otherwise)
- **Base map dimensions: 2000×1125 px** (~62×35 tiles, landscape 16:9)

**Core palette (hex values):**

| Name | Hex | Usage |
|------|-----|-------|
| Dark Brown | #3D2B1F | Outlines, text shadows |
| Warm Brown | #8B6914 | Wood frames, earth |
| Cream | #FFF5DC | Parchment, backgrounds |
| Soft Green | #7CAA5E | Foliage, nature elements |
| Deep Green | #2D5A27 | Dark leaves, forests |
| Honey Gold | #D4A843 | Highlights, rewards |
| Muted Rose | #C48B8B | Flowers, accents |
| Soft Blue | #7BA3C4 | Water, Tide clan |
| Warm Red | #C0392B | Ember clan primary |
| Sky Blue | #2980B9 | Tide clan primary |
| Sunflower Yellow | #F1C40F | Bloom clan primary |
| Forest Green | #27AE60 | Gale clan primary |
| Parchment BG | #F5EACB | UI backgrounds |
| Stone Grey | #A0937D | Tablets, stone elements |

---

## 2. Campus Map Assets

### 2.0 Tile Grid — Foundational Constraint

The campus map is built on a **32×32 pixel tile grid**. This is the fundamental unit for all map-rendered elements:

- **1 tile = 32×32 px**. All elements rendered on the map must be sized in multiples or clean fractions of 32 px.
- Map pins: 32×32 (1 tile) — sits cleanly on the grid.
- Player markers: 32×32 (1 tile) — visible and grid-aligned.
- Clan banners on map: 32×32 or 32×64 (1×1 or 1×2 tiles).
- **Off-map sprites** (profile screens, character creation, inventory, decoration canvas) are NOT bound by the 32 px grid and can use 48×48, 64×64, etc.
- Never render a 48×48 element on the map — it spans 1.5 tiles and misaligns with everything.

### 2.1 Base Map

| Asset | Filename | Dimensions | Notes |
|-------|----------|-----------|-------|
| Campus pixel art map | `campus-v1.png` | **2000×1125 px** (~62×35 tiles) | Top-down view, "Pixel Art Top Down Basic" tileset at 32×32 px. Shows buildings, paths, gardens, courtyards. Neutral tones — no clan colors baked in. Landscape 16:9 aspect ratio. |

**Note:** If the map is re-exported from the tilemap editor, dimensions may change. Always update overlay dimensions and calibration data when the base map changes. Overlays and programmatic polygon coordinates are relative to the base map pixel dimensions.

### 2.2 Map Overlays (Territory Capture)

One semi-transparent overlay per capturable campus space, per clan. These are pre-defined PNG regions that align exactly with the base map.

| Asset | Filename Pattern | Dimensions | Notes |
|-------|-----------------|-----------|-------|
| Territory overlay — Ember | `overlay_{space-id}_ember.png` | **2000×1125** (matches base map exactly) | 30% opacity red (#C0392B) fill over the space region. Rest is transparent. |
| Territory overlay — Tide | `overlay_{space-id}_tide.png` | **2000×1125** | 30% opacity blue (#2980B9) |
| Territory overlay — Bloom | `overlay_{space-id}_bloom.png` | **2000×1125** | 30% opacity yellow (#F1C40F) |
| Territory overlay — Gale | `overlay_{space-id}_gale.png` | **2000×1125** | 30% opacity green (#27AE60) |

**Preferred approach:** Generate overlays programmatically by defining polygon coordinates (in pixel space, snapped to 32 px tile boundaries) for each capturable space. Store polygon data in `captured-spaces` table and render tinted fills client-side with react-native-skia. This avoids creating dozens of PNGs and automatically adapts if the base map changes.

### 2.3 Map Pin Icons

All pins are 32×32 px with a transparent background. Designed to sit on the map as markers.

| Asset | Filename | States | Description |
|-------|----------|--------|-------------|
| Active pin — Mushroom | `pin_mushroom.png` | Static + glow animation (2 frames) | Red-capped mushroom with a gentle pulse glow |
| Active pin — Flower | `pin_flower.png` | Static + glow animation (2 frames) | Blooming wildflower |
| Active pin — Lantern | `pin_lantern.png` | Static + glow animation (2 frames) | Hanging cottagecore lantern with warm light |
| Active pin — Acorn | `pin_acorn.png` | Static + glow animation (2 frames) | Acorn with leaf |
| Locked pin | `pin_locked.png` | Static | Greyed-out pin with a small padlock overlay |
| Event-boosted pin | `pin_event.png` | Static + sparkle animation (3 frames) | Brighter glow + sparkle particles. Used during event windows. |
| Captured space banner — Ember | `banner_ember_map.png` | Static | Small red banner/flag planted on map |
| Captured space banner — Tide | `banner_tide_map.png` | Static | Small blue banner/flag |
| Captured space banner — Bloom | `banner_bloom_map.png` | Static | Small yellow banner/flag |
| Captured space banner — Gale | `banner_gale_map.png` | Static | Small green banner/flag |

### 2.4 Player Map Marker

| Asset | Filename | Dimensions | Notes |
|-------|----------|-----------|-------|
| Player dot — Ember | `player_dot_ember.png` | **32×32** (1 tile) | Avatar dot with red clan-colored ring |
| Player dot — Tide | `player_dot_tide.png` | **32×32** | Blue ring |
| Player dot — Bloom | `player_dot_bloom.png` | **32×32** | Yellow ring |
| Player dot — Gale | `player_dot_gale.png` | **32×32** | Green ring |
| GPS accuracy ring | `gps_ring.png` | **64×64** (2×2 tiles) | Semi-transparent circle showing GPS accuracy radius, centered on player dot |

---

## 3. Character Creation Sprites

All character sprites are **48×48 px** for use on **off-map screens** (character creation, player profile, clan scoreboard, result screen). These are NOT rendered on the map — the map uses the 32×32 `player_dot` marker instead.

**On-map vs. off-map distinction:**
- **On map:** Player is shown as a 32×32 clan-colored dot (see Section 2.4). No full character sprite on the map.
- **Off map (profile, creation, scoreboard):** Full 48×48 composited character sprite. This is where hair, skin, outfit, and accessories are visible.

Sprites are composited in layers: base body → skin → outfit → hair → accessory. Front-facing, transparent backgrounds.

### 3.1 Base Body & Skin Tones

| # | Filename | Hex Tones (base, shadow, highlight) |
|---|----------|-------------------------------------|
| 1 | `skin_tone_01.png` | #FDDCB5, #E8BC8A, #FFF0D6 (light) |
| 2 | `skin_tone_02.png` | #F2C68A, #D4A665, #FCD9A8 (light-medium) |
| 3 | `skin_tone_03.png` | #D4A06A, #B8854A, #E8BC8A (medium) |
| 4 | `skin_tone_04.png` | #B07840, #8E5E2C, #C89460 (medium-tan) |
| 5 | `skin_tone_05.png` | #8B5E3C, #6B4226, #A07850 (tan) |
| 6 | `skin_tone_06.png` | #6B4226, #4A2C14, #8B5E3C (dark) |
| 7 | `skin_tone_07.png` | #4A2C14, #321E0C, #6B4226 (deep) |
| 8 | `skin_tone_08.png` | #3A1E0A, #2A1408, #4A2C14 (deepest) |

### 3.2 Hair Styles

All 48×48 px, transparent background. Must align with the base body template.

| # | Name | Filename | Description |
|---|------|----------|-------------|
| 1 | Short Crop | `hair_style_01.png` | Neat short hair, slightly tousled |
| 2 | Side Part | `hair_style_02.png` | Medium length with side part |
| 3 | Long Flow | `hair_style_03.png` | Long hair past shoulders |
| 4 | Curly Bob | `hair_style_04.png` | Bouncy curly bob cut |
| 5 | Braided | `hair_style_05.png` | Single braid to the side |
| 6 | Messy Bun | `hair_style_06.png` | Casual top bun, cottagecore look |
| 7 | Pixie | `hair_style_07.png` | Short pixie cut |
| 8 | Wavy Long | `hair_style_08.png` | Long wavy hair, very Stardew |

### 3.3 Hair Colors

These are color palette swaps applied to whichever hair style is selected.

| # | Name | Filename / Palette | Hex Values (base, shadow, highlight) |
|---|------|--------------------|--------------------------------------|
| 1 | Brown | `hair_color_01` | #6B4226, #4A2C14, #8B5E3C |
| 2 | Dark Brown | `hair_color_02` | #3D2B1F, #2A1A10, #5E4030 |
| 3 | Black | `hair_color_03` | #1A1A2E, #0D0D15, #2E2E42 |
| 4 | Auburn | `hair_color_04` | #8B3A1A, #6B2A10, #A85230 |
| 5 | Blonde | `hair_color_05` | #D4A843, #B8903A, #E8C060 |
| 6 | Red | `hair_color_06` | #A03020, #7A2418, #C04838 |
| 7 | Silver | `hair_color_07` | #A0A0A8, #808088, #C0C0C8 |
| 8 | Ginger | `hair_color_08` | #C87030, #A05820, #E08848 |
| 9 | Honey | `hair_color_09` | #C49A3C, #A07E2C, #D8B254 |
| 10 | Strawberry | `hair_color_10` | #D07050, #B05838, #E88868 |

### 3.4 Outfits

48×48 px overlay on the body. Cottagecore wardrobe.

| # | Name | Filename | Description |
|---|------|----------|-------------|
| 1 | Linen Shirt | `outfit_01.png` | Simple cream/white linen top |
| 2 | Overalls | `outfit_02.png` | Denim overalls over a shirt |
| 3 | Knit Sweater | `outfit_03.png` | Cozy knitted sweater, muted color |
| 4 | Plaid Flannel | `outfit_04.png` | Classic plaid flannel shirt |
| 5 | Garden Apron | `outfit_05.png` | Apron over a simple top |
| 6 | Vest & Blouse | `outfit_06.png` | Layered look, cottagecore style |
| 7 | Hoodie | `outfit_07.png` | Casual comfort, earth tones |
| 8 | Embroidered Top | `outfit_08.png` | Floral embroidery details |

### 3.5 Accessories

48×48 px overlay, positioned on head/face.

| # | Name | Filename | Description |
|---|------|----------|-------------|
| 1 | None | — | No accessory |
| 2 | Straw Hat | `accessory_01.png` | Classic cottagecore straw hat |
| 3 | Round Glasses | `accessory_02.png` | Small round spectacles |
| 4 | Knit Scarf | `accessory_03.png` | Cozy scarf around neck |
| 5 | Flower Crown | `accessory_04.png` | Wildflower wreath on head |
| 6 | Bandana | `accessory_05.png` | Tied bandana, earthy color |

**Unlockable accessories (earned via streaks/season rewards):**

| # | Name | Filename | Unlock Condition |
|---|------|----------|-----------------|
| 7 | Mushroom Cap Hat | `accessory_06.png` | 3-day streak ("Seedling" badge) |
| 8 | Leaf Headband | `accessory_07.png` | 7-day streak ("Sapling" badge) |
| 9 | Golden Wreath | `accessory_08.png` | 14-day streak ("Ancient Oak" badge) |
| 10 | Clan Beret (color varies) | `accessory_09_{clan}.png` | Win at least 1 territory capture |

---

## 4. Clan Assets

### 4.1 Clan Crests / Badges

Displayed on player profiles, scoreboard, and tutorial.

| Clan | Filename | Dimensions | Description |
|------|----------|-----------|-------------|
| Ember | `crest_ember.png` | 64×64 | Lantern icon on red shield, warm fire glow |
| Tide | `crest_tide.png` | 64×64 | Wave icon on blue shield, flowing water details |
| Bloom | `crest_bloom.png` | 64×64 | Sunflower icon on yellow shield, petal border |
| Gale | `crest_gale.png` | 64×64 | Leaf icon on green shield, wind swirl accents |

### 4.2 Clan Banners (Large)

For capture celebration screen and season summary.

| Clan | Filename | Dimensions | Description |
|------|----------|-----------|-------------|
| Ember | `banner_ember_large.png` | 128×256 | Tall banner with lantern emblem, tattered edges |
| Tide | `banner_tide_large.png` | 128×256 | Flowing banner with wave pattern |
| Bloom | `banner_bloom_large.png` | 128×256 | Bright banner with sunflower border |
| Gale | `banner_gale_large.png` | 128×256 | Leaf-patterned banner, wind-blown look |

### 4.3 Clan Tutorial Vignettes

Small animated scenes shown during the tutorial (Scene 2: The Lore).

| Clan | Filename | Dimensions | Description |
|------|----------|-----------|-------------|
| Ember | `vignette_ember.png` | 320×180 | Warm hearth scene — lanterns glowing, fireplace, cozy room |
| Tide | `vignette_tide.png` | 320×180 | Flowing stream scene — calm water, stepping stones, mist |
| Bloom | `vignette_bloom.png` | 320×180 | Garden scene — sunflowers, butterflies, warm sunlight |
| Gale | `vignette_gale.png` | 320×180 | Forest scene — tall trees, wind-blown leaves, misty paths |

---

## 5. UI Assets

### 5.1 Frames & Borders

| Asset | Filename | Dimensions | Usage |
|-------|----------|-----------|-------|
| Wooden frame — square | `frame_wood_square.png` | 9-slice, 64×64 base | Profile cards, inventory slots, minigame cards |
| Wooden frame — wide | `frame_wood_wide.png` | 9-slice, 128×48 base | Buttons, score displays |
| Parchment panel | `panel_parchment.png` | 9-slice, 128×128 base | Dialogue boxes, info panels, sidebars |
| Stone tablet | `panel_stone.png` | 9-slice, 96×96 base | Minigame tiles, letter displays |
| Vine border | `border_vine.png` | Tileable, 32 px wide | Screen edge decoration |
| Ribbon header | `ribbon_header.png` | 256×48 | Screen titles, announcements |

**9-slice note:** These use the 9-slice/9-patch sprite technique. Define `capInsets` for React Native `<Image>` resizing.

### 5.2 Buttons

All buttons have 3 states: normal, pressed, disabled.

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Primary button | `btn_primary_{state}.png` | 160×48 | Warm brown wood, gold text area. Used for main actions (Scan QR, Play, etc.) |
| Secondary button | `btn_secondary_{state}.png` | 128×40 | Lighter wood, for secondary actions (Back, Cancel) |
| Icon button | `btn_icon_{state}.png` | 48×48 | Circular wooden button for icons (settings, close) |
| Clan-colored button | `btn_clan_{clan}_{state}.png` | 160×48 | Clan-tinted button variant (4 clans × 3 states = 12 files) |

### 5.3 Icons (UI)

All 24×24 or 32×32 px, transparent background.

| Icon | Filename | Description |
|------|----------|-------------|
| XP star | `icon_xp.png` | Golden star for XP display |
| Timer clock | `icon_timer.png` | Small clock face |
| Streak flame | `icon_streak_flame.png` | Warm flame icon for streak counter |
| Streak leaf | `icon_streak_leaf.png` | Alternative leaf icon for streak |
| Chest | `icon_chest.png` | Small wooden chest |
| Lock | `icon_lock.png` | Padlock icon |
| QR scan | `icon_qr.png` | Camera/QR frame icon |
| Profile | `icon_profile.png` | Person silhouette |
| Inventory | `icon_inventory.png` | Bag/backpack icon |
| Clan/scoreboard | `icon_clan.png` | Shield/trophy icon |
| Settings gear | `icon_settings.png` | Wooden gear |
| Notification bell | `icon_bell.png` | Small bell |
| Trophy | `icon_trophy.png` | Golden trophy cup |
| Crown | `icon_crown.png` | Winning clan crown |
| Co-op | `icon_coop.png` | Two people silhouette |
| Map zoom in | `icon_zoom_in.png` | Magnifying glass + |
| Map zoom out | `icon_zoom_out.png` | Magnifying glass – |

### 5.4 Streak Milestone Badges

Displayed on player profile.

| Badge | Filename | Dimensions | Condition |
|-------|----------|-----------|-----------|
| Seedling | `badge_seedling.png` | 48×48 | 3-day streak |
| Sapling | `badge_sapling.png` | 48×48 | 7-day streak |
| Ancient Oak | `badge_ancient_oak.png` | 48×48 | 14-day streak |

### 5.5 Backgrounds

| Asset | Filename | Dimensions | Usage |
|-------|----------|-----------|-------|
| Splash screen BG | `bg_splash.png` | 1920×1080 (landscape) | App loading screen |
| Login BG | `bg_login.png` | 1920×1080 | Email entry screen |
| Tutorial BG — morning | `bg_tutorial_morning.png` | 1920×1080 | Scene 1 background |
| Tutorial BG — lore | `bg_tutorial_lore.png` | 1920×1080 | Scene 2 background |
| Character creation BG | `bg_character_mirror.png` | 1920×1080 | "Magic mirror" frame for character creation |
| Minigame BG | `bg_minigame.png` | 1920×1080 | Generic minigame background (wooden table texture) |
| Result BG — win | `bg_result_win.png` | 1920×1080 | Celebration background with sparkles |
| Result BG — lose | `bg_result_lose.png` | 1920×1080 | Muted, slightly grey version |
| Capture celebration BG | `bg_capture.png` | 1920×1080 | Big celebration background with confetti/fireworks |
| Season summary BG | `bg_season_summary.png` | 1920×1080 | Hall of fame background, trophy shelf |

---

## 6. Minigame-Specific Assets

### 6.1 Grove Words

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Letter tile — empty | `gw_tile_empty.png` | 48×48 | Stone tablet, blank |
| Letter tile — correct (green) | `gw_tile_correct.png` | 48×48 | Stone with green moss glow |
| Letter tile — present (yellow) | `gw_tile_present.png` | 48×48 | Stone with amber glow |
| Letter tile — absent (grey) | `gw_tile_absent.png` | 48×48 | Darkened stone |
| Keyboard key — normal | `gw_key_normal.png` | 32×36 | Wooden key |
| Keyboard key — used correct | `gw_key_correct.png` | 32×36 | Green-tinted key |
| Keyboard key — used present | `gw_key_present.png` | 32×36 | Yellow-tinted key |
| Keyboard key — used absent | `gw_key_absent.png` | 32×36 | Greyed-out key |

### 6.2 Kindred

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Word card — unselected | `ki_card_normal.png` | 96×40 | Wooden card/tag |
| Word card — selected | `ki_card_selected.png` | 96×40 | Highlighted with glow border |
| Word card — found (per group color) | `ki_card_found_{1-4}.png` | 96×40 | 4 colors: moss green, amber, rose, sky blue |
| Mistake marker | `ki_mistake.png` | 24×24 | Small wilted flower/leaf |

### 6.3 Pips

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Grid cell — empty | `pi_cell_empty.png` | 32×32 | Empty dirt patch |
| Grid cell — target | `pi_cell_target.png` | 32×32 | Target area (marked with dotted outline) |
| Grid cell — filled | `pi_cell_filled.png` | 32×32 | Planted/bloomed cell |
| Grid cell — overfilled | `pi_cell_over.png` | 32×32 | Red-tinted, error state |
| Move counter icon | `pi_moves.png` | 24×24 | Seed/seedbag icon |

### 6.4 Vine Trail

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Letter cell — normal | `vt_cell_normal.png` | 36×36 | Stone cell with letter space |
| Letter cell — highlighted | `vt_cell_highlight.png` | 36×36 | Glowing green vine border when tracing |
| Letter cell — found | `vt_cell_found.png` | 36×36 | Vine-covered, word discovered |
| Letter cell — spangram | `vt_cell_spangram.png` | 36×36 | Golden vine border for theme word |
| Trace line | `vt_trace.png` | Tileable 4 px | Green vine connecting selected letters |

### 6.5 Mosaic

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Tile — leaf shape | `mo_tile_leaf.png` | Various | Pixel art leaf piece |
| Tile — mushroom shape | `mo_tile_mushroom.png` | Various | Pixel art mushroom piece |
| Tile — stone shape | `mo_tile_stone.png` | Various | Pixel art stone piece |
| Tile — acorn shape | `mo_tile_acorn.png` | Various | Pixel art acorn piece |
| Target silhouette | Procedurally generated | — | Dark outline of target shape on grid |
| Rotation handle | `mo_rotate.png` | 24×24 | Small curved arrow icon |

### 6.6 Crossvine

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Crossword cell — empty | `cv_cell_empty.png` | 36×36 | White/cream stone cell |
| Crossword cell — filled | `cv_cell_filled.png` | 36×36 | Cell with letter, slight shadow |
| Crossword cell — blocked | `cv_cell_blocked.png` | 36×36 | Dark stone (non-playable) |
| Crossword cell — highlighted | `cv_cell_highlight.png` | 36×36 | Current word highlight |
| Clue panel | Uses `panel_parchment.png` | — | Reuses UI parchment panel |

### 6.7 Number Grove

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Seed icon — type 1 | `ng_seed_01.png` | 24×24 | Sunflower seed |
| Seed icon — type 2 | `ng_seed_02.png` | 24×24 | Pumpkin seed |
| Seed icon — type 3 | `ng_seed_03.png` | 24×24 | Wheat grain |
| Seed icon — type 4 | `ng_seed_04.png` | 24×24 | Acorn |
| Seed icon — type 5 | `ng_seed_05.png` | 24×24 | Berry |
| Seed icon — type 6 | `ng_seed_06.png` | 24×24 | Pine cone |
| Grid cell — empty | `ng_cell_empty.png` | 40×40 | Garden plot, soil texture |
| Grid cell — fixed | `ng_cell_fixed.png` | 40×40 | Pre-planted (darker soil, can't change) |
| Grid cell — error | `ng_cell_error.png` | 40×40 | Red-tinted border |

### 6.8 Stone Pairs

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Card back | `sp_card_back.png` | 48×64 | Stone tablet with rune carving |
| Card front — mushroom | `sp_card_mushroom.png` | 48×64 | Revealed mushroom icon |
| Card front — acorn | `sp_card_acorn.png` | 48×64 | Revealed acorn icon |
| Card front — leaf | `sp_card_leaf.png` | 48×64 | Revealed leaf icon |
| Card front — flower | `sp_card_flower.png` | 48×64 | Revealed flower icon |
| Card front — bird | `sp_card_bird.png` | 48×64 | Revealed bird icon |
| Card front — fox | `sp_card_fox.png` | 48×64 | Revealed fox icon |
| Card front — butterfly | `sp_card_butterfly.png` | 48×64 | Revealed butterfly icon |
| Card front — lantern | `sp_card_lantern.png` | 48×64 | Revealed lantern icon |
| Card flip animation | `sp_flip_sheet.png` | Spritesheet, 5 frames | Card rotating 180° |

### 6.9 Potion Logic

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Potion bottle — red | `pl_potion_red.png` | 40×56 | Red bubbling potion |
| Potion bottle — blue | `pl_potion_blue.png` | 40×56 | Blue shimmering potion |
| Potion bottle — green | `pl_potion_green.png` | 40×56 | Green swirling potion |
| Ingredient — herb | `pl_ingr_herb.png` | 32×32 | Sprig of herbs |
| Ingredient — crystal | `pl_ingr_crystal.png` | 32×32 | Small crystal shard |
| Ingredient — mushroom | `pl_ingr_mushroom.png` | 32×32 | Magic mushroom |
| Effect icon — healing | `pl_effect_healing.png` | 32×32 | Heart with sparkle |
| Effect icon — speed | `pl_effect_speed.png` | 32×32 | Wind swoosh |
| Effect icon — shield | `pl_effect_shield.png` | 32×32 | Glowing shield |
| Logic grid cell | `pl_grid_cell.png` | 36×36 | Parchment grid cell |
| Check mark | `pl_check.png` | 20×20 | Green check for confirmed deduction |
| X mark | `pl_x.png` | 20×20 | Red X for eliminated option |

### 6.10 Leaf Sort

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Leaf — red | `ls_leaf_red.png` | 28×28 | Autumn red leaf |
| Leaf — gold | `ls_leaf_gold.png` | 28×28 | Golden leaf |
| Leaf — green | `ls_leaf_green.png` | 28×28 | Fresh green leaf |
| Leaf — brown | `ls_leaf_brown.png` | 28×28 | Dried brown leaf |
| Leaf — orange | `ls_leaf_orange.png` | 28×28 | Orange autumn leaf |
| Jar — empty | `ls_jar_empty.png` | 56×80 | Glass mason jar, empty |
| Jar — with leaves | Composited at runtime | — | Jar sprite + stacked leaf sprites |

### 6.11 Cipher Stones

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Stone letter — encoded | `cs_stone_encoded.png` | 32×36 | Rune-style stone with mystery symbol |
| Stone letter — decoded | `cs_stone_decoded.png` | 32×36 | Stone now showing plain letter |
| Stone letter — selected | `cs_stone_selected.png` | 32×36 | Highlighted selection border |
| Letter picker panel | Uses `panel_stone.png` | — | Reuses stone panel |

### 6.12 Path Weaver

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Grid cell — empty | `pw_cell_empty.png` | 28×28 | Light blank cell |
| Grid cell — filled | `pw_cell_filled.png` | 28×28 | Dark filled cell |
| Grid cell — error | `pw_cell_error.png` | 28×28 | Red-tinted incorrect fill |
| Row/column clue BG | `pw_clue_bg.png` | 28×28 | Parchment background for number clues |

---

## 7. Collectible Decoration Assets

These are the items players collect from chest drops and place in captured spaces.

### 7.1 Banners (Common — drop weight: 30)

| # | Name | Filename | Dimensions | Description |
|---|------|----------|-----------|-------------|
| 1 | Ember Clan Banner | `asset_banner_ember.png` | 32×64 | Red pennant with lantern |
| 2 | Tide Clan Banner | `asset_banner_tide.png` | 32×64 | Blue pennant with wave |
| 3 | Bloom Clan Banner | `asset_banner_bloom.png` | 32×64 | Yellow pennant with sunflower |
| 4 | Gale Clan Banner | `asset_banner_gale.png` | 32×64 | Green pennant with leaf |
| 5 | Seasonal Flag — Spring | `asset_banner_spring.png` | 32×64 | Pastel flowers flag |
| 6 | Seasonal Flag — Harvest | `asset_banner_harvest.png` | 32×64 | Orange/gold harvest theme |
| 7 | Custom Pennant — Stars | `asset_banner_stars.png` | 32×64 | Night sky with stars |
| 8 | Custom Pennant — Vines | `asset_banner_vines.png` | 32×64 | Green vine pattern |

### 7.2 Statues (Uncommon — drop weight: 15)

| # | Name | Filename | Dimensions | Description |
|---|------|----------|-----------|-------------|
| 1 | Stone Fox | `asset_statue_fox.png` | 48×48 | Small fox carved in stone, sitting |
| 2 | Mossy Owl | `asset_statue_owl.png` | 48×48 | Owl with moss-covered base |
| 3 | Mushroom Totem | `asset_statue_mushroom.png` | 48×48 | Stacked mushroom tower |
| 4 | Garden Gnome | `asset_statue_gnome.png` | 48×48 | Classic cottage garden gnome |
| 5 | Frog on Lily Pad | `asset_statue_frog.png` | 48×48 | Cute frog statue |
| 6 | Bird Bath | `asset_statue_birdbath.png` | 48×48 | Stone bird bath with bird |

### 7.3 Furniture (Common — drop weight: 25)

| # | Name | Filename | Dimensions | Description |
|---|------|----------|-----------|-------------|
| 1 | Wooden Bench | `asset_furn_bench.png` | 64×32 | Simple wooden garden bench |
| 2 | Lantern Post | `asset_furn_lantern.png` | 32×64 | Standing lantern, warm glow |
| 3 | Flower Cart | `asset_furn_flowercart.png` | 64×48 | Small cart overflowing with flowers |
| 4 | Picnic Blanket | `asset_furn_picnic.png` | 64×48 | Checkered blanket with basket |
| 5 | Wishing Well | `asset_furn_well.png` | 48×56 | Cobblestone well with bucket |
| 6 | Reading Nook | `asset_furn_reading.png` | 48×48 | Stack of books + cushion |
| 7 | Potting Table | `asset_furn_potting.png` | 64×48 | Table with pots and soil |
| 8 | Vine Archway | `asset_furn_archway.png` | 64×64 | Wooden arch with climbing vines |

### 7.4 Murals (Rare — drop weight: 8)

| # | Name | Filename | Dimensions | Description |
|---|------|----------|-----------|-------------|
| 1 | Vine Wall Art | `asset_mural_vine.png` | 64×64 | Climbing vine design |
| 2 | Pixel Landscape | `asset_mural_landscape.png` | 64×64 | Miniature landscape scene |
| 3 | Ember Crest | `asset_mural_ember.png` | 64×64 | Ember clan large crest |
| 4 | Tide Crest | `asset_mural_tide.png` | 64×64 | Tide clan large crest |
| 5 | Bloom Crest | `asset_mural_bloom.png` | 64×64 | Bloom clan large crest |
| 6 | Gale Crest | `asset_mural_gale.png` | 64×64 | Gale clan large crest |
| 7 | Starry Night | `asset_mural_starry.png` | 64×64 | Night sky pixel art |
| 8 | Cottage Scene | `asset_mural_cottage.png` | 64×64 | Cozy cottage illustration |

### 7.5 Pets (Rare — drop weight: 6)

| # | Name | Filename | Dimensions | Description |
|---|------|----------|-----------|-------------|
| 1 | Pixel Cat | `asset_pet_cat.png` | 32×32 | Orange tabby, sitting + idle animation (4 frames) |
| 2 | Firefly Jar | `asset_pet_firefly.png` | 32×40 | Glass jar with glowing fireflies (3 frame glow) |
| 3 | Baby Fox | `asset_pet_fox.png` | 32×32 | Tiny red fox, curled up |
| 4 | Hedgehog | `asset_pet_hedgehog.png` | 32×28 | Cute hedgehog, sniffing |
| 5 | Butterfly | `asset_pet_butterfly.png` | 24×24 | Fluttering butterfly (4 frame animation) |
| 6 | Robin | `asset_pet_robin.png` | 24×24 | Small bird, hopping (3 frames) |

### 7.6 Special / Legendary (drop weight: 2)

| # | Name | Filename | Dimensions | Description |
|---|------|----------|-----------|-------------|
| 1 | Golden Trophy | `asset_special_trophy.png` | 48×56 | Gleaming gold trophy cup |
| 2 | Crystal Fountain | `asset_special_fountain.png` | 56×56 | Small sparkling fountain |
| 3 | Ancient Tree | `asset_special_tree.png` | 48×64 | Massive old tree with glowing leaves |
| 4 | Season Champion Statue | `asset_special_champion.png` | 48×56 | Grand statue — season-end exclusive only |

---

## 8. Animation Spritesheets

| Animation | Filename | Frame Size | Frames | FPS | Description |
|-----------|----------|-----------|--------|-----|-------------|
| Chest open | `anim_chest_open.png` | 64×64 | 8 | 12 | Wooden chest lid opens, sparkles emerge |
| Chest glow | `anim_chest_glow.png` | 64×64 | 4 | 8 | Idle glow on chest before opening |
| Pin pulse | `anim_pin_pulse.png` | 32×32 | 4 | 6 | Soft glow growing/shrinking around active pin |
| Pin sparkle (event) | `anim_pin_sparkle.png` | 48×48 | 6 | 10 | Sparkle particles around event-boosted pin |
| Leaf falling | `anim_leaf_fall.png` | 16×16 | 8 | 8 | Leaf gently drifting down — particle effect |
| Firefly float | `anim_firefly.png` | 8×8 | 6 | 6 | Tiny dot with glow halo, floating path |
| XP gain pop | `anim_xp_pop.png` | 48×48 | 6 | 12 | "+25 XP" text pops up and fades |
| Win celebration | `anim_win.png` | 128×128 | 10 | 12 | Burst of flowers and sparkles |
| Lose sympathy | `anim_lose.png` | 128×128 | 6 | 8 | Gentle wilting flower animation |
| Capture fireworks | `anim_capture.png` | 256×256 | 12 | 10 | Big firework burst with clan colors |
| Card flip | `anim_card_flip.png` | 48×64 | 5 | 15 | Card rotating for Stone Pairs |
| Elder Moss idle | `anim_elder_moss.png` | 64×96 | 4 | 4 | Elder Moss gentle breathing, fox companion wagging tail |

---

## 9. Tutorial NPC Assets

### Elder Moss

| Asset | Filename | Dimensions | Description |
|-------|----------|-----------|-------------|
| Portrait — speaking | `elder_moss_portrait.png` | 128×128 | Warm pixel portrait for dialogue box. Straw hat, kind eyes, watering can. |
| Portrait — surprised | `elder_moss_surprised.png` | 128×128 | Eyebrows raised, slight smile |
| Portrait — proud | `elder_moss_proud.png` | 128×128 | Big smile, eyes crinkled |
| Fox companion | `elder_moss_fox.png` | 32×32 | Small fox sitting beside Elder Moss |
| Dialogue box frame | `dialogue_frame.png` | 9-slice, 320×96 base | Wooden frame with vine accents for text display |
| Name plate | `dialogue_nameplate.png` | 128×28 | Small wooden plate showing "Elder Moss" |

---

## 10. Fonts

| Font | Filename | Style | Usage |
|------|----------|-------|-------|
| Pixel body text | `font_pixel.ttf` | Monospaced pixel font, 8px base | All in-game body text, scores, timers, minigame content |
| Handwritten headers | `font_header.ttf` | Handwritten/calligraphy style | Screen titles, clan names, announcement headers |

**Recommended free fonts:**
- Body: "Press Start 2P" (Google Fonts) or "Silkscreen"
- Headers: "Caveat" or "Patrick Hand" (Google Fonts) — or a pixel script font like "Pixelify Sans"

---

## 11. Sound Direction (Future — Not MVP)

Listed here for asset planning even though sound is post-MVP.

| Sound | Filename | Duration | Description |
|-------|----------|----------|-------------|
| QR scan success | `sfx_scan_success.wav` | 0.5s | Cheerful chime |
| Minigame win | `sfx_win.wav` | 1.5s | Triumphant short melody |
| Minigame lose | `sfx_lose.wav` | 1.0s | Gentle, sympathetic tone |
| Chest open | `sfx_chest_open.wav` | 1.5s | Creaking wood + sparkle sound |
| XP gained | `sfx_xp_gain.wav` | 0.5s | Coin-like ding |
| Capture celebration | `sfx_capture.wav` | 3.0s | Triumphant fanfare + fireworks |
| Button tap | `sfx_button.wav` | 0.2s | Soft wooden click |
| Ambient BG music | `bgm_ambient.mp3` | Loop | Gentle acoustic guitar + nature sounds |

---

## 12. Content Lists

### 12.1 Grove Words — Word List (200+ words)

5-letter cottagecore/nature/campus themed words. Used for puzzle generation.

**A–F:** ACORN, BASIL, BENCH, BERRY, BIRCH, BLOOM, BOWER, BRIAR, BROOK, CEDAR, CHARM, CREEK, CREST, DAISY, DRIFT, DWELL, FERNS, FLORA, FROND, FUNGI

**G–L:** GLADE, GLEAM, GROVE, HAVEN, HAZEL, HEATH, HEDGE, HERBS, HONEY, KNOLL, LARCH, LILAC, LINEN, LODGE

**M–R:** MAPLE, MARSH, MEADO, MISTY, MOSSY, PATCH, PETAL, PLUME, POPPY, QUAIL, QUIET, REEDS, ROBIN, ROOST, RUSTY

**S–Z:** SEDGE, SHADE, SHIRE, SHRUB, SPORE, STEAM, STILE, STONE, STORK, THYME, TRAIL, TWINE, VIGOR, VINES, WHEAT, WOVEN, WRENS, YIELD

*(Full list of 200+ words to be maintained in `mobile/src/minigames/grove-words/wordlist.ts`)*

### 12.2 Kindred — Group Packs (50+ packs)

Each pack contains 4 groups of 4 words, with a category label per group. Sample packs:

**Pack 1:**
- "Garden flowers": DAISY, POPPY, TULIP, PANSY
- "Tree types": BIRCH, CEDAR, MAPLE, WILLOW
- "Baking items": FLOUR, SUGAR, YEAST, BUTTER
- "Morning sounds": CHIRP, CHIME, ROOST, RUSTLE

**Pack 2:**
- "Things in a shed": SHOVEL, TWINE, BUCKET, SHEARS
- "Bodies of water": CREEK, BROOK, RIVER, POND
- "Cottage furniture": CHAIR, TABLE, SHELF, STOOL
- "Nocturnal animals": OWL, BAT, FOX, MOTH

**Pack 3:**
- "Herbs": BASIL, THYME, SAGE, MINT
- "Weather": RAIN, FROST, MIST, BREEZE
- "Fabrics": LINEN, WOOL, SILK, COTTON
- "Bird types": ROBIN, WREN, FINCH, DOVE

*(50+ packs to be maintained in `mobile/src/minigames/kindred/groupPacks.ts`)*

### 12.3 Crossvine — Clue Database

Cottagecore/campus themed crossword clues. Generated per session from this pool.

**Sample clues (5-letter answers):**
- "Garden tool for digging" → SPADE
- "Small stream" → BROOK
- "Tall forest tree" → CEDAR
- "Baking ingredient from bees" → HONEY
- "Autumn leaf color" → AMBER
- "Woven garden boundary" → FENCE
- "Morning bird sound" → CHIRP
- "Warm drink from leaves" → STEEP
- "Garden pest with shell" → SNAIL

*(300+ clue-answer pairs to be maintained in `mobile/src/minigames/crossvine/clueDatabase.ts`)*

### 12.4 Cipher Stones — Quote Database

Nature/campus themed short quotes for the cryptogram game. Each quote is 40–80 characters.

**Sample quotes:**
- "Every flower blooms in its own time"
- "The forest speaks to those who listen"
- "A garden is a friend you can visit anytime"
- "Nature does nothing uselessly"
- "In every walk with nature one receives far more than one seeks"
- "The earth has music for those who listen"
- "Look deep into nature and you will understand everything"

*(100+ quotes to be maintained in `mobile/src/minigames/cipher-stones/quoteDatabase.ts`)*

### 12.5 Path Weaver — Hidden Images

Pixel art images revealed by solving nonogram puzzles. Each at 5×5 (easy) or 8×8 (medium/hard).

**5×5 images:** mushroom, heart, leaf, star, acorn, flower, bird, house, tree, cat

**8×8 images:** fox face, sunflower, butterfly, owl, watering can, lantern, cottage, mushroom cluster, hedgehog, bird on branch

*(Binary grid definitions maintained in `mobile/src/minigames/path-weaver/imageGrids.ts`)*

---

## 13. Total Asset Count Summary

| Category | Count | Notes |
|----------|-------|-------|
| Campus map + overlays | 1 + ~56 (14 spaces × 4 clans) | Or use programmatic overlays |
| Map pins & markers | ~14 | Various states and clan colors |
| Character sprites | ~50+ sheets | 8 hair × 10 colors × 8 skin × 8 outfits × 10 accessories (composited at runtime) |
| Clan crests & banners | 16 | 4 clans × (crest + large banner + map banner + vignette) |
| UI frames & panels | ~8 | 9-slice images |
| UI buttons | ~24 | 4 types × 3 states, plus clan variants |
| UI icons | ~20 | Various interface icons |
| Streak badges | 3 | Seedling, Sapling, Ancient Oak |
| Backgrounds | ~10 | Per screen type |
| Minigame assets | ~80+ | Across all 12 minigames |
| Collectible assets | ~40 | 8 banners + 6 statues + 8 furniture + 8 murals + 6 pets + 4 special |
| Animation spritesheets | ~12 | Various game animations |
| Tutorial / NPC | ~8 | Elder Moss portraits + dialogue frames |
| Fonts | 2 | Pixel body + handwritten header |
| Content data files | 5 | Word lists, group packs, clues, quotes, image grids |

**Estimated total unique image files: ~350–400**

---

*End of Asset & Content Specification — GroveWars v1.0*
