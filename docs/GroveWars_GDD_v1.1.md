# GroveWars — Game Design Document
### Clan-Based Territory Capture Game for Campus Revitalization
**Version 1.1 — March 2026**

---

## 1. Overview

**Title:** GroveWars (working title — cottagecore-themed campus territory game)

**Elevator Pitch:** Four college house clans compete daily to capture key campus spaces by completing puzzle minigames at physical locations. Players scan QR codes, solve timed challenges, and earn XP for their clan. At 6 PM each day, the highest-scoring clan captures that day's designated space — permanently marked on a beautiful pixel art campus map. Over a 2-week season, the map fills with clan banners and trophies, bringing life to overlooked corners of campus.

**Core Goal:** Revitalize underutilized campus spaces by gamifying foot traffic. Built on data from 700+ activity logs collected over 1.5 weeks via a prior campus activity-tagging app.

**Platform:** Android only (React Native)
**Orientation:** Landscape (locked)
**Backend:** AWS
**Theme:** Cottagecore — earthy, nature-inspired, Stardew Valley aesthetic
**Target DAU:** 300–500 students
**Season Length:** 2 weeks

---

## 2. Game Loop (Core Cycle)

### Daily Cycle (8:00 AM – 6:00 PM IST)

```
[8:00 AM] Day begins → Admin has set: today's location pool + today's capturable space
     ↓
[Player opens app] → Sees personalized map with 3–5 active location pins
     (randomly assigned from admin's pool — each player gets different set)
     ↓
[Player walks to a location] → Scans daily QR code at that spot
     ↓
[App verifies] → QR code valid for today? + GPS within radius? → Access granted
     ↓
[Minigame selection] → Random set of 3–5 minigames from pool of ~10
     ↓
[Player picks one] → Timed puzzle minigame begins
     ↓
  ┌─ WIN → +25 XP → Rare chest drop chance → 5-min cooldown → Can play again
  └─ LOSE → Location LOCKED for this player until end of day
     ↓
[Max 100 XP/day per player] → After 4 wins, player is done for the day
     ↓
[6:00 PM] → Clan XP totals compared → Highest clan captures today's space
     ↓
[Announcement] → Push notification to all → Map updates with clan's flag
     ↓
[Reset] → All XP zeroed → Locks cleared → New day, new space tomorrow
```

### Event Windows (Heightened Activity)
These are push-notification windows to drive engagement during breaks:
- **Morning break:** 10:40 AM – 11:00 AM
- **Lunch break:** 12:40 PM – 1:40 PM
- **Final push:** 5:00 PM – 6:00 PM

Same XP rules apply — these are just notification-driven activity pulses.

### Season Cycle (2 Weeks)
- Day 1–14: Daily captures accumulate on the map
- Day 14, 6 PM: Season ends → Overall awards + Hall of Fame
- Admin can reset for new season via admin dashboard

---

## 3. Player Identity & Clans

### Onboarding Flow
1. **College email sign-in** (verified against allowed domain)
2. **Automatic clan assignment** based on CSV roster of house memberships
   - Red House, Blue House, Yellow House, Green House
   - Permanent for the season — no switching
3. **Storyline tutorial begins** (see Section 9)
4. **Character creation** (embedded in tutorial narrative)
5. **Practice minigame** → Player is now ready

### Character Creation
Players pick:
- **Display name** (can be anonymous/pseudonym)
- **Hair style** (6–8 pixel art options)
- **Hair color** (8–10 options)
- **Skin tone** (6–8 options)
- **Outfit/top** (6–8 starting options)
- **Accessory** (hat, glasses, scarf — 4–5 starting options, more unlockable)

Art style: 32×32 or 48×48 pixel art sprites, Stardew Valley inspired, cottagecore palette (warm greens, browns, cream, muted pastels).

### Player Profile
- Display name
- Pixel avatar
- Clan affiliation + clan color border
- Today's XP / 100
- Total season XP
- Collected assets (banners, statues, pets, etc.)
- Minigames won (lifetime stat)

---

## 4. Campus Map System

### Overview
The map is a **custom pixel art PNG** of the campus, rendered in the "Pixel Art Top Down Basic" style. This static image is overlaid with interactive pins, clan flags, and player markers.

### Map Calibration System

**Problem:** The pixel art map is oriented differently than the real-world GPS campus layout (campus is rotated IRL). The campus is only ~80m side-to-side.

**Solution: 4-Point Affine Calibration**

The admin provides:
- 4 GPS coordinates (lat/lng) of campus corners from Google Maps
- 4 corresponding pixel coordinates (x, y) on the PNG map

The app computes an affine transformation matrix to convert between GPS ↔ pixel space:

```
[px_x]   [a  b  tx] [gps_lng]
[px_y] = [c  d  ty] [gps_lat]
[ 1  ]   [0  0   1] [   1   ]
```

**Calibration Setup (Admin Dashboard):**
1. Upload campus PNG map
2. Click 4 points on the map image → records pixel coordinates
3. Enter 4 matching GPS coordinates from Google Maps
4. System computes transformation matrix + stores it
5. Preview: admin can see their current GPS location plotted on the map to verify accuracy

**Runtime (Player App):**
- Player's GPS → transform → pixel position on map → render dot/avatar
- Location pin GPS → transform → pixel position → render pin icon

**GPS Accuracy Notes:**
- Campus is ~80m across — need high accuracy
- Use Android's `FusedLocationProviderClient` with `PRIORITY_HIGH_ACCURACY`
- Geofence radius per location: **15–20 meters** (tight but not frustrating)
- QR scan + GPS combo means even if GPS drifts slightly, the QR code confirms physical presence

### Map Layers (Bottom to Top)
1. **Base layer:** Campus PNG (static pixel art)
2. **Clan territory layer:** Semi-transparent clan-colored overlays on captured spaces
3. **Location pins layer:** Animated pins showing active minigame locations
4. **Player marker layer:** Player's avatar dot showing current position
5. **UI overlay:** Clan scores, timer to 6 PM, minimap zoom controls

### Visual States of Map Elements
- **Uncaptured space:** Neutral (no overlay)
- **Captured by Red clan:** Red-tinted overlay + Red clan banner icon
- **Active minigame pin:** Glowing/pulsing icon (cottagecore style — mushroom, flower, lantern)
- **Locked location (for this player):** Greyed out pin with lock icon
- **Event window active:** Pins glow brighter, sparkle particles

---

## 5. Location & QR System

### Location Management (Admin Side)
- Admin dashboard: CRUD for locations
  - Name, description, GPS coordinates, geofence radius
  - Category (courtyard, corridor, garden, classroom block, etc.)
  - Active/inactive toggle
  - Activity data tags (from the 700-log dataset — why this spot is underused)

### Daily Location Assignment
Each morning (or the night before), admin:
1. Selects the **location pool** for the day (e.g., 10–15 locations)
2. Defines the **capturable key space** for the day (e.g., "North Courtyard")
3. Announces what space is up for grabs (push notification at 8 AM)
4. Generates and prints **daily QR codes** for each location

The app then assigns each player a **random subset of 3–5 locations** from the pool. Players see only their assigned pins on the map. This distributes foot traffic and prevents crowding.

### QR Code System

**Daily Rotating QR Codes:**
- Admin dashboard generates a new QR code per location per day
- QR encodes: `{ location_id, date_token, hmac_signature }`
- `date_token` changes daily → yesterday's QR won't work
- `hmac_signature` prevents fabrication
- Admin prints and places QR codes at physical locations each morning

**Scan + Verify Flow:**
1. Player taps "Scan QR" at a location pin
2. Camera opens → scans QR
3. App sends to server: `{ qr_data, player_gps, player_id }`
4. Server validates:
   - Is `date_token` today's? → Reject expired codes
   - Is `hmac_signature` valid? → Reject fabricated codes
   - Is `player_gps` within geofence radius of location? → Reject remote scans
   - Is location in this player's assigned set for today? → Reject wrong locations
   - Is location locked for this player? → Reject if locked
5. All checks pass → **Minigame access granted**

---

## 6. Minigames

### Overview
- **Total at launch:** ~10 puzzle minigames
- **Per location session:** Player sees 3–5 randomly selected
- **Type:** Timed puzzles (offline/client-side with server validation of completion)
- **Difficulty:** Moderate — should take 30–90 seconds, with a time limit adding pressure
- **Co-op mode:** Same-clan, shared screen (2 players, 1 phone)

### Minigame List (Launch Set)

All minigames are inspired by the NYT Games style — clean, elegant, word/logic/pattern puzzles with simple rules but satisfying depth. Re-themed with cottagecore aesthetics.

| # | Name | Inspired By | Description | Time Limit | Co-op? |
|---|------|-------------|-------------|------------|--------|
| 1 | **Grove Words** | Wordle | Guess a 5-letter nature/campus word in 6 tries. Color-coded feedback (green = correct, yellow = wrong position, grey = not in word). Word pool is cottagecore-themed: BLOOM, GROVE, CREEK, STONE, FERNS, etc. | 120s | Yes (discuss guesses together) |
| 2 | **Kindred** | Connections | 16 cottagecore-themed words displayed in a grid. Find 4 groups of 4 related words (e.g., "Types of flowers", "Things in a garden shed", "Sounds at dawn", "Baking ingredients"). 4 mistakes allowed. | 150s | Yes (one player suggests, other confirms) |
| 3 | **Pips** | NYT Pips | Tap tiles to fill a shape within a limited number of moves. Each tap fills the tile and its neighbors in a pattern. Complete the shape exactly — no over-filling. Grids get complex. | 90s | Yes (alternate turns tapping) |
| 4 | **Vine Trail** | Strands | Find themed words hidden in a letter grid by drawing paths through adjacent letters. All words relate to a secret theme. Find the "spangram" (theme word) that connects two sides of the board. | 180s | Yes (one searches top half, other searches bottom) |
| 5 | **Mosaic** | Tiles/Tangram | Arrange pixel art tiles (cottagecore shapes: leaves, mushrooms, stones) to fill a target silhouette perfectly. Tiles can be rotated. No overlaps, no gaps. | 90s | Yes (one rotates, other places) |
| 6 | **Crossvine** | Mini Crossword | A small 5×5 crossword with cottagecore/campus clues. Simple vocabulary, satisfying to complete quickly. New puzzle generated per session. | 120s | Yes (one does across, other does down) |
| 7 | **Number Grove** | Sudoku (mini) | A 4×4 or 6×6 mini-sudoku themed as a "planting grid" — place seed types (icons instead of numbers) so each row, column, and box has one of each. | 120s | No |
| 8 | **Stone Pairs** | Memory/Matching | Flip cottagecore-themed stone tablets to find matching pairs. 4×4 grid (8 pairs). Fewer flips = faster time. Memorize positions across flips. | 60s | Yes (take turns flipping) |
| 9 | **Potion Logic** | Logic grid puzzle | 3 potions, 3 ingredients, 3 effects — use clues to figure out which potion has which ingredient and effect. Classic logic deduction in a cozy frame. | 120s | Yes (one reads clues, other fills grid) |
| 10 | **Leaf Sort** | Water Sort / color sort | Sort colored leaves into jars — each jar should contain only one color. Limited empty jars to work with. Move leaves one at a time, only onto matching colors or into empty jars. | 90s | Yes (discuss strategy, alternate moves) |
| 11 | **Cipher Stones** | Cryptogram | A short quote about nature/campus encoded with a substitution cipher. Decode it letter by letter. Decoded letters auto-fill all instances. | 120s | Yes (one guesses vowels, other consonants) |
| 12 | **Path Weaver** | Nonogram/Picross | Fill in a pixel grid using row/column number clues to reveal a hidden cottagecore image (mushroom, fox, flower, etc.). Mini 5×5 or 8×8 grid. | 120s | No |

### Minigame Design Principles
- **Clean and elegant:** Simple rules, no tutorial needed beyond a 1-line instruction
- **Landscape-optimized:** All game boards designed for wide screen layout
- **No reflex/dexterity required:** All puzzles are logic/word/pattern based — accessible to everyone
- **Cottagecore reskin:** Every element uses nature-themed visuals (letters on stone tablets, words hidden in vine grids, etc.)
- **Replayability:** Procedurally generated puzzles (random word picks, shuffled grids, new crosswords) — never the same puzzle twice
- **Difficulty tuning:** Admin can adjust difficulty tier per day (easy/medium/hard) which affects grid size, time limit, or number of clues

### Minigame Result Flow
```
[Timer starts] → [Player solves puzzle]
  ├─ Solved within time → WIN
  │   ├─ +25 XP to player's clan total
  │   ├─ Random chest drop? (see Section 8)
  │   ├─ 5-minute cooldown starts
  │   └─ Can play another minigame at same or different location
  └─ Timer expires → LOSE
      ├─ 0 XP
      ├─ THIS location locks for THIS player until end of day
      └─ Player must go to a different location to play again
```

### Co-op Mode (Shared Screen)
- When scanning QR, player can toggle "Co-op" before starting
- Second player must be same clan (enters their player ID or scans their profile QR)
- Both players credited with 25 XP on win (each counts toward their individual 100 XP cap)
- Specific co-op mechanics vary by minigame (see table above)

### Anti-Cheat (Minigames)
- Timer runs server-side (start timestamp recorded at QR scan)
- Completion packet sent to server: `{ player_id, minigame_id, location_id, score, time_taken, completion_hash }`
- `completion_hash` = HMAC of (player_id + minigame_id + score + secret_salt) — prevents forged results
- Server validates time_taken is within plausible range
- Rate limiting: no more than 1 minigame completion per 4 minutes per player

---

## 7. XP, Scoring & Territory Capture

### XP Rules
- **Per minigame win:** 25 XP (credited to player AND to clan total)
- **Daily cap per player:** 100 XP (4 wins max per day)
- **Cooldown between games:** 5 minutes
- **No XP bonuses for streaks** — streak is a social/pride counter only

### Streak System (Participation Counter)
Streaks encourage daily participation without giving any XP or gameplay advantage.

**How it works:**
- A player's streak increments by 1 for each day they earn **at least 25 XP** (minimum 1 win)
- If a player earns 0 XP on a game day (8 AM–6 PM), their streak resets to 0
- Weekends/holidays (days with no active game) do NOT break streaks — only active game days count
- Streaks are visible on the **player profile** and the **clan scoreboard**

**Visual Treatment:**
- Small flame/leaf icon next to player name with streak number (e.g., 🔥 7)
- Milestone badges at streak thresholds: 3-day, 7-day, 14-day (full season)
- Streak milestones displayed on player profile as cottagecore-themed badges:
  - 3 days → "Seedling" (sprout icon)
  - 7 days → "Sapling" (small tree icon)
  - 14 days → "Ancient Oak" (full tree icon — perfect season attendance)
- Clan scoreboard shows average streak of clan members (social pressure)
- Elder Moss dialogue line when streak breaks: *"The grove misses you when you're away..."*

**What streaks do NOT do:**
- No bonus XP
- No extra chest drops
- No gameplay advantages whatsoever
- Purely a visual counter and bragging right

### Clan Scoring
- **Real-time clan scoreboard** visible to all players
- Clan score = sum of all clan members' XP earned today
- Tiebreaker: clan that reached the tied score first (earlier timestamp wins)

### Territory Capture (6:00 PM Daily)
1. At 6:00 PM IST, scoring freezes
2. Server compares clan totals
3. Winning clan announced via push notification to all players
4. Map updates: the day's target space gets winning clan's color overlay + banner
5. All daily XP resets to 0
6. All location locks clear
7. Captured territory is **permanent** (persists until admin resets or season ends)

### Admin Override
- Admin can manually assign/revoke territory captures
- Admin can reset all territories (season reset)
- Admin can view historical capture data

---

## 8. Economy & Collectibles

### Assets (Cosmetic Only)
Used to decorate personally captured spaces (individual decoration, not shared).

**Asset Categories:**
| Category | Examples | Rarity |
|----------|----------|--------|
| Banners | Clan banners, seasonal flags, custom pennants | Common |
| Statues | Stone fox, mossy owl, mushroom totem | Uncommon |
| Furniture | Wooden bench, lantern post, flower cart | Common |
| Murals | Vine wall art, pixel art landscape, clan crest | Rare |
| Pets | Pixel cat, firefly jar, baby fox, hedgehog | Rare |
| Special | Golden trophy, seasonal exclusive, event-only | Legendary |

### Chest Drops
- **Trigger:** Random chance after winning a minigame
- **Drop rate:** ~15% per win (tunable by admin)
- **Contents:** 1 random asset from the pool, weighted by rarity
- **Visual:** Cottagecore-style wooden chest animation opens to reveal item
- **Rare location chests:** Some locations may have boosted drop rates (admin-configurable)

### Personal Space Decoration
When a player's clan captures a space:
1. Player taps the captured space on the map
2. Opens a **personal decoration view** (only this player sees their version)
3. Drag-and-drop assets from inventory onto a small decoration canvas
4. Save layout → stored per player per space
5. Other players see their OWN decoration of the same space

### Asset Expiry System (Use It or Lose It)
Unplaced assets expire at **midnight (12:00 AM IST)** on the day they were obtained.

**How it works:**
- When a player obtains an asset (from a chest drop), it enters their **inventory** with a visible countdown timer
- The asset remains in inventory until midnight of that same day
- If the player **places the asset** in any captured space's decoration before midnight, it becomes **permanent** — no further expiry
- If the asset is still **unplaced at midnight**, it is **removed from inventory** permanently
- Players get a warning notification at 9 PM: *"You have X unplaced items — place them before midnight or they'll fade away!"*

**Design rationale:** This creates urgency to actually engage with the decoration system rather than hoarding. It also encourages players to check their clan's captured spaces regularly.

**Edge cases:**
- If a player's clan has no captured spaces yet, they still lose unplaced assets at midnight (tough luck — motivation to win)
- Assets placed in a decoration and then removed go back to inventory WITH a new midnight deadline
- Admin can create "permanent" assets (e.g., season rewards) that never expire

### Admin Asset Analytics
The admin dashboard shows:
- **Top collected assets** (ranked list by count across all players)
- **Asset distribution per clan**
- **Most decorated spaces**
- This data feeds the **real-world campus display** — admin manually creates physical banners based on the most popular digital decorations

---

## 9. Tutorial & Storyline

### NPC: The Grove Keeper

**Character:** An elderly, warm pixel art character — think a cottagecore grandparent figure wearing a straw hat, carrying a watering can, with a small fox companion. Name: **Elder Moss** (or similar — can be adjusted).

**Backstory:** Elder Moss has tended the campus grounds for decades. The campus was once alive with activity in every corner — students gathered in courtyards, gardens were lush, forgotten corridors were full of art. Over time, parts of the campus fell into neglect. Elder Moss discovered that the four ancient Houses (Red, Blue, Yellow, Green) once competed in a friendly rivalry that kept every space alive. Now, that rivalry needs to return.

### Tutorial Flow (~5 minutes)

**Scene 1: The Awakening (30s)**
- Screen: Soft morning light over the pixel art campus map
- Elder Moss appears in a dialogue box (pixel portrait + text)
- *"Ah, you're awake! I've been waiting for someone from [auto-detected House] to answer the call..."*
- *"This campus was once alive with the energy of the four Houses. But look at it now — half these spaces lie forgotten."*
- Camera slowly pans across the map, highlighting greyed-out areas

**Scene 2: The Lore (45s)**
- *"Long ago, the four Houses — Ember, Tide, Bloom, and Gale — competed to bring life to every corner of these grounds."*
- Brief animated vignettes showing each clan's identity:
  - **Ember (Red):** Warm hearths, lanterns, determination
  - **Tide (Blue):** Flowing water, calm strategy, wisdom
  - **Bloom (Yellow):** Flowers, growth, creativity
  - **Gale (Green):** Wind, forests, adventure
- *"The tradition faded... until now. You are part of the revival."*

**Scene 3: Character Creation (90s)**
- *"But first, let me see who you are. Every grove keeper started somewhere..."*
- Character creation screen styled as a "magical mirror" — cottagecore frame
- Player customizes: name, hair, skin, outfit, accessory
- Elder Moss reacts: *"Ah, a fine look! [House] will be proud."*
- Clan badge animation: player's avatar receives their house crest

**Scene 4: The Map (45s)**
- *"Now, let me show you the lay of the land..."*
- Tutorial highlights on the map:
  - "These glowing spots are where challenges await" → pin pulse animation
  - "Each day, one key space is up for the taking" → highlight the capturable space
  - "Walk there, scan the rune stone (QR code), and prove your worth" → QR icon
- *"Your House needs you. Every challenge you win brings life back to these grounds."*

**Scene 5: Practice Minigame (60s)**
- *"Let me test your readiness. Try this — a simple word challenge."*
- Player plays an easy version of Grove Words (4-letter word, 8 tries, generous timer)
- On win: *"Excellent! You're ready. Now go — the campus awaits!"*
- +0 XP (practice doesn't count)
- Tutorial complete → main map screen

**Scene 6: First Day Briefing (15s)**
- Push notification style: "Today's prize: [Space Name]! Your House currently has X XP."
- Pins appear on player's map
- Tutorial ends

---

## 10. Notifications

### Push Notification Schedule
| Trigger | Message | Time |
|---------|---------|------|
| Day start | "A new day dawns! Today's prize: [Space Name]. Go claim it for [Clan]!" | 8:00 AM |
| Morning event | "Break time! The grove has fresh challenges waiting nearby." | 10:40 AM |
| Lunch event | "Lunch break — perfect time to earn XP for [Clan]!" | 12:40 PM |
| Final push | "Last hour! [Clan] is [X XP] behind [Leading Clan]. Every win counts!" | 5:00 PM |
| Day result | "[Winning Clan] has captured [Space Name]! See the updated map." | 6:00 PM |
| Lock reminder | "Your lock at [Location] expires tomorrow. Try a different spot!" | Contextual |

### In-App Notifications
- Real-time clan score ticker at top of map screen
- Animated celebration when player's clan captures a space
- Badge notification for chest drops / new assets
- Asset expiry warning at 9 PM

### Admin Custom Notifications
Admins can push custom notifications to all players or specific clans at any time.

**Use cases:**
- Announce surprise events: *"Special chest drop rates at the Garden for the next hour!"*
- Share encouragement: *"Tide is surging! Can Ember fight back?"*
- Logistical updates: *"QR code at Library entrance has been replaced — scan the new one!"*
- Weather/campus alerts: *"Rain expected — indoor locations have bonus chests today!"*

**Admin dashboard interface:**
- **Message text** (140 char max — keeps it snappy)
- **Target audience:** All players / specific clan(s) / specific location visitors
- **Delivery:** Immediate push + in-app banner
- **Notification style:** Can be tagged as "Event", "Alert", "Hype", or "Info" — each gets a different icon/color in the app
- **History log:** All sent notifications visible in admin dashboard with timestamp and delivery stats

---

## 11. Admin Dashboard (Web)

### Dashboard Features

**Daily Management:**
- Set today's location pool (toggle locations on/off)
- Set today's capturable key space (dropdown of all campus spaces)
- Generate and download daily QR codes (printable PDF sheet)
- Preview announcement text
- **Send custom push notification** (message, target audience, notification type)

**Location Management:**
- CRUD for all campus locations
- Set GPS coordinates + geofence radius per location
- Tag with category, notes, activity log data
- Set chest drop rate modifier per location

**Map Calibration:**
- Upload/replace campus PNG
- Set 4 calibration points (pixel coords + GPS coords)
- Preview calibration accuracy with test points

**Analytics:**
- Daily/weekly/season XP totals per clan
- Participation rate per clan (% of members who played)
- Location heatmap (which pins get most traffic)
- Minigame win rates (which games are too easy/hard)
- Top collected assets (ranked list for physical display)
- Capture history timeline

**Season Management:**
- Start new season (resets all XP, optionally resets territories)
- Hall of Fame: season winners, top players, stats
- Export season data (CSV)

**User Management:**
- Import clan roster (CSV: email → house mapping)
- View player list, XP, status
- Ban/suspend players
- Manual XP adjustments (if needed)

---

## 12. Technical Architecture

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Mobile App** | React Native (Android) | Cross-platform capable, good GPS/camera/notification APIs, Claude Code friendly |
| **State Management** | Redux Toolkit or Zustand | Real-time score updates, offline-first minigame state |
| **Map Rendering** | React Native Canvas or react-native-skia | Render pixel art PNG + overlays + pins + player position |
| **QR Scanning** | react-native-camera + ML Kit or react-native-vision-camera | Fast QR decode |
| **GPS** | react-native-geolocation-service | High accuracy mode |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | Reliable Android push, free tier |
| **Backend API** | AWS Lambda + API Gateway | Serverless, scales to 500 DAU easily |
| **Database** | AWS DynamoDB | Real-time reads for clan scores, low latency |
| **Auth** | AWS Cognito | College email verification, JWT tokens |
| **File Storage** | AWS S3 | Campus map PNG, asset images, QR code PDFs |
| **Real-time Scores** | AWS AppSync (GraphQL subscriptions) or WebSocket via API Gateway | Live clan score updates |
| **Admin Dashboard** | React (web) | Hosted on AWS Amplify or S3 + CloudFront |
| **Scheduled Jobs** | AWS EventBridge + Lambda | 6 PM scoring, 8 AM day reset, 12 AM asset expiry, QR rotation |

### Data Model

**Users Table**
```
user_id          (PK) — UUID
email            — college email
display_name     — chosen pseudonym
clan             — "red" | "blue" | "yellow" | "green"
avatar_config    — JSON { hair_style, hair_color, skin_tone, outfit, accessory }
today_xp         — int (0–100)
season_xp        — int (cumulative)
total_wins       — int
current_streak   — int (consecutive game days with ≥1 win)
best_streak      — int (highest streak this season)
last_active_date — date (last game day with ≥1 win, for streak calc)
created_at       — timestamp
tutorial_done    — boolean
```

**Clans Table**
```
clan_id          (PK) — "red" | "blue" | "yellow" | "green"
today_xp         — int (real-time aggregate)
season_xp        — int
spaces_captured  — int
```

**Locations Table**
```
location_id      (PK) — UUID
name             — "North Courtyard"
gps_lat          — float
gps_lng          — float
geofence_radius  — int (meters, default 15)
category         — "courtyard" | "corridor" | "garden" | "classroom" | ...
active           — boolean
chest_drop_modifier — float (1.0 = normal, 1.5 = boosted)
notes            — text (admin notes, activity log insights)
```

**Daily Config Table**
```
date             (PK) — "2026-03-07"
active_locations — list of location_ids (today's pool)
target_space     — { name, description, map_overlay_id }
qr_secret        — daily HMAC secret for QR generation
winner_clan      — null until 6 PM
status           — "active" | "scoring" | "complete"
```

**Player Location Assignments Table**
```
date + user_id   (PK) — composite
assigned_locations — list of 3–5 location_ids
```

**Game Sessions Table**
```
session_id       (PK) — UUID
user_id          — FK
location_id      — FK
minigame_id      — FK
date             — date
started_at       — timestamp
completed_at     — timestamp (null if abandoned)
result           — "win" | "lose" | "timeout"
xp_earned        — int
chest_dropped    — boolean
chest_asset_id   — FK (null if no drop)
completion_hash  — HMAC for validation
```

**Player Locks Table**
```
date + user_id + location_id (PK)
locked_at        — timestamp
```

**Captured Spaces Table**
```
space_id         (PK) — UUID
date_captured    — date
clan             — winning clan
space_name       — "North Courtyard"
season           — int
permanent        — boolean (until admin reset)
```

**Player Assets Table**
```
user_id + asset_id (PK)
asset_id         — FK
obtained_at      — timestamp
obtained_from    — "chest" | "reward" | "event"
location_id      — where it was obtained (null if reward)
placed           — boolean (true if placed in a decoration)
expires_at       — timestamp (midnight of obtained day, null if permanent/placed)
expired          — boolean (set true by midnight cleanup job)
```

**Assets Catalog Table**
```
asset_id         (PK) — UUID
name             — "Mossy Owl Statue"
category         — "statue" | "banner" | "furniture" | "mural" | "pet" | "special"
rarity           — "common" | "uncommon" | "rare" | "legendary"
image_url        — S3 path
drop_weight      — int (higher = more likely in chests)
```

**Space Decorations Table**
```
user_id + space_id (PK)
layout           — JSON { placed_assets: [{ asset_id, x, y, rotation }] }
updated_at       — timestamp
```

**Map Calibration Table**
```
calibration_id   (PK)
map_image_url    — S3 path to campus PNG
points           — JSON [{ gps_lat, gps_lng, pixel_x, pixel_y } × 4]
transform_matrix — JSON [a, b, c, d, tx, ty]
created_at       — timestamp
active           — boolean
```

**Admin Notifications Table**
```
notification_id  (PK) — UUID
message          — text (140 char max)
target           — "all" | "red" | "blue" | "yellow" | "green" | custom filter
notification_type — "event" | "alert" | "hype" | "info"
sent_at          — timestamp
sent_by          — admin user_id
delivery_count   — int (number of devices reached)
```

---

## 13. Screen-by-Screen Flow

**Orientation:** All screens are locked to **landscape mode**. This maximizes the pixel art map's horizontal space, gives minigames a wider play area (ideal for grids, word puzzles, and side-by-side co-op), and matches the natural aspect ratio of the campus map PNG.

### Screen List

1. **Splash Screen** — App logo, loading
2. **Login Screen** — College email input → verification code
3. **Tutorial (5 screens)** — Storyline onboarding (see Section 9)
4. **Character Creation** — Embedded in tutorial Scene 3
5. **Main Map Screen** — The core screen: pixel art map + pins + scores + player position
6. **QR Scanner** — Camera overlay with scan frame
7. **Minigame Selection** — List of 3–5 available minigames at this location
8. **Minigame Play** — Full-screen minigame with timer
9. **Result Screen** — Win/lose animation, XP gained, chest drop
10. **Clan Scoreboard** — Real-time scores for all 4 clans today
11. **Player Profile** — Avatar, stats, collected assets
12. **Space Decoration** — Drag-and-drop asset placement on captured space
13. **Asset Inventory** — Grid view of all collected items
14. **Capture Celebration** — Full-screen animation when your clan wins a space
15. **Season Summary** — End-of-season hall of fame and stats
16. **Settings** — Notifications toggle, about, logout

### Screen Details

**Main Map Screen (Core Screen) — Landscape**
```
┌──────────────────────────────────────────────────────────────────┐
│ 🔴 420  🔵 385  🟡 310  🟢 290  │  ⏱ 3h 24m to results  │ 🔥 7 │
├──────────────────────────────────────────────────┬───────────────┤
│                                                  │ 📍 Today's    │
│                                                  │ Locations:    │
│           ┌──── Pixel Art Map ────┐              │               │
│           │  ★ captured space     │              │ • North Garden│
│           │  📍 active pin        │              │ • Library     │
│           │  🔒 locked pin        │              │ • East Wing   │
│           │  👤 player position   │              │               │
│           └───────────────────────┘              │ 🏆 Today:     │
│                                                  │ [Space Name]  │
│              ← Pan + zoom (pinch) →              │               │
├──────────────────────────────────────────────────┴───────────────┤
│  [Scan QR]          [Profile]          [Inventory]       [Clan]  │
└──────────────────────────────────────────────────────────────────┘
```

Wide landscape layout gives the map maximum screen real estate, with a side panel for today's info. The bottom nav stays easily thumb-accessible.

**Minigame Selection (after QR scan) — Landscape**
```
┌──────────────────────────────────────────────────────────────────┐
│ 📍 North Garden  —  "Choose your challenge!"     XP: 50/100     │
├──────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│ │ 📝          │ │ 🔗          │ │ 🧩          │ │ 🌿         │ │
│ │ Grove Words │ │ Kindred     │ │ Pips        │ │ Vine Trail │ │
│ │ Guess the   │ │ Group 16    │ │ Fill the    │ │ Find words │ │
│ │ word in 6   │ │ words into  │ │ shape in    │ │ in the     │ │
│ │ tries       │ │ 4 groups    │ │ limited     │ │ letter     │ │
│ │             │ │             │ │ moves       │ │ grid       │ │
│ │ ⏱ 120s     │ │ ⏱ 150s     │ │ ⏱ 90s      │ │ ⏱ 180s    │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│ [Co-op Mode: OFF 🔘]                        [Back to Map]       │
└──────────────────────────────────────────────────────────────────┘
```

Landscape lets all 4 minigame cards display in a single row with descriptions visible.

---

## 14. API Endpoints

### Auth
- `POST /auth/signup` — Register with college email
- `POST /auth/verify` — Verify email code
- `POST /auth/login` — Get JWT token

### Player
- `GET /player/profile` — Get own profile
- `PUT /player/avatar` — Update avatar config
- `GET /player/assets` — Get collected assets
- `GET /player/stats` — Get XP, wins, etc.

### Map & Locations
- `GET /map/config` — Get current map image URL + calibration matrix
- `GET /locations/today` — Get this player's assigned locations for today
- `GET /daily/info` — Get today's target space, event windows, etc.

### Game Sessions
- `POST /game/scan` — Submit QR scan + GPS for verification → returns minigame list
- `POST /game/start` — Start a minigame session → returns session_id + server timestamp
- `POST /game/complete` — Submit minigame result → returns XP, chest drop, etc.
- `GET /game/cooldown` — Check remaining cooldown time

### Scores
- `GET /scores/clans` — Get real-time clan XP totals (also via WebSocket subscription)
- `GET /scores/history` — Get capture history for map overlay

### Spaces & Decoration
- `GET /spaces/captured` — Get all captured spaces + winning clans (for map overlays)
- `GET /spaces/{id}/decoration` — Get player's decoration layout for a space
- `PUT /spaces/{id}/decoration` — Save decoration layout

### Admin
- `POST /admin/daily/config` — Set today's locations + target space
- `POST /admin/qr/generate` — Generate QR codes for today's locations
- `POST /admin/notifications/send` — Send custom push notification (message, target, type)
- `GET /admin/notifications/history` — View sent notification log
- `GET /admin/analytics/...` — Various analytics endpoints
- `POST /admin/season/reset` — Reset season
- `POST /admin/roster/import` — Upload clan roster CSV
- `PUT /admin/locations/{id}` — Update location settings

---

## 15. Phased Build Plan

### Phase 1: Foundation (Week 1–2)
**Goal:** Core infrastructure, auth, and map rendering

- [ ] React Native project setup (Android)
- [ ] AWS backend: Cognito auth, DynamoDB tables, Lambda functions, API Gateway
- [ ] College email sign-up / login flow
- [ ] Clan roster CSV import → auto-assignment
- [ ] Campus map PNG rendering with pan/zoom
- [ ] 4-point calibration system (admin uploads map, sets calibration points)
- [ ] GPS location tracking + player dot on map
- [ ] Basic admin dashboard (web): login, location CRUD, map calibration

### Phase 2: Core Game Loop (Week 3–4)
**Goal:** QR scanning, minigames, XP system

- [ ] QR code generation system (daily rotating, HMAC-signed)
- [ ] QR scanner in app (camera → decode → verify)
- [ ] GPS geofence verification
- [ ] Location pin rendering on map (active, locked, greyed out)
- [ ] Randomized location assignment per player per day
- [ ] Build first 3 minigames: Grove Words, Kindred, Stone Pairs
- [ ] Minigame timer system
- [ ] XP award on win (25 XP)
- [ ] Location lock on lose
- [ ] Daily XP cap (100)
- [ ] 5-minute cooldown between games
- [ ] Real-time clan scoreboard (WebSocket or AppSync)

### Phase 3: Territory & Capture (Week 5)
**Goal:** Daily capture cycle, map territory system

- [ ] 6 PM scoring trigger (EventBridge → Lambda)
- [ ] Clan comparison + winner determination
- [ ] Map territory overlay rendering (clan colors on captured spaces)
- [ ] Capture history storage
- [ ] 8 AM daily reset (clear XP, locks, assign new locations)
- [ ] Admin: set daily capturable space
- [ ] Push notification system (FCM): day start, events, results
- [ ] Capture celebration screen

### Phase 4: Content & Polish (Week 6–7)
**Goal:** More minigames, assets, decoration, tutorial, streak system

- [ ] Build remaining 9 minigames (12 total)
- [ ] Co-op mode (shared screen, same clan)
- [ ] Chest drop system (random after wins)
- [ ] Asset catalog + inventory screen (with expiry countdown timers)
- [ ] Asset expiry system (midnight cleanup Lambda job)
- [ ] 9 PM asset expiry warning notification
- [ ] Space decoration screen (drag-and-drop, landscape layout)
- [ ] Character creation screen (pixel art customization)
- [ ] Full tutorial/storyline (Elder Moss, 5 scenes)
- [ ] Event windows (notifications at break times)
- [ ] Player profile screen (with streak display + milestone badges)
- [ ] Streak tracking system (increment on active days, reset on miss)

### Phase 5: Admin & Analytics (Week 7–8)
**Goal:** Full admin dashboard, analytics, season system, custom notifications

- [ ] Admin dashboard: daily config wizard (locations + space + QR generation)
- [ ] Admin custom push notification system (compose, target, send, history log)
- [ ] Analytics: clan stats, location heatmap, minigame win rates
- [ ] Asset analytics (top collected, distribution, expiry rates)
- [ ] Streak analytics (avg streak per clan, participation trends)
- [ ] Season management (start, end, reset, hall of fame)
- [ ] Season summary screen in app
- [ ] Admin: manual territory override + reset
- [ ] QR code printable PDF generation

### Phase 6: Testing & Launch (Week 8–9)
**Goal:** Beta testing, bug fixes, soft launch

- [ ] Internal team testing (all flows)
- [ ] GPS accuracy testing on campus (calibration verification)
- [ ] QR code testing at all locations
- [ ] Load testing (simulate 500 concurrent users)
- [ ] Anti-cheat validation
- [ ] Bug fixes + performance optimization
- [ ] Soft launch with 1 clan → expand to all 4

---

## 16. Clan Lore & Theming

### The Four Houses

| House | Color | Name | Element | Personality | Icon |
|-------|-------|------|---------|-------------|------|
| Red | #C0392B | **Ember** | Fire/Warmth | Bold, determined, passionate | Lantern |
| Blue | #2980B9 | **Tide** | Water/Calm | Strategic, wise, patient | Wave |
| Yellow | #F1C40F | **Bloom** | Sun/Growth | Creative, cheerful, nurturing | Sunflower |
| Green | #27AE60 | **Gale** | Wind/Forest | Adventurous, free-spirited, resilient | Leaf |

### Cottagecore Art Direction
- **Color palette:** Warm earth tones, muted pastels, forest greens, honey golds
- **UI elements:** Wooden frames, parchment textures, hand-drawn borders
- **Icons:** Mushrooms, lanterns, flowers, acorns, birds, foxes
- **Typography:** Pixel font for game text, handwritten-style for headers
- **Sound direction (future):** Gentle acoustic guitar, bird chirps, wind chimes, stream sounds
- **Animations:** Soft, bouncy — leaves falling, fireflies, gentle sparkles

---

## 17. Safety & Constraints

- **Active hours only:** Game only functional 8 AM – 6 PM IST
- **No secluded locations:** Admin responsibility to only add safe, visible locations
- **Emergency contact:** Settings screen includes campus security number
- **Location data:** GPS only used during active gameplay, not tracked otherwise
- **Privacy:** Pseudonymous display names, no real names exposed to other players
- **Reporting:** In-app "Report Issue" button (safety concern, broken QR, etc.)

---

## 18. Future Considerations (Post-MVP)

These are NOT in scope for launch but worth keeping in mind:

- **Individual leaderboards** (once game is established)
- **Streak XP bonuses** (reward long streaks with bonus XP — currently streaks are display-only)
- **Wheel spin mechanic** at specific locations
- **Inter-clan trading** of assets
- **Live events** (special 1-hour challenges with unique rewards)
- **Sound and music** (cottagecore ambient soundtrack)
- **iOS version** (React Native makes this relatively easy)
- **Activity log integration** (feed new usage data back into revitalization analytics)
- **Dynamic location selection** (algorithm picks underused spaces automatically)
- **Spectator mode** (watch real-time campus activity on the map)
- **Portrait mode option** (currently locked to landscape — could add toggle later)

---

## Appendix A: Map Calibration Math

### Affine Transformation (2D)

Given 4 point pairs: (gps₁, pixel₁), (gps₂, pixel₂), (gps₃, pixel₃), (gps₄, pixel₄)

We need to find the 6 parameters [a, b, tx, c, d, ty] such that:

```
pixel_x = a * gps_lng + b * gps_lat + tx
pixel_y = c * gps_lng + d * gps_lat + ty
```

With 4 points (8 equations, 6 unknowns), we use least-squares to find the best fit:

```javascript
// Using 4 calibration points
function computeAffineTransform(gpsPoints, pixelPoints) {
  // Build matrices for least squares: A * params = B
  // A = [[lng1, lat1, 1, 0, 0, 0], [0, 0, 0, lng1, lat1, 1], ...]
  // B = [px1, py1, px2, py2, ...]
  // Solve via pseudoinverse: params = (A^T * A)^-1 * A^T * B
  // Returns: { a, b, c, d, tx, ty }
}

// Convert GPS to pixel
function gpsToPixel(lat, lng, transform) {
  return {
    x: transform.a * lng + transform.b * lat + transform.tx,
    y: transform.c * lng + transform.d * lat + transform.ty
  };
}

// Convert pixel to GPS (inverse transform)
function pixelToGps(px, py, transform) {
  // Compute inverse of 2x2 matrix [a,b; c,d] and apply
  const det = transform.a * transform.d - transform.b * transform.c;
  return {
    lng: (transform.d * (px - transform.tx) - transform.b * (py - transform.ty)) / det,
    lat: (-transform.c * (px - transform.tx) + transform.a * (py - transform.ty)) / det
  };
}
```

### GPS Accuracy on Small Campus (~80m)

At this latitude (India), 1 degree of latitude ≈ 111,000 meters, 1 degree of longitude ≈ ~100,000 meters (varies by latitude).

80 meters ≈ 0.0007° latitude ≈ 0.0008° longitude

Android high-accuracy GPS typically gives ±3-5m accuracy. With a 15m geofence radius, this provides good coverage even with slight drift.

---

## Appendix B: QR Code Payload Specification

### QR Content Format
```json
{
  "v": 1,
  "l": "location_uuid_here",
  "d": "2026-03-07",
  "h": "hmac_sha256_signature"
}
```

- `v` — version number (for future format changes)
- `l` — location ID
- `d` — date (YYYY-MM-DD)
- `h` — HMAC-SHA256 of `{l}:{d}` signed with daily secret

### Verification
```javascript
const expected = hmac_sha256(dailySecret, `${qr.l}:${qr.d}`);
const valid = (qr.h === expected) && (qr.d === today());
```

---

*End of Game Design Document — GroveWars v1.1*
