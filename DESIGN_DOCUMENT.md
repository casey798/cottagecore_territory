# GroveWars — Game Design Document

> **Version**: 2.0 · **Last updated**: 2026-03-22
> **Platform**: Android (React Native) · **Backend**: AWS Serverless (SAM)
> **Admin**: React web dashboard

---

## Table of Contents

1. [Game Concept](#1-game-concept)
2. [Players, Clans & Identity](#2-players-clans--identity)
3. [The Daily Cycle](#3-the-daily-cycle)
4. [Location System](#4-location-system)
5. [Assignment Algorithm](#5-assignment-algorithm)
6. [QR Scanning & Geofencing](#6-qr-scanning--geofencing)
7. [Minigames](#7-minigames)
8. [Co-op Play](#8-co-op-play)
9. [Scoring & Territory Capture](#9-scoring--territory-capture)
10. [Chests & Assets](#10-chests--assets)
11. [Space Decoration](#11-space-decoration)
12. [Free-Roam Check-Ins](#12-free-roam-check-ins)
13. [Sentiment & Research Data](#13-sentiment--research-data)
14. [Player Progression](#14-player-progression)
15. [Journal System](#15-journal-system)
16. [Notifications & Real-Time Events](#16-notifications--real-time-events)
17. [Tutorial & Onboarding](#17-tutorial--onboarding)
18. [Admin Dashboard](#18-admin-dashboard)
19. [Season System](#19-season-system)
20. [Analytics & Data Outputs](#20-analytics--data-outputs)
21. [Full Playthrough Walkthrough](#21-full-playthrough-walkthrough)
22. [Technical Architecture](#22-technical-architecture)
23. [Security Model](#23-security-model)
24. [Appendices](#24-appendices)

---

## 1. Game Concept

GroveWars is a **clan-based territory capture game** designed for a campus environment. Players physically visit real-world locations, scan QR codes to prove presence, and play short brain-teaser minigames to earn XP for their clan. At the end of each day, the clan with the most XP captures a contested territory ("target space") on the campus map.

The game serves a dual purpose:

1. **Player experience** — a competitive, social, daily ritual that encourages exploration of under-visited campus spaces.
2. **Research instrument** — the game generates rich behavioural data: where people go, how long they stay, what they enjoy, and whether they would return to a space without the game as a prompt.

The cottagecore aesthetic wraps the entire experience in a warm, whimsical art style — stone paths, fireflies, growing vines, and forest creatures.

---

## 2. Players, Clans & Identity

### 2.1 Authentication

Players sign in via **Google Login** (Firebase Auth → backend verification). Their Google email is matched against a pre-imported **roster** (CSV uploaded by admins). This ensures only authorised campus members can play.

### 2.2 Clans

There are **five clans**, each with a thematic identity:

| Clan ID | Name |
|---------|------|
| `ember` | Ember |
| `tide`  | Tide  |
| `bloom` | Bloom |
| `gale`  | Gale  |
| `hearth`| Hearth |

Players choose a clan during onboarding. Clan assignment is permanent for the season. Each clan has:

- `todayXp` — XP accumulated today
- `todayXpTimestamp` — ISO timestamp of when todayXp was last incremented (used for tiebreaking)
- `seasonXp` — cumulative XP across the season
- `spacesCaptured` — number of territories won this season
- `todayParticipants` — count of unique players who earned XP today
- `rosterSize` — total registered members

### 2.3 Character Creation

Players customise a pixel-art avatar with:

| Attribute | Range |
|-----------|-------|
| Hair style | 0–7 (8 options) |
| Hair color | 0–9 (10 options) |
| Skin tone | 0–7 (8 options) |
| Outfit | 0–7 (8 options) |
| Accessory | 0–9 (10 options) |
| Character preset | 0–7 (optional shortcut) |

Display names are 3–20 characters, alphanumeric with spaces. Each player also receives a unique **player code** (prefixed `GRV`) used for co-op partner search.

---

## 3. The Daily Cycle

The game runs on a strict **IST (India Standard Time)** daily cycle. Every day follows this rhythm:

```
08:00 IST — DAILY RESET (automated)
  ├── Yesterday's config marked 'complete'
  ├── All player todayXp → 0
  ├── All clan todayXp → 0, timestamps cleared
  ├── Missed-day streaks reset
  ├── Player-locks from yesterday deleted
  ├── New location assignments generated per player
  ├── Boosted location bonuses reverted
  ├── WebSocket broadcast: DAILY_RESET
  └── Push notification: "New day, new quest!"

08:00–18:00 IST — GAME HOURS
  Players scan QR codes, play minigames, earn XP.
  Real-time clan scores visible on scoreboard.

18:00 IST — DAILY SCORING (automated)
  ├── Winner clan determined (highest todayXp)
  ├── Tiebreaker: EARLIER todayXpTimestamp wins
  ├── Captured-space record created for winner
  ├── Player streaks updated (played today → +1, missed → reset)
  ├── WebSocket broadcast: CAPTURE + SCORING_COMPLETE
  └── Push notification: "[Clan] captured [Space]!"

~23:59 IST — ASSET EXPIRY WARNING
  └── Players with unplaced expiring assets get push notification
```

### 3.1 Quiet Mode

Admins can toggle `quietMode` on a daily config. When active, the day runs without active locations or a target space — useful for holidays or exam periods.

---

## 4. Location System

### 4.1 Location Properties

Each location represents a **physical campus space** with a QR code. A location has:

| Field | Description |
|-------|-------------|
| `locationId` | UUID |
| `name` | Human-readable name (e.g., "Central Courtyard") |
| `gpsLat`, `gpsLng` | GPS coordinates |
| `geofenceRadius` | Metres — how close a player must be (default 15m) |
| `category` | Courtyard, Corridor, Garden, Classroom, Other |
| `floor` | Ground or First |
| `active` | Whether available for assignment |
| `chestDropModifier` | Multiplier on chest drop rate (default 1.0) |
| `coopOnly` | If true, only co-op minigames available here |

### 4.2 Location Classifications

Locations are classified based on Phase 1 research data:

| Classification | Description |
|----------------|-------------|
| **Social Hub** | High traffic, naturally popular |
| **Transit / Forced Stay** | People pass through or are required to be there |
| **Hidden Gem** | Low traffic but high satisfaction when visited |
| **Dead Zone** | Low traffic and low satisfaction |
| **Unvisited** | No Phase 1 data available |
| **TBD** | Not yet classified |

### 4.3 Location Modifiers

Each location can have special modifiers that affect gameplay:

| Modifier | Effect |
|----------|--------|
| `firstVisitBonus` | Boolean — extra XP on first-ever visit |
| `bonusXP` | Additional XP on top of base 25 (e.g., Dead Zone Revival boost) |
| `coopOnly` | Forces co-op play at this location |
| `spaceFact` | Informational text shown to the player about the space |
| `minigameAffinity` | Preferred minigame type for this location |

---

## 5. Assignment Algorithm

Each morning at 8:00 AM IST, the **daily reset** generates personalised location assignments for every registered player. This is the core mechanism that drives players to diverse campus spaces.

### 5.1 How It Works

1. **Active locations** for the day are set by admin (via `setDailyConfig`) or auto-selected.
2. Each player receives **3–5 assigned locations** from the active pool.
3. Assignments are stored in the `player-assignments` table, keyed by `YYYY-MM-DD#userId`.

### 5.2 Weighted Selection

The algorithm uses **cluster-aware weighted selection**. Each player has a `phase1Cluster` (from Phase 1 research) or a `computedCluster` (from ongoing behavioural analysis):

| Cluster | Description |
|---------|-------------|
| `nomad` | Explores widely, visits many unique spaces |
| `seeker` | Actively seeks out new or interesting locations |
| `drifter` | Moves casually, moderate engagement |
| `forced` | Mostly visits required/transit locations |
| `disengaged` | Low participation, needs nudging |

Each cluster has **weight preferences** for location classifications. For example, a `disengaged` player might get higher weight on Social Hubs (easy wins) while a `nomad` gets more Hidden Gems and Dead Zones (exploration challenge).

The weight configuration is stored in `cluster-weight-config`:

```
ClusterWeights = {
  'Social Hub': number,
  'Transit / Forced Stay': number,
  'Hidden Gem': number,
  'Dead Zone': number,
  'Unvisited': number,
  'TBD': number
}
```

### 5.3 Constraints

- **Bad pairings**: Certain location combinations are avoided (e.g., two adjacent corridors)
- **Rotation history**: The algorithm checks the last 3 days of assignments to avoid repetition
- **Adjacency limits**: No more than N locations from the same building zone
- **Co-op slots**: A percentage of assignments include co-op-only locations (configurable per cluster via `coopChances`)

### 5.4 What Gets Stored

The `PlayerAssignment` record includes:

| Field | Purpose |
|-------|---------|
| `dateUserId` | Partition key: `YYYY-MM-DD#userId` |
| `assignedLocationIds` | Array of 3–5 location UUIDs |
| `coopLocationIds` | Subset that are co-op designated |
| `locationMinigames` | Map of locationId → array of pre-rolled minigame IDs |
| `weightsUsed` | The weight config applied (for auditing) |

---

## 6. QR Scanning & Geofencing

Scanning a QR code is the gateway to gameplay. It's a **7-step validation chain**:

### Step 1: QR Authenticity
- Parse the QR payload: `{ v, l (locationId), d (date or 'permanent'), h (HMAC) }`
- Version 1 (daily): HMAC of `locationId:date` using daily secret
- Version 2 (permanent): HMAC of `locationId` using location-specific secret
- Timing-safe comparison prevents replay attacks

### Step 2: Location Validity
- Location must exist and be marked `active`
- Location must be in today's active locations (from `daily-config`)

### Step 3: Geofence Check
- Player's GPS coordinates are validated against the location's GPS using **Haversine distance**
- Must be within `geofenceRadius` metres (default 15m)
- Prevents remote scanning

### Step 4: Assignment Check
- Location must be in the player's `assignedLocationIds` for today
- Unassigned locations are rejected

### Step 5: Lock Check
- If the player has a `player-lock` for this location (from a previous loss), they cannot re-attempt until 8:00 AM next day

### Step 6: Daily Cap Check
- If the player has already earned 100 XP today (4 wins × 25 XP), they get a "cap reached" response
- They can still play in practice mode but earn no XP

### Step 7: Session Cleanup & Minigame Roll
- Any abandoned previous sessions are closed
- A set of **available minigames** is rolled for this location visit
- Solo locations get difficulty-bucketed random selection
- Co-op locations get flat random selection
- Previously won minigames at this location today are marked as `completed`

### Scan Response

On success, the player receives:

```typescript
{
  locationId: string,
  locationName: string,
  availableMinigames: [{
    minigameId: string,
    name: string,
    timeLimit: number,
    description: string,
    completed: boolean     // won already today
  }],
  locationModifiers: {
    coopOnly: boolean,
    spaceFact?: string,
    firstVisitBonus?: boolean,
    bonusXP?: number,
    minigameAffinity?: string
  }
}
```

---

## 7. Minigames

GroveWars features **15 solo minigames** and **6 co-op variants**, spanning puzzle types from word games to logic grids.

### 7.1 Solo Minigames

| ID | Display Name | Time | Description |
|----|-------------|------|-------------|
| `stone-pairs` | Stone Pairs | 60s | Memory card matching — find all pairs |
| `leaf-sort` | Color Sort | 90s | Sort colored beads into matching jars |
| `bloom-sequence` | Spot the Pattern | 60s | Identify the pattern across 5 items, pick the 6th (3 rounds) |
| `firefly-flow` | Connect the Dots | 90s | Connect matching color pairs with non-crossing paths |
| `number-grove` | Mini Sudoku | 90s | Fill a 6×6 grid with numbers 1–6 |
| `grove-words` | Wordle | 120s | Guess a hidden word in 6 attempts |
| `word-groups` | Word Groups | 150s | Sort 16 words into 4 thematic groups (max 8 mistakes) |
| `cipher-stones` | Cipher | 150s | Decode a scrambled famous quote |
| `pips` | Snuff Out | 75s | Toggle cells in a grid to make all cells dark |
| `mosaic` | Tile Fit | 120s | Fit shaped pieces (L, T, bar, etc.) into a target grid |
| `potion-logic` | Logic Grid | 150s | Deduce potion ingredients and effects from clues |
| `path-weaver` | Nonogram | 180s | Fill a pixel grid guided by row/column number clues |
| `grove-equations` | Number Crunch | 90s | Tap operators (+, −, ×, ÷) to make numbers hit a target |
| `shift-slide` | Tile Slide | 120s | Slide tiles to reassemble a scrambled picture |
| `vine-trail` | Word Hunt | 180s | Find hidden words in a letter grid |

### 7.2 Co-op Minigames

| ID | Base Game | Time | Co-op Mechanic |
|----|-----------|------|----------------|
| `word-groups-coop` | Word Groups | 150s | Split-screen team challenge |
| `cipher-stones-coop` | Cipher | 150s | Collaborative decode |
| `pips-coop` | Snuff Out | 75s | Shared grid toggle |
| `stone-pairs-coop` | Stone Pairs | 60s | Collaborative matching |
| `potion-logic-coop` | Logic Grid | 150s | Shared deduction |
| `vine-trail-coop` | Word Hunt | 180s | Collaborative word finding |

### 7.3 Server-Side Puzzle Generation

For fairness, puzzles are generated **server-side** when a minigame starts. The following games have server-generated puzzles:

- **Mosaic**: Grid dimensions, target cells, available tiles, and solution pre-computed
- **Path Weaver**: Nonogram grid with row/column clues
- **Grove Equations**: Target numbers and available operands
- **Bloom Sequence**: Pattern sequences with answer options
- **Shift Slide**: Tile arrangement with solution order
- **Pips**: Initial grid state with guaranteed solvability

Other minigames generate puzzles client-side from seeded randomness.

### 7.4 Minigame Lifecycle

```
Player selects minigame
  → POST /game/start-minigame
    ├── Creates GameSession (status: in-progress)
    ├── Generates puzzle server-side (if applicable)
    ├── Stores _salt for completion hash
    └── Returns { sessionId, salt, puzzleData, timeLimit }

Player plays the minigame locally

Player finishes
  → POST /game/complete-minigame
    ├── Validates completion hash (anti-cheat)
    ├── Validates time: 5s min ≤ elapsed ≤ timeLimit + 5s
    ├── Validates puzzle solution (server-side check)
    ├── If WIN: award XP, update clan, roll chest
    ├── If LOSE: create player-lock for location
    └── Returns { result, xpEarned, chestDrop, newTodayXp, ... }
```

### 7.5 Anti-Cheat Measures

- **Completion hash**: Client computes `HMAC(sessionId:result:timeTaken)` with a shared salt. Server verifies.
- **Server-side timing**: Elapsed time calculated from `startedAt` to `completedAt`, not client-reported.
- **Minimum time**: 5 seconds minimum to prevent instant-win exploits.
- **Maximum time**: `timeLimit + 5s` grace period, then timeout.
- **Solution verification**: For server-generated puzzles, the submitted solution is checked against the stored answer.

---

## 8. Co-op Play

### 8.1 When Co-op Happens

Co-op play occurs when:
- A location is marked `coopOnly`, OR
- The player's assignment includes the location in `coopLocationIds`

### 8.2 Partner Matching

When a player scans a co-op location, the game responds with `partnerRequired: true`. The player must then:

1. Search for a partner by **player code** (GRV-XXXX) or **display name**
2. Select a partner from search results
3. Re-submit the scan with `coopPartnerId`

### 8.3 Partner Validation

The server validates that the co-op partner:
- Exists and is a registered player
- Has not hit their daily XP cap
- Does not have a lock on this location
- Has not already won a minigame at this location today
- Has this location in their assignment (with exception: "guest" partners can play at locations not in their assignment, but will be locked on loss)

### 8.4 Co-op Rewards

**Both players receive full rewards** on a win:
- 25 XP each (subject to daily cap)
- Each player's clan gets the XP independently
- Chest drops roll independently for each player
- **Co-op chest weights are significantly better** than solo:

| Rarity | Solo Weight | Co-op Weight |
|--------|-----------|-------------|
| Common | 60% | 15% |
| Uncommon | 25% | 20% |
| Rare | 12% | 40% |
| Legendary | 3% | 25% |

### 8.5 Cross-Clan Co-op

Partners can be from **different clans**. When a cross-clan pair wins, both clans receive XP. This creates interesting dynamics — helping an opponent's clan member still benefits your own clan through your personal XP.

---

## 9. Scoring & Territory Capture

### 9.1 XP Rules

| Rule | Value |
|------|-------|
| XP per win | **25** (fixed, no modifiers except bonusXP locations) |
| Daily XP cap | **100** per player (4 wins max that count) |
| Bonus XP | Additional XP from Dead Zone Revival or admin-boosted locations |
| Clan XP | Sum of all member XP earned today |

### 9.2 Atomic Clan Updates

Clan XP is updated using DynamoDB **ADD expressions** (never read-modify-write) to prevent race conditions when multiple players complete games simultaneously.

### 9.3 Daily Scoring (6:00 PM IST)

At the end of game hours:

1. The system reads all clan `todayXp` values.
2. The clan with the **highest todayXp** wins.
3. **Tiebreaker**: If two clans have equal XP, the one whose `todayXpTimestamp` is **earlier** wins. This rewards the clan that reached its score first.
4. A `captured-space` record is created for the winning clan, containing:
   - The target space definition (name, map overlay, polygon/grid)
   - A snapshot of all clans' XP that day
   - The season number

### 9.4 The Map

Captured spaces are displayed on the campus map. Each space is coloured by the controlling clan. Players can:
- See which clan controls which territory
- View capture history (who won what, when)
- Decorate their clan's captured spaces (see §11)

### 9.5 Participation Tracking

`todayParticipants` on each clan is incremented when a player earns XP. This allows the admin to see **participation rate** (participants / rosterSize) alongside raw XP.

---

## 10. Chests & Assets

### 10.1 Chest Drops

When a player **wins a minigame that earns XP** (i.e., they haven't hit the daily cap), a chest is **guaranteed to drop** (100% drop rate on XP-earning wins).

The chest contains one asset, rolled from the `asset-catalog` using weighted rarity:

**Solo chest weights:**
| Rarity | Drop chance |
|--------|------------|
| Common | 60% |
| Uncommon | 25% |
| Rare | 12% |
| Legendary | 3% |

**Co-op chest weights (much better):**
| Rarity | Drop chance |
|--------|------------|
| Common | 15% |
| Uncommon | 20% |
| Rare | 40% |
| Legendary | 25% |

### 10.2 Asset Properties

Each asset in the catalog has:

| Field | Description |
|-------|-------------|
| `assetId` | Unique identifier |
| `name` | Display name |
| `category` | Banner, Statue, Furniture, Mural, Pet, Special |
| `rarity` | Common, Uncommon, Rare, Legendary |
| `imageKey` | S3 key for the sprite |
| `dropWeight` | Relative weight within its rarity tier |

### 10.3 Player Assets

When a player receives an asset:

| Field | Description |
|-------|-------------|
| `userAssetId` | Unique ownership ID |
| `userId` | Owner |
| `assetId` | Reference to catalog |
| `obtainedAt` | When received |
| `obtainedFrom` | `chest`, `reward`, or `event` |
| `locationId` | Where it was earned |
| `placed` | Whether currently placed in a decoration |
| `expiresAt` | Midnight IST — assets expire if not placed! |
| `permanent` | Some assets (badges, specials) never expire |

### 10.4 Asset Expiry

Non-permanent assets expire at **midnight IST** (18:30 UTC). Players are warned via push notification before expiry. Placed assets are safe — only unplaced ones expire.

---

## 11. Space Decoration

### 11.1 How It Works

When a clan captures a territory, members of that clan can **decorate the space** by placing their earned assets on a grid canvas representing the territory.

### 11.2 Placement

Each placed asset has:

| Field | Description |
|-------|-------------|
| `userAssetId` | Which asset is placed |
| `x`, `y` | Grid coordinates |
| `rotation` | 0°, 90°, 180°, or 270° |

### 11.3 Visibility

Decorations are visible to **all players** on the map. This creates a sense of clan pride — the more assets your clan earns, the more richly decorated your territories become.

### 11.4 Most Decorated Spaces

The admin dashboard and season summary track which spaces have the most decorations, creating a secondary competition layer.

---

## 12. Free-Roam Check-Ins

### 12.1 Purpose

Free-roam check-ins are a **research data collection** mechanism that runs alongside the game. Players can check in to campus locations outside the game flow to report:

- Where they are (GPS + map pixel coordinates)
- What they're doing (activity category)
- How satisfied they are
- Whether they'd return without the game

### 12.2 Check-In Data

Each check-in captures:

| Field | Description |
|-------|-------------|
| `gpsLat`, `gpsLng` | GPS position |
| `pixelX`, `pixelY` | Map pixel position (optional) |
| `floor` | Ground or First floor |
| `activityCategory` | One of four types (see below) |
| `satisfaction` | 0, 0.25, 0.5, 0.75, or 1.0 |
| `sentiment` | "yes", "maybe", or "no" — would return here without game? |
| `durationMinutes` | How long they've been there (1–600 min) |
| `activityTime` | IST timestamp of when the activity occurred |

### 12.3 Activity Categories

| Category | Description |
|----------|-------------|
| `high_effort_personal` | Studying, working, personal projects |
| `low_effort_personal` | Scrolling, resting, eating alone |
| `high_effort_social` | Group study, club activities, sports |
| `low_effort_social` | Chatting, hanging out, casual socialising |

### 12.4 Rate Limits

- **30 seconds** minimum between check-ins
- **600 minutes** (10 hours) cumulative duration cap per day
- Check-in hours: 8:00 AM – 6:00 PM IST only

---

## 13. Sentiment & Research Data

### 13.1 Space Sentiment

After completing a minigame, players are asked:

> **"Would you return to this space without the game?"**

Options: **Yes** · **Maybe** · **No**

This is stored on the `GameSession` record as `spaceSentiment` and `sentimentSubmittedAt`. It cannot be changed once submitted.

### 13.2 Why This Matters

The game is designed as a **spatial behavioural intervention**. The core research question is: _Can a game change how people use physical spaces?_

Sentiment data directly measures whether the game is creating lasting behavioural change or merely temporary compliance.

### 13.3 Leave Tracking

Game sessions also track when and why players leave a location:

| Leave Reason | Description |
|-------------|-------------|
| `navigated_away` | Player explicitly left the screen |
| `new_scan` | Player scanned a different QR code |
| `app_backgrounded` | App went to background |
| `fallback_next_session` | Inferred from next session start |
| `fallback_end_of_day` | Inferred at day end |

Combined with `dwellTime`, this gives researchers **actual time spent** at each location, not just self-reported duration.

---

## 14. Player Progression

### 14.1 Stats Tracked

| Stat | Description |
|------|-------------|
| `todayXp` | XP earned today (resets daily) |
| `seasonXp` | Cumulative XP across the season |
| `totalWins` | Lifetime minigame wins |
| `currentStreak` | Consecutive days with at least one win |
| `bestStreak` | Longest streak this season |
| `lastActiveDate` | Last date the player earned XP |

### 14.2 Streaks

- A player's **current streak** increments at daily scoring (6 PM) if they earned XP that day.
- If they missed the day (no XP), the streak resets to 0.
- **Best streak** is updated whenever current streak exceeds it.
- Streak data is visible on the player profile and contributes to season awards.

### 14.3 Player Clustering

Players are dynamically clustered based on their behaviour using a **feature vector**:

| Feature | Description |
|---------|-------------|
| `visits` | Total location visits |
| `avg_duration` | Average session duration |
| `avg_satisfaction` | Average reported satisfaction |
| `unique_spaces` | Number of distinct locations visited |
| `space_diversity` | Entropy of location distribution |
| `pct_morning` | % of visits in morning hours |
| `pct_he_social` | % high-effort social activities |
| `pct_he_personal` | % high-effort personal activities |
| `pct_le_social` | % low-effort social activities |
| `pct_le_personal` | % low-effort personal activities |
| `pct_social_hub` | % visits to Social Hubs |
| `pct_transit` | % visits to Transit/Forced locations |
| `pct_hidden_gem` | % visits to Hidden Gems |
| `pct_dead_zone` | % visits to Dead Zones |

Clustering runs periodically, updating each player's `computedCluster` which feeds back into the assignment algorithm — creating a **feedback loop** where the game adapts to player behaviour.

---

## 15. Journal System

### 15.1 Daily Quest Journal

The journal gives players a daily view of their assigned locations and progress:

```typescript
{
  date: string,
  totalXp: number,
  locations: [{
    locationId: string,
    locationName: string,
    status: 'won' | 'lost' | 'locked' | 'pending',
    minigameId?: string,      // which game they played
    coopPartnerId?: string,   // if co-op
    xpEarned?: number
  }]
}
```

### 15.2 Status Flow

```
pending  ──(win)──→  won (✓ green)
    │
    └──(lose)──→  locked (🔒 until 8am tomorrow)
```

Players can see at a glance which locations they've completed, which they've been locked out of, and which are still available.

---

## 16. Notifications & Real-Time Events

### 16.1 Push Notifications (FCM)

| Event | Message |
|-------|---------|
| Day start | "New day, new quest!" |
| Capture result | "[Clan] captured [Space]!" |
| Asset expiry warning | "You have N items expiring at midnight!" |
| Co-op partner win | "[Partner] won! You earned XP too." |
| Admin broadcast | Custom message to all or specific clan |

Notifications are sent via **raw HTTPS to FCM** (no Firebase Admin SDK), batched in groups of 500.

### 16.2 WebSocket Events

Real-time updates via API Gateway WebSocket:

| Event | Payload | Trigger |
|-------|---------|---------|
| `SCORE_UPDATE` | Clan XP changes | Any minigame win |
| `CAPTURE` | Winner clan, space | Daily scoring |
| `DAILY_RESET` | New day signal | Morning reset |
| `SCORING_COMPLETE` | Final scores | After capture |

### 16.3 Admin Notifications

Admins can send targeted notifications:
- **Target**: All players, or a specific clan
- **Type**: Event, Alert, Hype, Info
- **Character limit**: 140 characters
- Delivery count tracked and auditable

---

## 17. Tutorial & Onboarding

### 17.1 Tutorial Flow

The tutorial is a **10-scene lore sequence** that introduces players to the game world:

1. Scene 1–7: Story and world-building
2. Scene 8: **Character creation** — avatar customisation
3. Scene 9–10: Gameplay mechanics explanation

### 17.2 First-Time Flow

```
Google Sign-In
  → Clan Selection
    → Tutorial (10 scenes + character creation)
      → Main Map (game begins)
```

The `tutorialDone` flag on the user record gates access to the main game. Players who haven't completed the tutorial are redirected.

---

## 18. Admin Dashboard

### 18.1 Implemented Pages

| Page | Function |
|------|----------|
| **Dashboard** | Overview with today's stats |
| **Locations** | Full CRUD for 68+ locations with map placement, classification, modifiers, GPS coords, CSV export/import |
| **Roster** | CSV import of player emails + clan assignments |
| **Map Calibration** | Upload campus map, set GPS↔pixel calibration points, compute affine transform |
| **QR Generator** | Generate daily or permanent QR codes for locations |
| **Daily Config** | Set active locations, target space, quiet mode |
| **Notifications** | Send push notifications to all/clan |
| **Analytics** | Location performance, free-roam patterns, cluster analysis |
| **Season** | Reset season, clear territories, new season number |

### 18.2 Location Management Detail

The admin can manage each location's:
- GPS coordinates and geofence radius
- Map pixel position (via interactive map placement)
- Classification (Social Hub, Hidden Gem, etc.)
- SDT Deficit score (Self-Determination Theory metric from Phase 1)
- Priority tier for assignment algorithm
- Mechanic modifiers (co-op only, bonus XP, chest modifier, first-visit bonus)
- Space facts shown to players
- Minigame affinity preferences
- Linked locations (adjacency)

---

## 19. Season System

### 19.1 Season Structure

A season is a defined competitive period. At season end:
- All player stats (seasonXp, todayXp, streaks) are reset
- All clan stats (seasonXp, todayXp, spacesCaptured) are reset
- Captured territories can optionally be cleared
- Season number increments

### 19.2 Season Summary

At season end, the following summary is generated:

```typescript
{
  winnerClan: ClanId,
  clans: ClanScore[],               // final standings
  topPlayersByXp: PlayerSummary[],   // leaderboard
  topPlayersByStreak: PlayerSummary[], // longest streaks
  mostDecoratedSpaces: SpaceSummary[], // richest territories
  playerStats: {
    totalPlayers: number,
    activePlayers: number,
    totalGamesPlayed: number,
    averageXpPerPlayer: number
  }
}
```

---

## 20. Analytics & Data Outputs

This section covers **every category of data** the game system can produce.

### 20.1 Location Analytics (`analyticsLocations`)

Per-location performance metrics:

| Metric | Description |
|--------|-------------|
| Location status | Thriving / Activated / Below Baseline / Unactivated / New |
| Game session count | Total minigame sessions at this location |
| Free-roam checkin count | Non-game visits |
| Average satisfaction | Mean satisfaction score (0–1) |
| Sentiment breakdown | % yes / maybe / no for "would return?" |
| Phase 1 vs Phase 2 comparison | Improvement or regression from baseline |

**Status classification:**
- **Thriving**: More visits than Phase 1 baseline + high satisfaction
- **Activated**: Seeing use, above minimum threshold
- **Below Baseline**: Fewer visits than Phase 1
- **Unactivated**: Has been active but no visits yet
- **New**: No Phase 1 baseline data

### 20.2 Free-Roam Analytics (`analyticsFreeRoam`)

Aggregated check-in analysis:

| Output | Description |
|--------|-------------|
| Total check-ins | Count per date range |
| Sentiment totals | yes/maybe/no counts |
| Activity category breakdown | Distribution across 4 categories |
| Per-location sentiment | Sentiment by location name |
| Per-cluster sentiment | Sentiment by player cluster |
| Daily check-in trend | Check-ins per day over time |
| Duration distribution | Average and total time at locations |
| **Control signal** | Comparison of check-ins at assigned vs non-assigned locations |

The **control signal** is a key research output — it measures whether players visit locations they're assigned to more than unassigned ones, indicating the game's influence on movement.

### 20.3 Cluster Analytics (`analyticsClusters`)

Player behaviour segmentation:

| Output | Description |
|--------|-------------|
| Cluster overview | Per-cluster: roster size, DAU, participation %, avg streak, avg satisfaction |
| Cluster × space type matrix | Which clusters visit which location types |
| Cluster satisfaction over time | Daily satisfaction trends by cluster |
| Cluster engagement metrics | Games played, check-ins, XP earned by cluster |

### 20.4 Game Session Export (`exportGameSessions`)

Full CSV export with **21 columns**:

```
sessionId, userId, userCluster, locationId, locationName,
minigameId, minigameName, date, startedAt, completedAt,
result, xpEarned, chestDropped, chestAssetId,
coopPartnerId, practiceSession, spaceSentiment,
sentimentSubmittedAt, dwellTime, leftAt, leaveReason
```

Filterable by date range. This is the **raw dataset** for research analysis.

### 20.5 Capture History

Paginated history of territory captures:

```typescript
{
  spaceId, dateCaptured, spaceName, clan,
  mapOverlayId, clanXpSnapshot, totalDayXp
}
```

### 20.6 Clan Scores (Real-Time)

```typescript
{
  clanId, todayXp, seasonXp, spacesCaptured,
  todayParticipants, rosterSize
}
```

### 20.7 Player Profile Data

```typescript
{
  todayXp, seasonXp, totalWins,
  currentStreak, bestStreak,
  clan, clanTodayXp, clanSeasonXp,
  avatarConfig, displayName, playerCode,
  phase1Cluster, computedCluster
}
```

### 20.8 Assignment Audit Trail

Each `PlayerAssignment` stores `weightsUsed`, enabling researchers to:
- Verify the algorithm is distributing players as intended
- Compare player outcomes vs assignment fairness
- Detect if certain weight configs produce better engagement

### 20.9 DynamoDB Tables as Data Sources

| Table | Records | Research Value |
|-------|---------|----------------|
| `users` | Player profiles + clusters | Demographic segmentation |
| `game-sessions` | Every minigame attempt | Core behavioural data |
| `checkins` | Free-roam check-ins | Voluntary spatial behaviour |
| `player-assignments` | Daily assignments | Algorithm audit trail |
| `captured-spaces` | Territory history | Competition outcomes |
| `player-assets` | Asset inventory | Engagement/reward metrics |
| `space-decorations` | Placed decorations | Creative engagement |
| `player-locks` | Loss penalties | Difficulty/frustration signals |
| `daily-config` | Daily game setup | Experimental conditions |
| `clustering-runs` | Clustering history | Behavioural evolution over time |
| `location-master-config` | Full location metadata | Spatial characteristics |
| `cluster-weight-config` | Algorithm parameters | Intervention design |

---

## 21. Full Playthrough Walkthrough

Here is a complete day in the life of a GroveWars player:

### Morning (8:00 AM)

1. **Daily reset fires.** Your todayXp resets to 0. You receive a push notification.
2. **Open the app.** The main map loads showing the campus with coloured territories (clan captures from previous days).
3. **Check the journal.** You see 4 assigned locations for today: "Central Courtyard", "Library Garden", "East Corridor", and "Rooftop Terrace" (co-op). One has a first-visit bonus badge.
4. **Check the scoreboard.** All clans are at 0 XP. The target space for today is "West Pavilion".

### Mid-Morning (10:30 AM)

5. **Walk to Central Courtyard.** You're physically at the location.
6. **Open QR scanner.** Point camera at the QR code posted on the wall.
7. **QR validates** — your GPS confirms you're within 15m, location is in your assignment, no locks.
8. **Minigame selection.** You see 3 options: "Wordle (120s)", "Color Sort (90s)", "Tile Fit (120s)". You pick Wordle.
9. **Start minigame.** Server creates a session, generates a salt, returns puzzle data.
10. **Play Wordle.** You guess the word in 4 tries, taking 45 seconds.
11. **Submit result.** Client sends completion hash. Server validates timing, hash, and solution.
12. **WIN!** You earn 25 XP. Your clan (Ember) gains 25 XP. A chest drops!
13. **Chest animation.** The chest opens to reveal an **Uncommon Mural** — "Vine Archway".
14. **Sentiment prompt.** "Would you return to Central Courtyard without the game?" You tap "Maybe".
15. **Back to map.** Your journal shows Central Courtyard ✓. Scoreboard updates: Ember 25, others various.

### Lunch (12:15 PM)

16. **Walk to Library Garden.** Scan QR.
17. **Pick "Spot the Pattern"** (60s). Complete all 3 rounds successfully.
18. **WIN!** 25 more XP (50 total). Chest drops: **Common Statue** — "Stone Mushroom".
19. **Sentiment: "Yes"** — you actually like this garden.

### Afternoon (2:00 PM)

20. **East Corridor.** Scan QR. Pick "Connect the Dots" (90s).
21. **LOSE.** You ran out of time. **Location locked** until 8 AM tomorrow. 🔒
22. **Journal updated.** East Corridor shows locked icon.

### Co-op Session (3:30 PM)

23. **Head to Rooftop Terrace** (co-op location).
24. **Scan QR.** Server responds: "Partner required."
25. **Search for partner.** Type friend's player code "GRV-4821". Select them.
26. **Re-scan with partner.** Server validates both players.
27. **Pick "Word Groups Co-op"** (150s).
28. **Play together.** Split-screen interface, both contributing.
29. **WIN!** Both players earn 25 XP. Co-op chest drops with better odds — you get a **Rare Banner**! 🎉
30. **Your total: 75 XP.** One more win until cap.

### Late Afternoon (4:45 PM)

31. **Free-roam check-in.** You're studying at the cafe (not an assigned location). Tap the map to check in.
32. **Report:** Activity = "low_effort_personal", Satisfaction = 0.75, Sentiment = "yes", Duration = 45 min.

### Evening (6:00 PM)

33. **Daily scoring fires.**
34. **Results:** Ember: 425 XP, Tide: 410 XP, Bloom: 380 XP, Gale: 350 XP, Hearth: 290 XP.
35. **Ember captures West Pavilion!** 🏰 The map updates with Ember's colour.
36. **Push notification:** "Ember captured West Pavilion!"
37. **Your streak:** 5 days → 6 days.

### Night

38. **Decorate!** Open West Pavilion's space. Place your Vine Archway mural and Stone Mushroom on the territory grid. Other Ember members place their items too.
39. **Asset warning (11:30 PM):** "You have 1 item expiring at midnight!" — the Rare Banner you haven't placed.
40. **Place it** on another Ember territory just in time.

---

## 22. Technical Architecture

### 22.1 Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (Android, landscape-locked) |
| Backend | AWS Lambda (Node.js/TypeScript) via SAM |
| Database | DynamoDB (19 tables) |
| Auth | Google Sign-In → Firebase → Cognito CUSTOM_AUTH |
| Real-time | API Gateway WebSocket |
| Push | Firebase Cloud Messaging (raw HTTPS) |
| Storage | S3 (map images, asset sprites) |
| Admin | React + Vite + Tailwind + Zustand + TanStack Query |
| GPS↔Map | Least-squares affine transform (6-parameter) |

### 22.2 API Surface

**REST Endpoints (authenticated via JWT):**

| Method | Path | Function |
|--------|------|----------|
| POST | /auth/google-login | Google auth flow |
| GET | /player/profile | Get player profile |
| PUT | /player/avatar | Update avatar & display name |
| PUT | /player/fcm-token | Register push token |
| GET | /player/assets | Get owned assets |
| GET | /player/stats | Get XP/streak stats |
| GET | /player/journal | Get daily quest journal |
| PUT | /player/clan | Set clan (once) |
| POST | /game/scan-qr | QR scan + validation |
| POST | /game/start-minigame | Start a game session |
| POST | /game/complete-minigame | Submit game result |
| POST | /game/submit-sentiment | Post-game space sentiment |
| GET | /game/cooldown | Check cooldown status |
| POST | /game/checkin | Legacy check-in |
| POST | /checkin/submit | Free-roam check-in |
| GET | /scores/clans | Clan scoreboard |
| GET | /scores/capture-history | Territory capture history |
| GET | /spaces/captured | Captured spaces list |
| GET | /spaces/decoration/{id} | Get space decoration |
| PUT | /spaces/decoration/{id} | Save space decoration |
| GET | /map/config | Map image + calibration |
| GET | /locations/today | Today's active locations |
| GET | /daily-info | Today's config + target space |
| POST | /admin/* | Various admin endpoints |

**WebSocket:**
- `wss://` connection with JWT validation
- Server-push events for score updates and captures

### 22.3 DynamoDB Design (19 Tables)

| Table | PK | SK/GSI | Purpose |
|-------|----|----|---------|
| users | userId | GSI: ClanIndex, EmailIndex | Player profiles |
| clans | clanId | — | Clan scores |
| locations | locationId | — | Physical locations |
| daily-config | date | — | Daily game setup |
| player-assignments | dateUserId | — | Per-player daily assignments |
| game-sessions | sessionId | GSI: UserDateIndex | Minigame records |
| player-locks | dateUserLocation | — | Loss lockouts (TTL) |
| captured-spaces | spaceId | GSI: SeasonIndex | Territory history |
| asset-catalog | assetId | — | Available assets |
| player-assets | userAssetId | GSI: UserAssetsIndex | Owned assets |
| space-decorations | userSpaceId | — | Placed decorations |
| map-calibration | calibrationId | — | GPS↔pixel transform |
| admin-notifications | notificationId | — | Notification log |
| ws-connections | connectionId | — | Active WebSockets (TTL) |
| checkins | checkInId | — | Free-roam check-ins |
| admin-audit | — | — | Admin action log |
| location-master-config | locationId | — | Full location metadata |
| cluster-weight-config | configId | — | Assignment algorithm config |
| clustering-runs | date | — | Clustering history |

---

## 23. Security Model

| Threat | Mitigation |
|--------|-----------|
| Fake QR scans | HMAC verification (timing-safe) |
| Remote play | GPS geofence validation |
| Instant wins | Server-side timing (5s minimum) |
| Result tampering | Completion hash + server solution check |
| XP inflation | Daily cap enforced server-side + atomic DB updates |
| Session replay | One-time session IDs + completion flag |
| Unauthorized access | JWT auth on all endpoints + admin group check |
| Token theft | Short-lived JWTs + auto-refresh on 401 |

---

## 24. Appendices

### A. Error Codes

| Code | Meaning |
|------|---------|
| `QR_INVALID` | QR payload failed HMAC verification |
| `QR_EXPIRED` | QR date doesn't match today |
| `LOCATION_NOT_FOUND` | Location UUID not in database |
| `LOCATION_INACTIVE` | Location not active today |
| `GPS_OUT_OF_RANGE` | Player too far from location |
| `NOT_ASSIGNED` | Location not in player's daily assignment |
| `LOCATION_LOCKED` | Player locked out after loss |
| `DAILY_CAP_REACHED` | 100 XP cap hit |
| `MINIGAME_ALREADY_WON` | Already won this minigame at this location today |
| `SESSION_NOT_FOUND` | Invalid session ID |
| `SESSION_ALREADY_COMPLETE` | Double-submit prevention |
| `INVALID_HASH` | Completion hash verification failed |
| `TIME_VIOLATION` | Suspicious timing (too fast or too slow) |
| `PARTNER_REQUIRED` | Co-op location needs a partner |
| `PARTNER_NOT_FOUND` | Partner player code invalid |
| `PARTNER_CAPPED` | Partner at daily XP limit |
| `PARTNER_LOCKED` | Partner locked at this location |
| `PARTNER_ALREADY_WON` | Partner already won here today |
| `OUTSIDE_GAME_HOURS` | Not between 8 AM and 6 PM IST |
| `RATE_LIMITED` | Check-in rate limit (30s) |
| `DURATION_CAP` | Daily check-in duration exceeded |
| `SENTIMENT_ALREADY_SET` | Can't change sentiment answer |
| `NOT_AUTHORIZED` | Missing or invalid JWT |
| `ADMIN_REQUIRED` | Endpoint requires admin role |

### B. Minigame Time Limits

| Game | Solo | Co-op |
|------|------|-------|
| Stone Pairs | 60s | 60s |
| Color Sort | 90s | — |
| Spot the Pattern | 60s | — |
| Connect the Dots | 90s | — |
| Mini Sudoku | 90s | — |
| Wordle | 120s | — |
| Word Groups | 150s | 150s |
| Cipher | 150s | 150s |
| Snuff Out | 75s | 75s |
| Tile Fit | 120s | — |
| Logic Grid | 150s | 150s |
| Nonogram | 180s | — |
| Number Crunch | 90s | — |
| Tile Slide | 120s | — |
| Word Hunt | 180s | 180s |

### C. Co-op Chest Weight Comparison

```
Solo:      ████████████ Common 60%  ████▌ Uncommon 25%  ██▎ Rare 12%  ▌ Legendary 3%
Co-op:     ██▊ Common 15%  ███▊ Uncommon 20%  ████████ Rare 40%  █████ Legendary 25%
```

Co-op play is **dramatically more rewarding** for asset rarity, incentivising social play.

### D. Daily Timing Summary (IST)

| Time | Event | Cron (UTC) |
|------|-------|-----------|
| 08:00 | Daily reset + assignments | 02:30 UTC |
| 08:00–18:00 | Game hours | — |
| 18:00 | Daily scoring + capture | 12:30 UTC |
| ~23:30 | Asset expiry warning | — |
| 00:00 (midnight) | Asset expiry | 18:30 UTC |
