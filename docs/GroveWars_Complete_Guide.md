# GroveWars — Complete Game Reference Guide

**Version:** 1.0 — March 2026
**Last Updated:** 2026-03-19

---

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [The Five Clans](#2-the-five-clans)
3. [Complete Daily Game Loop](#3-complete-daily-game-loop)
4. [All 15 Minigames](#4-all-15-minigames)
5. [XP, Scoring, and Territory System](#5-xp-scoring-and-territory-system)
6. [Economy and Collectibles](#6-economy-and-collectibles)
7. [Tech Stack and Architecture](#7-tech-stack-and-architecture)
8. [All DynamoDB Tables](#8-all-dynamodb-tables)
9. [All API Endpoints](#9-all-api-endpoints)
10. [Admin Dashboard](#10-admin-dashboard)
11. [Scheduled Jobs](#11-scheduled-jobs)
12. [Anti-Cheat Measures](#12-anti-cheat-measures)
13. [Key Implementation Patterns and Gotchas](#13-key-implementation-patterns-and-gotchas)
14. [Current Project Status](#14-current-project-status)
15. [File Structure](#15-file-structure)
16. [Debug and Development](#16-debug-and-development)

---

## 1. Game Overview

### What Is GroveWars?

GroveWars is a clan-based territory capture game designed for TCE (Thiagarajar College of Engineering) students and faculty. Five house clans compete daily to capture campus spaces by completing puzzle minigames at physical locations. Players walk to real-world locations on campus, scan QR codes, solve timed puzzles, and earn XP for their clan. At 6 PM each day, the clan with the highest XP captures that day's target space — permanently marked on a beautiful pixel-art campus map.

### Elevator Pitch

> Walk campus. Scan QR. Solve puzzles. Win territory. Your clan vs four others, every single day.

### Target Audience

- **421 total players:** 390 engineering students + 31 faculty members at TCE
- Players are split into 5 house clans via a CSV roster imported before each season
- Non-roster emails are rejected at sign-in with `NOT_IN_ROSTER`

### Aesthetic

Cottagecore / Stardew Valley pixel-art style:
- Earthy, nature-inspired color palette
- Parchment backgrounds, warm browns, soft greens
- Fonts: **Caveat Bold** for headers, **Nunito** for body text
- The campus map is a hand-drawn 2000x1125px pixel-art illustration

### Platform

- **Android only** (React Native)
- **Portrait-locked** (all screens and minigames)
- **Season structure:** 2-week seasons, then reset and start fresh

---

## 2. The Five Clans

| Clan | Color | Hex Code | Element | Personality | Icon |
|------|-------|----------|---------|-------------|------|
| **Ember** | Red | `#C0392B` | Fire / Warmth | Bold, determined, passionate | Lantern |
| **Tide** | Blue | `#2980B9` | Water / Calm | Strategic, wise, patient | Wave |
| **Bloom** | Yellow | `#F1C40F` | Sun / Growth | Creative, cheerful, nurturing | Sunflower |
| **Gale** | Green | `#27AE60` | Wind / Forest | Adventurous, free-spirited, resilient | Leaf |
| **Hearth** | Purple | `#7D3C98` | Earth / Home | Warm, grounded, community-focused | Hearth |

### Clan Assignment

- Players are assigned to clans via a **CSV roster** imported by admins before each season
- CSV format: `email,house` where house is one of: `ember`, `tide`, `bloom`, `gale`, `hearth`
- On first Google Sign-In, the backend checks the roster table for the player's email
- If found: player is auto-assigned to their rostered clan
- If not found: sign-in is rejected with error code `NOT_IN_ROSTER`
- Clan assignment is permanent for the season

### Equal Treatment

All 5 clans have **identical mechanics**. Hearth (the 5th clan, added later) has no special treatment — it participates in daily scoring, territory capture, roster import, clan selectors, XP tracking, and push notifications exactly like the other 4.

---

## 3. Complete Daily Game Loop

### Timeline

| Time (IST) | Event | What Happens |
|-------------|-------|--------------|
| **8:00 AM** | Daily Reset | XP zeroed, locks cleared, new location assignments, streak updates |
| 8:00 AM – 6:00 PM | Active Play Window | Players visit locations, scan QR, play minigames |
| **10:40 AM** | Morning Break Notification | Push notification reminding players to play |
| **12:40 PM** | Lunch Break Notification | Push notification for lunch break engagement |
| **5:00 PM** | Final Push Notification | Last chance push notification |
| **6:00 PM** | Daily Scoring | Highest clan XP captures the day's target space |
| **9:00 PM** | Asset Expiry Warning | Push notification for assets about to expire |
| **Midnight** | Asset Expiry | Unplaced assets expire |

### Step-by-Step Player Flow

1. **Open the app** — See the pixel-art campus map with 3-5 location pins (your personal assignments for the day)
2. **Walk to a location** — Physical campus location with a QR code poster
3. **Scan the QR code** — Camera opens, scan the rotating HMAC-signed QR code
4. **GPS verification** — Server checks you're within 15-20m geofence radius of the location
5. **Choose a minigame** — Select from 3-5 randomly offered minigames (2 Easy + 2-3 Medium + 1 Hard)
6. **Play the minigame** — Solve the timed puzzle before time runs out
7. **Win or Lose:**
   - **Win (first at this location today):** +25 XP for your clan, guaranteed chest drop
   - **Win (already won at this location today):** 0 XP (practice mode), but still playable
   - **Lose:** Location is **locked** for you until tomorrow's reset
8. **Repeat** — Visit other assigned locations to earn more XP (up to 100 daily from 4 locations)
9. **6 PM** — Scoring happens automatically. The winning clan's banner appears on the map

### Key Rules

- **Daily XP cap:** 100 per player (requires winning at 4 distinct locations)
- **Per-location XP:** First win = 25 XP, subsequent wins = 0 XP (practice mode)
- **Lock on loss:** If you lose at a location, that location is locked for you until next day
- **No cooldown system** — You can play as soon as you reach a new location
- **Co-op mode:** Some locations may be co-op-only, requiring a partner (cross-clan co-op is allowed)

---

## 4. All 15 Minigames

### Overview Table

| # | Name | Difficulty | Time | Co-op? | Inspiration |
|---|------|-----------|------|--------|-------------|
| 1 | Stone Pairs | Easy | 60s | Yes | Memory card matching |
| 2 | Leaf Sort | Easy | 90s | No | Ball sort puzzle |
| 3 | Bloom Sequence | Easy | 90s | No | Pattern recognition |
| 4 | Firefly Flow | Easy | 90s | No | Flow Free / pipe connect |
| 5 | Number Grove | Easy | 120s | No | Sudoku-lite |
| 6 | Grove Words | Medium | 120s | No | Wordle |
| 7 | Kindred | Medium | 150s | Yes | NYT Connections |
| 8 | Cipher Stones | Medium | 120s | Yes | Cryptogram |
| 9 | Pips | Medium | 60s | Yes | Lights Out |
| 10 | Mosaic | Medium | 90s | No | Tile placement |
| 11 | Potion Logic | Hard | 120s | Yes | Logic grid puzzle |
| 12 | Path Weaver | Hard | 150s | No | Nonogram / Picross |
| 13 | Grove Equations | Hard | 120s | No | Numbers game (Countdown) |
| 14 | Shift & Slide | Hard | 90s | No | 15-puzzle / sliding tiles |
| 15 | Vine Trail | Hard | 180s | Yes | Word search |

---

### Detailed Minigame Descriptions

#### 1. Stone Pairs (Easy, 60s)
**How to play:** A 4x4 grid of face-down cards is shown. Tap two cards to flip them over. If they match, they stay face-up. Find all matching pairs before time runs out.
**Win condition:** All pairs found within 60 seconds.
**Lose condition:** Timer expires with unmatched pairs remaining.
**Co-op:** Yes — in co-op mode, two players share the same board via split-screen.
**Implementation:** Client-side puzzle generation with randomized icon placement. Tracks revealed/matched card sets.

#### 2. Leaf Sort (Easy, 90s)
**How to play:** Colored beads are mixed across jars (3 jars top row, 2 bottom row, capacity 4 each). Move beads one at a time between jars to sort them by color — each jar should end with only one color.
**Win condition:** All jars contain beads of a single color.
**Lose condition:** Timer expires or no valid moves remain.
**Implementation:** Runtime-generated puzzles with pre-defined color sets. Validated by checking jar homogeneity.

#### 3. Bloom Sequence (Easy, 90s)
**How to play:** You're shown a sequence of 5 items following a pattern (numbers, colors, or shapes). Pick the correct 6th item from 4 options. Complete 3 rounds to win.
**Win condition:** All 3 rounds answered correctly.
**Lose condition:** Any wrong answer or timer expires.
**Implementation:** Runtime pattern generation with multiple pattern types (arithmetic, geometric, color cycles).

#### 4. Firefly Flow (Easy, 90s)
**How to play:** A grid shows pairs of colored dots. Draw paths to connect each pair. Paths cannot cross, and every cell on the grid must be filled.
**Win condition:** All pairs connected with every cell covered.
**Lose condition:** Timer expires.
**Implementation:** Runtime puzzle generation. Uses Skia canvas for path drawing and touch input.

#### 5. Number Grove (Easy, 120s)
**How to play:** A 6x6 grid partially filled with numbers (1-6). Fill in the remaining cells so each row and column contains each number exactly once — similar to Sudoku but simpler.
**Win condition:** Grid correctly completed.
**Lose condition:** Timer expires.
**Implementation:** Runtime generation using constraint-based logic. Conflict detection highlights invalid placements. Uses pre-authored base grids from `baseGrids.ts`.

#### 6. Grove Words (Medium, 120s)
**How to play:** Guess a 5-letter word in 6 tries. After each guess, letters turn green (correct position), yellow (wrong position, right letter), or gray (not in word). Classic Wordle rules.
**Win condition:** Guess the word within 6 attempts.
**Lose condition:** All 6 guesses used without finding the word, or timer expires.
**Implementation:** Client-side word selection from curated word list. 5000+ valid guesses in `validGuesses.ts`. Custom on-screen keyboard with letter state feedback.

#### 7. Kindred (Medium, 150s)
**How to play:** 16 words are displayed. Group them into 4 sets of 4 related words. You get 4 mistakes before losing. Hints available (3 max, with 60-second cooldown between hints).
**Win condition:** All 4 groups correctly identified with fewer than 4 mistakes.
**Lose condition:** 4 mistakes made, or timer expires.
**Co-op:** Yes — partners see the same board and collaborate.
**Implementation:** **24 pre-authored group packs** in `groupPacks.ts`. Random pack selection per session.

#### 8. Cipher Stones (Medium, 120s)
**How to play:** A famous quote is encrypted with a substitution cipher. Tap a cipher letter, then tap the real letter you think it represents. Decode the entire quote to win. Hints available (3 max, 30s initial delay, 60s cooldown).
**Win condition:** Entire quote correctly decoded.
**Lose condition:** Timer expires.
**Co-op:** Yes — shared decryption board.
**Implementation:** Quotes from `quotedatabase.ts`. Random substitution cipher generated per session. Custom keyboard with letter mapping display.

#### 9. Pips (Medium, 60s)
**How to play:** A 5x5 grid of cells, some lit and some dark. Tapping a cell toggles it and its orthogonal neighbors (Lights Out puzzle). Turn all cells to the target state.
**Win condition:** All cells match the target pattern.
**Lose condition:** Timer expires.
**Co-op:** Yes — shared grid.
**Implementation:** Runtime puzzle generation ensuring solvability. Touch animation with state propagation.

#### 10. Mosaic (Medium, 90s)
**How to play:** Place shaped tiles (squares, bars, L-shapes, T-shapes) onto a grid to fill a target pattern. Tiles can be rotated. All target cells must be covered with no overlaps.
**Win condition:** All target cells covered correctly.
**Lose condition:** Timer expires.
**Implementation:** Runtime puzzle generation. Skia canvas rendering with ghost placement preview. Tile rotation via tap.

#### 11. Potion Logic (Hard, 120s)
**How to play:** A logic grid puzzle. Use clues to deduce which ingredient and effect belongs to each of several potions. Process of elimination — fill the grid based on given constraints.
**Win condition:** Grid correctly completed.
**Lose condition:** Timer expires or too many wrong deductions.
**Co-op:** Yes — shared logic grid.
**Implementation:** Runtime generation with constraint propagation. Grid-fill cascading for auto-deduction.

#### 12. Path Weaver (Hard, 150s)
**How to play:** A nonogram/Picross-style puzzle. Row and column clues tell you how many consecutive cells to fill. Complete the grid to reveal a hidden pixel-art image.
**Win condition:** Grid matches the solution.
**Lose condition:** Timer expires.
**Implementation:** **Pre-authored image grids** from `image_grids.ts`. Skia canvas rendering with row/column clue display.

#### 13. Grove Equations (Hard, 120s)
**How to play:** Given 4 numbers and a target, use arithmetic operators (+, -, x, /) to build an equation that equals the target. Cycle through operators by tapping between numbers.
**Win condition:** Valid equation that equals the target.
**Lose condition:** Timer expires.
**Implementation:** Runtime generation ensuring solvability. Operator cycling UI with real-time equation evaluation.

#### 14. Shift & Slide (Hard, 90s)
**How to play:** A scrambled image split into tiles in a grid with one empty space. Slide tiles into the empty space to reconstruct the original image (classic 15-puzzle).
**Win condition:** Image correctly reconstructed.
**Lose condition:** Timer expires.
**Implementation:** **10 pre-authored cottagecore pixel-art images** from `imageList.ts` (fox, mushrooms, flowers, cottage, owl, butterfly, hedgehog, watering can, robin, sunflower). Board scrambled with guaranteed solvability.

#### 15. Vine Trail (Hard, 180s)
**How to play:** An 8x6 letter grid containing hidden words. Find and trace all the hidden words by connecting adjacent letters. Words can go in any direction including diagonals.
**Win condition:** All hidden words found.
**Lose condition:** Timer expires.
**Co-op:** Yes — shared grid.
**Implementation:** **Pre-authored packs** in `vineTrailPacks.ts`. Grid layout with word coordinate definitions. 180s time limit (longest of all minigames).

---

### Minigame Selection Algorithm

When a player scans a QR code at a location, they're offered a selection of minigames:
- **2 Easy** + **3 Medium** + **1 Hard** = 6 total options
- Selected via Fisher-Yates shuffle within each difficulty bucket
- If a difficulty bucket has fewer games than needed, Medium bucket fills the gap
- Games already won at this location today are marked as "completed" but still playable (practice mode)
- At co-op-only locations, only co-op variants are shown

### Shared UI Pattern

All minigames use the same completion flow:
1. Game ends (win/lose/timeout) → Game state freezes
2. `GameCompleteOverlay` appears (shared component from `components/minigames/`)
3. Shows result (win/lose), XP earned, optional word reveal
4. Player taps "Continue" → navigates to `ResultScreen`
5. `ResultScreen` shows detailed results, chest drops, and navigation options

---

## 5. XP, Scoring, and Territory System

### XP Rules

| Rule | Value |
|------|-------|
| XP per win (first at location) | 25 XP |
| XP per win (already won at location) | 0 XP (practice mode) |
| Daily XP cap per player | 100 XP (= 4 distinct location wins) |
| XP modifiers/bonuses | None — flat 25 XP always |

### Clan Scoring

- XP earned by a player is immediately added to their clan's `todayXp` counter
- **Atomic updates:** Uses DynamoDB `ADD todayXp :xp` expression — never read-modify-write
- When a clan's first player earns XP for the day, `todayXpTimestamp` is recorded
- `todayParticipants` counts unique players who contributed XP today
- All clan scores are broadcast in real-time via WebSocket

### Territory Capture (6 PM Daily)

1. At 6:00 PM IST, the `dailyScoring` Lambda fires
2. All 5 clans' `todayXp` values are compared
3. **Tiebreaker:** If two or more clans have the same `todayXp`, the clan with the **earliest** `todayXpTimestamp` wins (first to reach that score)
4. The winning clan captures the day's **target space** on the campus map
5. A `captured-spaces` record is created in DynamoDB
6. Push notification sent to all players announcing the winner
7. WebSocket broadcasts `CAPTURE` and `SCORING_COMPLETE` messages
8. The captured space is permanently colored on the map in the winning clan's color

### Streak System

Streaks are purely cosmetic — they give **zero gameplay advantages**.

| Streak Level | Days Required | Badge |
|-------------|---------------|-------|
| Seedling | 3 consecutive game days | Seedling badge |
| Sapling | 7 consecutive game days | Sapling badge |
| Ancient Oak | 14 consecutive game days | Ancient Oak badge |

**Rules:**
- Streak increments on any game day where the player earns at least 1 XP
- Streak resets to 0 on a game day where the player earns 0 XP
- Non-game days (weekends, holidays) **do not** affect streaks
- `currentStreak` and `bestStreak` tracked per player

---

## 6. Economy and Collectibles

### Chest Drops

- **Drop rate:** 100% on every XP-earning win (first win at each location per day)
- **Rarity weights (solo):** Common 60%, Uncommon 25%, Rare 12%, Legendary 3%
- **Rarity weights (co-op):** Common 15%, Uncommon 20%, Rare 40%, Legendary 25% (much better odds!)
- Chest contents are randomly selected from the `asset-catalog` DynamoDB table
- Each asset has a `dropWeight` that influences selection within its rarity tier

### Asset Categories

| Category | Rarity Range | Description |
|----------|-------------|-------------|
| Banners | Common | Clan flags and decorative banners |
| Furniture | Common | Tables, chairs, garden items |
| Statues | Uncommon | Stone and wood sculptures |
| Murals | Rare | Wall paintings and art pieces |
| Pets | Rare | Animated companion creatures |
| Special | Legendary | Unique seasonal or event items |

### Asset Expiry

- **Unplaced assets** expire at **midnight IST** on the day they were obtained
- **Placed assets** are permanent and never expire
- Players receive a push notification warning at 9 PM IST about expiring assets
- The backend `assetExpiry` Lambda runs at midnight IST to mark expired assets

### Space Decoration

- When a clan captures a space, players from that clan can **decorate** it
- Decoration is personal — each player has their own layout per space
- Drag-and-drop asset placement on the space's area
- Placed assets are stored in the `space-decorations` table (`userSpaceId = userId#spaceId`)

---

## 7. Tech Stack and Architecture

### Mobile App
| Component | Technology |
|-----------|-----------|
| Framework | React Native 0.76+ |
| Language | TypeScript 5.x (strict mode) |
| Canvas/Graphics | react-native-skia (map rendering, minigame graphics) |
| State Management | Zustand (4 stores: auth, game, map, clan) |
| Navigation | @react-navigation/native v6 (stack + tab) |
| Orientation | react-native-orientation-locker (portrait-locked) |
| QR Scanning | react-native-vision-camera + ML Kit |
| GPS | react-native-geolocation-service |
| Push Notifications | @react-native-firebase/messaging (FCM) |

### Backend
| Component | Technology |
|-----------|-----------|
| Infrastructure | AWS SAM (CloudFormation) |
| Runtime | Node.js 20 Lambda (TypeScript compiled to JS) |
| API | API Gateway (REST + WebSocket) |
| Database | DynamoDB (19 tables, PAY_PER_REQUEST) |
| Storage | S3 (map images, assets) |
| Auth | Firebase Auth with Google Sign-In |
| Push | Firebase Cloud Messaging (FCM) |
| Region | ap-south-1 (Mumbai — closest to India) |
| Secrets | SSM Parameter Store (Firebase service account) |

### Admin Dashboard
| Component | Technology |
|-----------|-----------|
| Framework | React 18 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 |
| Language | TypeScript 5.9 (strict mode) |
| Data Fetching | TanStack React Query (30s stale, 1 retry) |
| Auth State | Zustand (JWT in memory) |
| Charts | Recharts |
| Testing | Vitest + React Testing Library |

### Authentication Flow

1. Player taps "Sign in with Google" in mobile app
2. `@react-native-google-signin` handles Google OAuth
3. Google ID token sent to `POST /auth/google-login`
4. Backend verifies Google token with Firebase Admin SDK
5. Backend checks roster table for email
6. If found: creates/updates user record, returns Firebase custom token
7. Mobile app uses token for all subsequent API requests
8. Lambda authorizer validates Firebase JWT on every request

**Firebase Project:** `grovewars-b37da`
**FCM Sender ID:** `425457815141`

### Real-Time Updates

- Primary: API Gateway WebSocket (`wss://vegaw2zi58.execute-api.ap-south-1.amazonaws.com/dev`)
- Fallback: HTTP polling every 30 seconds
- WebSocket connection requires JWT auth on `$connect`
- Connection stored in `ws-connections` table with TTL

---

## 8. All DynamoDB Tables

The backend uses **19 DynamoDB tables**, all with PAY_PER_REQUEST billing.

### Table Reference

| # | Table | Primary Key | GSIs | TTL | Purpose |
|---|-------|------------|------|-----|---------|
| 1 | users | `userId` (HASH) | ClanIndex (`clan` + `todayXp`), EmailIndex (`email`) | No | Player profiles and stats |
| 2 | clans | `clanId` (HASH) | — | No | Clan XP totals and metadata |
| 3 | locations | `locationId` (HASH) | — | No | Campus location definitions |
| 4 | daily-config | `date` (HASH) `YYYY-MM-DD` | — | No | Daily game configuration |
| 5 | player-assignments | `dateUserId` (HASH) `YYYY-MM-DD#userId` | — | No | Per-player daily location assignments |
| 6 | game-sessions | `sessionId` (HASH) | UserDateIndex (`userId` + `date`) | No | Individual minigame play records |
| 7 | player-locks | `dateUserLocation` (HASH) `YYYY-MM-DD#userId#locationId` | — | **Yes** (`ttl`) | Location locks from losses |
| 8 | captured-spaces | `spaceId` (HASH) | SeasonIndex (`season` + `dateCaptured`) | No | Territory capture history |
| 9 | asset-catalog | `assetId` (HASH) | — | No | All available collectible assets |
| 10 | player-assets | `userAssetId` (HASH) | UserAssetsIndex (`userId` + `obtainedAt`) | No | Player-owned assets |
| 11 | space-decorations | `userSpaceId` (HASH) `userId#spaceId` | — | No | Per-player space decoration layouts |
| 12 | map-calibration | `calibrationId` (HASH) | — | No | GPS-to-pixel affine transform data |
| 13 | admin-notifications | `notificationId` (HASH) | — | No | Push notification history |
| 14 | ws-connections | `connectionId` (HASH) | — | **Yes** (`ttl`) | Active WebSocket connections |
| 15 | roster | `email` (HASH) | — | No | Pre-imported player roster |
| 16 | checkins | `checkInId` (HASH) | UserDateIndex (`userId` + `date`), DateIndex (`date` + `timestamp`) | No | Free-roam check-in records |
| 17 | admin-audit | `auditId` (HASH) | — | No | Admin action audit log |
| 18 | location-master-config | `locationId` (HASH) | — | No | Canonical location metadata |
| 19 | cluster-weight-config | `configId` (HASH) | — | No | Cluster-based assignment weights |

### Key Patterns

- **Atomic updates:** Clan XP uses `ADD todayXp :xp` expression — never read-modify-write
- **Composite keys:** `player-assignments` uses `YYYY-MM-DD#userId`, `player-locks` uses `YYYY-MM-DD#userId#locationId`
- **TTL cleanup:** `player-locks` auto-expire at 8 AM IST next day; `ws-connections` auto-expire after 24h
- **All timestamps:** ISO 8601 UTC strings in DynamoDB

---

## 9. All API Endpoints

**REST Base URL:** `https://incbqo08d8.execute-api.ap-south-1.amazonaws.com/dev`
**WebSocket URL:** `wss://vegaw2zi58.execute-api.ap-south-1.amazonaws.com/dev`

### Authentication (Public — No Auth Required)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/auth/google-login` | googleLogin | Player sign-in via Google |
| POST | `/admin/auth/google-login` | adminGoogleLogin | Admin sign-in via Google |

### Player Profile

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/player/profile` | getProfile | Get player profile and clan info |
| PUT | `/player/avatar` | updateAvatar | Update avatar configuration |
| PUT | `/player/fcm-token` | updateFcmToken | Register FCM push token |
| PUT | `/player/clan` | updateClan | Update clan assignment |
| GET | `/player/assets` | getAssets | List player's collectible assets |
| GET | `/player/stats` | getStats | Get player game statistics |

### Map and Locations

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/map/config` | getMapConfig | Get map image URL and calibration matrix |
| GET | `/locations/today` | getTodayLocations | Get player's assigned locations for today |
| GET | `/daily/info` | getDailyInfo | Get daily config, target space, event windows |

### Game Flow

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/game/scan` | scanQR | Validate QR code (9-step chain) |
| POST | `/game/start` | startMinigame | Start a minigame session |
| POST | `/game/complete` | completeMinigame | Submit minigame result |
| POST | `/game/startPractice` | startPractice | Start practice mode (no XP) |
| POST | `/game/checkin` | checkin | Free-roam location check-in |
| POST | `/game/session/leave` | submitLeave | Record session departure |
| PATCH | `/game/session/{sessionId}/sentiment` | submitSentiment | Submit location sentiment |

### Scores and History

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/scores/clans` | getClanScores | Get all 5 clan scores (real-time) |
| GET | `/scores/history` | getCaptureHistory | Get territory capture history |
| GET | `/season/summary` | getSeasonSummary | Get season-end summary and leaderboards |

### Space Decoration

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/spaces/captured` | getCapturedSpaces | Get all captured spaces with overlays |
| GET | `/spaces/{spaceId}/decoration` | getDecoration | Get decoration layout for a space |
| PUT | `/spaces/{spaceId}/decoration` | saveDecoration | Save decoration layout |

### Admin — Location Management

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/admin/locations` | getLocations | List all game locations |
| POST | `/admin/locations` | createLocation | Create a new location |
| PUT | `/admin/locations/{locationId}` | updateLocation | Update location details |
| DELETE | `/admin/locations/{locationId}` | deleteLocation | Remove a location |
| GET | `/admin/locations/master` | getMasterLocations | Get master location configs |
| PUT | `/admin/locations/master/{locationId}` | updateMasterLocation | Update master config |

### Admin — Daily Configuration

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/admin/daily/config` | getDailyConfig | Get today's daily config |
| POST | `/admin/daily/config` | setDailyConfig | Create/update daily config |
| POST | `/admin/daily/apply` | applyDailyConfig | Apply config (generate QR secrets) |
| POST | `/admin/daily/deploy` | deployAssignments | Deploy player-location assignments |
| POST | `/admin/daily/suggest` | suggestDailyPool | AI-suggested location pool |

### Admin — QR Management

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/admin/qr/generate` | generateQR | Generate QR codes for locations |
| POST | `/admin/qr/reset` | resetQR | Reset QR secret for today |

### Admin — User Management

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/admin/users` | getUsers | Search/list players |
| GET | `/admin/users/{userId}/detail` | getUserDetail | Get detailed player info |
| GET | `/admin/users/{userId}/sessions` | getUserSessions | Get player's game history |
| PUT | `/admin/users/{userId}/status` | updateUserStatus | Enable/disable player |
| POST | `/admin/users/{userId}/xp-adjust` | adjustUserXp | Manually adjust XP |
| PUT | `/admin/users/{userId}/cluster` | updateUserCluster | Reassign player cluster |

### Admin — Season Management

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/admin/season/schedule` | getSeasonSchedule | Get season date schedule |
| PUT | `/admin/season/schedule` | saveSeasonSchedule | Update season schedule |
| POST | `/admin/season/reset` | seasonReset | Full season reset |
| GET | `/admin/season/status` | getSeasonStatus | Get current season status |
| GET | `/admin/season/halloffame` | hallOfFame | Get hall of fame data |

### Admin — Notifications

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/admin/notifications/send` | sendNotification | Send push notification |
| DELETE | `/admin/notifications/{notificationId}` | cancelNotification | Cancel scheduled notification |
| POST | `/admin/test-notification` | testNotification | Send test notification |
| GET | `/admin/notifications/history` | getNotificationHistory | Get notification history |

### Admin — Analytics (10 Endpoints)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/admin/analytics` | analytics | Root analytics data |
| GET | `/admin/analytics/overview` | analyticsOverview | Today vs yesterday dashboard |
| GET | `/admin/analytics/engagement` | analyticsEngagement | DAU, sessions, checkins over time |
| GET | `/admin/analytics/clans` | analyticsClans | Per-clan XP, participation, territories |
| GET | `/admin/analytics/locations` | analyticsLocations | Per-location visit data and heatmap |
| GET | `/admin/analytics/minigames` | analyticsMinigames | Win rates, play counts, abandonment |
| GET | `/admin/analytics/free-roam` | analyticsFreeRoam | Check-in data and sentiment |
| GET | `/admin/analytics/clusters` | analyticsClusters | Player cluster behavior analysis |
| GET | `/admin/analytics/decay` | analyticsDecay | Engagement decay alerts |
| GET | `/admin/analytics/cluster-migration` | analyticsClusterMigration | Cluster migration tracking |

### Admin — Data Export (8 Endpoints)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/admin/export/game-sessions` | exportGameSessions | Export all game sessions |
| GET | `/admin/export/player-profiles` | exportPlayerProfiles | Export all player profiles |
| GET | `/admin/export/daily-configs` | exportDailyConfigs | Export daily config history |
| GET | `/admin/export/player-assignments` | exportPlayerAssignments | Export assignment data |
| GET | `/admin/export/capture-history` | exportCaptureHistory | Export capture history |
| GET | `/admin/export/locations` | exportLocations | Export location data |
| GET | `/admin/export/notification-history` | exportNotificationHistory | Export notification log |
| GET | `/admin/checkins/export` | exportCheckins | Export free-roam check-ins |

### Admin — Other

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/admin/map/upload-url` | mapUploadUrl | Get presigned S3 URL for map upload |
| POST | `/admin/map/calibration` | saveMapCalibration | Save GPS-pixel calibration |
| POST | `/admin/roster/import` | importRoster | Import CSV roster |
| POST | `/admin/roster/seed` | seedRoster | Seed roster data |
| POST | `/admin/import/clusters` | importClusters | Import cluster assignments |
| POST | `/admin/import/space-metadata` | importSpaceMetadata | Import space metadata |
| GET | `/admin/clusters/weights` | getClusterWeights | Get cluster assignment weights |
| PUT | `/admin/clusters/weights` | updateClusterWeights | Update cluster weights |
| POST | `/admin/overlays/delete` | deleteOverlay | Delete a map overlay |
| POST | `/admin/debug/trigger-scheduled` | triggerScheduled | Manually trigger scheduled jobs |

### WebSocket Messages

| Type | Direction | Trigger | Data |
|------|-----------|---------|------|
| `SCORE_UPDATE` | Server → Client | Game completion | `{ clans: [{clanId, todayXp, todayParticipants, rosterSize}], timestamp }` |
| `CAPTURE` | Server → Client | Territory captured | `{ winnerClan, spaceName, mapOverlayId }` |
| `DAILY_RESET` | Server → Client | 8 AM reset | `{ date, resetSeq }` |
| `SCORING_COMPLETE` | Server → Client | 6 PM scoring done | `{ winnerClan, spaceName, mapOverlayId }` |
| `SCORES_CHANGED` | Server → Client | Score change | Triggers client-side refetch |

### API Response Format

All endpoints return JSON:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

**Error Codes:** `INVALID_DOMAIN`, `NOT_IN_ROSTER`, `INVALID_CODE`, `QR_EXPIRED`, `QR_INVALID`, `GPS_OUT_OF_RANGE`, `NOT_ASSIGNED`, `LOCATION_LOCKED`, `DAILY_CAP_REACHED`, `MINIGAME_ALREADY_PLAYED`, `MINIGAME_ALREADY_WON`, `LOCATION_EXHAUSTED`, `SESSION_NOT_FOUND`, `SESSION_COMPLETED`, `INVALID_HASH`, `SUSPICIOUS_TIME`, `RATE_LIMITED`, `UNAUTHORIZED`, `FORBIDDEN`, `GAME_INACTIVE`, `SEASON_ENDED`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`, `NOT_ADMIN`, `ALL_MINIGAMES_PLAYED`, `NOT_IN_RANGE`, `ALREADY_CHECKED_IN`, `COOP_REQUIRED`

---

## 10. Admin Dashboard

**URL:** Deployed as a Vite static site (local dev: `http://localhost:5173`)

### Implemented Pages (14/14 — All Complete)

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Google OAuth sign-in |
| Dashboard | `/dashboard` | Clan scores overview, quick-action links |
| Daily Config | `/daily-config` | Set today's locations, target space, polygon editor |
| Locations | `/locations` | CRUD master location list with classification |
| Roster | `/roster` | CSV roster import (email, house columns) |
| Map Calibration | `/map-calibration` | Upload map image, set GPS calibration points |
| QR Generator | `/qr-generator` | Generate/reset QR codes, download PDFs |
| Notifications | `/notifications` | Send push notifications, view history, templates |
| Analytics | `/analytics` | 6-tab analytics (overview, clans, locations, minigames, free-roam, clusters) |
| Users | `/users` | Player search, detail panel, cluster reassignment |
| Season | `/season` | Hall of fame, data exports, season reset |
| Capture History | `/capture-history` | View/delete capture events with filters |
| Cluster Config | `/cluster-config` | Edit cluster weights and bad pairings |
| Phase 1 Import | `/phase1-import` | Bulk import cluster and space metadata from CSV |

### Key Admin Workflows

**Setting Up a New Day:**
1. Go to Daily Config page
2. Click "Suggest Pool" to get AI-suggested locations (or manually select)
3. Set target space name, description, and draw polygon on map
4. Click "Save Config"
5. Click "Apply Config" (generates QR secrets)
6. Click "Deploy Assignments" (creates per-player location assignments)
7. Go to QR Generator to download/print QR code PDFs

**Importing a Roster:**
1. Go to Roster page
2. Prepare CSV with columns: `email,house`
3. Valid houses: `ember`, `tide`, `bloom`, `gale`, `hearth`
4. Upload CSV — backend validates and imports

**Season Reset:**
1. Go to Season page
2. Review hall of fame and export data for records
3. Click "Reset Season" with confirmation
4. All XP, captures, and assignments are cleared

### Dashboard Colors

| Element | Color | Hex |
|---------|-------|-----|
| Sidebar | Dark Gold | `#8B6914` |
| Content Background | Parchment | `#F5EACB` |
| Accent | Honey Gold | `#D4A843` |
| Text | Dark Brown | `#3D2B1F` |

---

## 11. Scheduled Jobs

### Daily Reset (8:00 AM IST / cron 2:30 UTC)

Runs every morning to prepare for a new game day:

1. Mark yesterday's daily-config as `status: 'complete'`
2. Reset all users' `todayXp` to 0
3. Reset streaks for players who missed yesterday (had 0 XP on a game day)
4. Reset all 5 clans: `todayXp = 0`, clear `todayXpTimestamp`, `todayParticipants = 0`
5. Delete yesterday's player-locks (TTL fallback for any that didn't auto-expire)
6. Generate player-location assignments for today
7. Write `resetSeq` to today's daily-config
8. Send day-start push notification
9. Broadcast `DAILY_RESET` via WebSocket to all connected clients
10. Revert any `bonusXP` flags on locations
11. Update rolling 3-day visit counts for location analytics

### Daily Scoring (6:00 PM IST / cron 12:30 UTC)

Determines which clan captures today's target space:

1. Set today's daily-config `status` to `'scoring'`
2. Compare all 5 clans' `todayXp` values
3. **Tiebreaker:** If tied, the clan with the earlier `todayXpTimestamp` wins (reached the score first)
4. Create a `captured-spaces` record with the winner
5. Update daily-config with `winnerClan`
6. Send push notification announcing the capture
7. Broadcast `CAPTURE` + `SCORING_COMPLETE` via WebSocket
8. Update user streaks (increment for active players, reset for inactive on game days)

### Asset Expiry (Midnight IST / cron 18:30 UTC)

- Scans `player-assets` table for unplaced assets past their `expiresAt` timestamp
- Marks them as `expired: true`
- Expired assets are hidden from the player's inventory

### Asset Expiry Warning (9:00 PM IST / cron 15:30 UTC)

- Finds users with unplaced assets that expire at midnight
- Sends FCM push notification reminding them to place their assets

### Event Window Notifications

| Time (IST) | Cron (UTC) | Purpose |
|-------------|------------|---------|
| 10:40 AM | `cron(10 5 * * ? *)` | Morning break engagement push |
| 12:40 PM | `cron(10 7 * * ? *)` | Lunch break engagement push |
| 5:00 PM | `cron(30 11 * * ? *)` | Final push before 6 PM scoring |

### Other Scheduled Jobs

| Time (IST) | Job | Purpose |
|-------------|-----|---------|
| 6:30 PM | Compute Dwell Fallbacks | Process dwell time fallback calculations |
| Every 5 min | Process Scheduled Notifications | Send queued/scheduled push notifications |

---

## 12. Anti-Cheat Measures

### QR Code Security
- QR codes contain an HMAC-SHA256 signature: `HMAC(locationId:date, dailySecret)`
- The daily secret rotates every day and is stored in `daily-config` table
- QR payload includes version, location ID, date, and HMAC hash
- **Timing-safe comparison** (`crypto.timingSafeEqual`) prevents timing attacks
- QR codes are date-stamped — yesterday's QR codes are rejected

### GPS Geofence Verification
- After QR scan, server verifies player's GPS coordinates
- Must be within the location's `geofenceRadius` (typically 15-20 meters)
- Uses Haversine formula for distance calculation
- Rejects requests with `GPS_OUT_OF_RANGE` error

### Completion Hash Validation
- When starting a minigame, server generates a per-session random `_salt`
- Client computes `completionHash = HMAC(sessionId:result:timeTaken, clientSalt)`
- Server validates the hash on completion submission
- Prevents replay attacks and result tampering

### Time Validation
- Server records `startedAt` timestamp when minigame begins
- On completion, server checks `timeTaken` against the session's `timeLimit`
- Suspiciously fast completions flagged with `SUSPICIOUS_TIME`

### Per-Location XP Cap
- Server tracks which locations a player has already won at today
- XP is only awarded for the **first win** at each location
- Enforced both client-side (practice mode UI) and server-side (XP condition check)
- DynamoDB condition expression: `todayXp <= :maxXp` (75) prevents exceeding cap

### Rate Limiting
- Players cannot complete minigames faster than expected
- Session state tracked — cannot complete an already-completed session (`SESSION_COMPLETED`)
- Cannot start a minigame at a locked location (`LOCATION_LOCKED`)

---

## 13. Key Implementation Patterns and Gotchas

### Metro Bundler (React Native)
- `require()` calls must use **static string literals** — no computed paths
- Dynamic imports are not supported
- All minigame images in `shift-slide/imageList.ts` use static require paths

### Stale Closures in Minigames
- Callbacks passed to `setTimeout` can capture stale state
- **Pattern:** Store `onComplete` in a `useRef` and sync with `useEffect`:
  ```typescript
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  ```
- All 15 minigames use `completedRef` (boolean) to prevent double-completion
- Results stored in `pendingCompleteRef` until user taps "Continue"

### Navigation Independence
- API calls after game completion are **fire-and-forget** with try-catch
- Navigation to `ResultScreen` must work even if the server call fails
- Never block the UI thread waiting for a network response

### Coordinate Systems
- **GPS coordinates:** Latitude/longitude (WGS84)
- **Pixel coordinates:** 0-2000 (width) x 0-1125 (height) on the campus map
- **Affine transform:** 6-parameter matrix converts between the two spaces
- Calibration requires 3+ known GPS-pixel point pairs
- Transform stored in `map-calibration` table

### Android Networking
- In emulator: use `10.0.2.2` for localhost
- Production: use the actual API Gateway URL
- Controlled by `__DEV__` ternary in `constants/api.ts`

### Firebase Configuration
- Modular v22 API (not legacy namespaced)
- `GoogleSignin.configure()` must be called before any sign-in attempt
- SHA-1 fingerprint must be registered in Firebase Console for the signing key
- Service account JSON stored in SSM Parameter Store, not in code

### Font Usage
- **Caveat Bold:** Headers, game titles, clan names
- **Nunito:** Body text, descriptions, labels
- Loaded via `react-native-asset` linking

### IST Timezone
- Always use `date-fns-tz` with `"Asia/Kolkata"` timezone
- Never hardcode `+5:30` offset
- All DynamoDB timestamps stored in UTC, converted to IST on client

---

## 14. Current Project Status

### Completed

| Component | Status | Notes |
|-----------|--------|-------|
| Backend Infrastructure | Done | 19 DynamoDB tables, 70+ Lambda functions, REST + WebSocket APIs |
| Firebase Auth | Done | Google Sign-In + Firebase (migrated from Cognito) |
| Mobile App Scaffold | Done | React Native Android, portrait-locked, full navigation |
| Campus Map System | Done | Skia rendering, affine calibration, GPS tracking, territory overlays |
| QR System | Done | HMAC-signed daily QR codes, camera scan, geofence verification |
| All 15 Solo Minigames | Done | Logic + Game components, tests, anti-cheat hashes |
| 6 Co-op Minigames | Done | Kindred, Cipher Stones, Pips, Stone Pairs, Potion Logic, Vine Trail |
| XP / Scoring System | Done | 25 XP/win, 100 cap, per-location XP, atomic clan updates |
| Territory Capture | Done | 6 PM scoring with tiebreaker, WebSocket broadcasts |
| Push Notifications | Done | FCM integration, event windows, admin triggers |
| Admin Dashboard | Done | All 14 pages fully implemented |
| Analytics | Done | 10 analytics endpoints, 6-tab dashboard with charts |
| Data Export | Done | 8 export endpoints for CSV download |
| Roster System | Done | CSV import, 5-clan support, email validation |
| Free-Roam Check-in | Done | Location check-in without QR, sentiment tracking |
| Cluster-Based Assignments | Done | Player clustering, weighted location assignment |
| Scheduled Notifications | Done | Queue-based push notification system |

### In Progress / Partially Done

| Component | Status | Notes |
|-----------|--------|-------|
| Tutorial System | Partial | Tutorial screen exists, scene components started, not fully wired |
| Character Creation | Partial | Screen exists with preset system, not complete |
| Chest Economy | Working | Drops and assets work, inventory screen is a stub |

### Not Yet Started

| Component | Notes |
|-----------|-------|
| Player Profile Screen | Stats, streaks, badges display — screen exists as stub |
| Asset Inventory Screen | Grid view with expiry countdown — screen exists as stub |
| Space Decoration Screen | Drag-and-drop asset placement — screen exists as stub |
| Season Summary Screen | End-of-season hall of fame — screen exists as stub |
| Signal Path Minigame | 16th minigame mentioned in planning, no code exists |

### Known Issues

1. **GDD says landscape, code is portrait** — The original GDD and CLAUDE.md reference "landscape-locked" but the actual implementation is portrait-locked. The code is correct; the docs are outdated.

---

## 15. File Structure

### Repository Root
```
cottagecore_territory/
├── docs/
│   ├── GroveWars_GDD_v1.1.md          # Original game design document
│   └── GroveWars_Complete_Guide.md     # This file
├── mobile/                              # React Native Android app
├── backend/                             # AWS SAM serverless backend
└── admin/                               # React web admin dashboard
```

### Mobile App (`mobile/src/`)
```
mobile/src/
├── api/
│   ├── client.ts                # API client with JWT auth and retry
│   ├── auth.ts                  # Google Sign-In + Firebase auth
│   ├── game.ts                  # Game flow API (scan, start, complete)
│   ├── scores.ts                # Clan scores and capture history
│   └── checkinApi.ts            # Free-roam check-in API
├── assets/
│   ├── fonts/                   # Caveat Bold, Nunito
│   ├── maps/                    # Campus map PNG
│   ├── sprites/
│   │   └── minigames/shift-slide/  # 10 puzzle images
│   └── ui/                      # UI frames and backgrounds
├── components/
│   ├── common/
│   │   ├── DebugPanel.tsx       # GPS override, player reset, dev tools
│   │   ├── FreeRoamCheckInModal.tsx
│   │   └── UnplacedAssetsBadge.tsx
│   ├── map/
│   │   ├── MapCanvas.tsx        # Skia-based map renderer
│   │   ├── MapOverlay.tsx       # Territory overlays
│   │   ├── MapPin.tsx           # Location pin component
│   │   └── MapPinsLayer.tsx     # Aggregate pin layer
│   ├── minigames/
│   │   ├── GameCompleteOverlay.tsx  # Shared win/lose overlay
│   │   └── CoopDivider.tsx      # Split-screen co-op UI
│   ├── profile/                 # Avatar components
│   └── tutorial/                # Tutorial scene components
├── constants/
│   ├── api.ts                   # API base URLs (dev/prod)
│   ├── colors.ts                # CLAN_COLORS, PALETTE, UI, LORE_CLANS
│   └── minigames.ts            # Difficulty classification (easy/medium/hard)
├── hooks/
│   ├── useWebSocket.ts          # WebSocket connection + message handling
│   ├── useCheckin.ts            # Free-roam check-in logic
│   └── useDwellTracking.ts      # Time-at-location tracking
├── minigames/
│   ├── bloom-sequence/          # BloomSequenceLogic.ts + BloomSequenceGame.tsx
│   ├── cipher-stones/           # CipherStonesLogic.ts + CipherStonesGame.tsx + quotedatabase.ts
│   ├── cipher-stones-coop/      # CipherStonesCoopGame.tsx
│   ├── firefly-flow/            # FireflyFlowLogic.ts + FireflyFlowGame.tsx
│   ├── grove-equations/         # GroveEquationsLogic.ts + GroveEquationsGame.tsx
│   ├── grove-words/             # GroveWordsLogic.ts + GroveWordsGame.tsx + wordlist.ts + validGuesses.ts
│   ├── kindred/                 # KindredLogic.ts + KindredGame.tsx + groupPacks.ts (24 packs)
│   ├── kindred-coop/            # KindredCoopGame.tsx
│   ├── leaf-sort/               # LeafSortLogic.ts + LeafSortGame.tsx
│   ├── mosaic/                  # MosaicLogic.ts + MosaicGame.tsx
│   ├── number-grove/            # NumberGroveLogic.ts + NumberGroveGame.tsx + baseGrids.ts
│   ├── path-weaver/             # PathWeaverLogic.ts + PathWeaverGame.tsx + image_grids.ts
│   ├── pips/                    # PipsLogic.ts + PipsGame.tsx
│   ├── pips-coop/               # PipsCoopGame.tsx
│   ├── potion-logic/            # PotionLogicLogic.ts + PotionLogicGame.tsx
│   ├── potion-logic-coop/       # PotionLogicCoopGame.tsx
│   ├── shift-slide/             # ShiftSlideLogic.ts + ShiftSlideGame.tsx + imageList.ts (10 images)
│   ├── stone-pairs/             # StonePairsLogic.ts + StonePairsGame.tsx
│   ├── stone-pairs-coop/        # StonePairsCoopGame.tsx
│   ├── vine-trail/              # VineTrailLogic.ts + VineTrailGame.tsx + vineTrailPacks.ts
│   └── vine-trail-coop/         # VineTrailCoopGame.tsx
├── navigation/
│   ├── RootNavigator.tsx        # Root navigation container
│   └── MainStack.tsx            # Main app stack navigator
├── screens/
│   ├── MainMapScreen.tsx        # Campus map with location pins
│   ├── QRScannerScreen.tsx      # Camera QR scanner
│   ├── MinigameSelectScreen.tsx # Minigame picker (2E + 3M + 1H)
│   ├── MinigamePlayScreen.tsx   # Minigame host (loads game component)
│   ├── ResultScreen.tsx         # Post-game results, chest drops
│   ├── ClanScoreboardScreen.tsx # Real-time clan leaderboard
│   ├── PlayerProfileScreen.tsx  # Player stats (stub)
│   ├── AssetInventoryScreen.tsx # Asset collection (stub)
│   ├── SpaceDecorationScreen.tsx # Space customization (stub)
│   ├── SeasonSummaryScreen.tsx  # Season recap (stub)
│   ├── TutorialScreen.tsx       # Tutorial flow (partial)
│   ├── CharacterCreationScreen.tsx # Avatar creation (partial)
│   ├── SpaceSentimentScreen.tsx # Location sentiment survey
│   └── SettingsScreen.tsx       # App settings
├── store/
│   ├── useAuthStore.ts          # Auth state, Firebase token, user profile
│   ├── useGameStore.ts          # Game state, sessions, locks
│   ├── useClanStore.ts          # Clan scores, WebSocket updates
│   ├── useDebugStore.ts         # Debug mode flags
│   └── useAssetStore.ts         # Asset inventory state
├── types/
│   ├── index.ts                 # All TypeScript types (50+ interfaces)
│   └── minigame.ts             # MinigameResult, MinigamePlayProps
└── utils/
    ├── notifications.ts         # FCM token registration
    ├── minigameSelection.ts     # 2E+3M+1H selection algorithm
    ├── assetExpiry.ts           # Client-side expiry calculations
    └── characterPresets.ts      # Avatar preset configurations
```

### Backend (`backend/`)
```
backend/
├── template.yaml                # SAM template (all infrastructure)
├── samconfig.toml               # Dev + prod deploy configs
├── package.json
├── tsconfig.json                # strict: true, ES2020, commonjs
├── shared/
│   ├── types.ts                 # All TypeScript types + enums
│   ├── schemas.ts               # Zod validation schemas
│   ├── db.ts                    # DynamoDB DocumentClient helpers
│   ├── auth.ts                  # Firebase JWT verification
│   ├── firebase.ts              # Firebase Admin SDK initialization
│   ├── hmac.ts                  # QR HMAC + completion hash
│   ├── notifications.ts         # FCM push notifications
│   ├── geo.ts                   # Haversine distance formula
│   ├── affineTransform.ts       # GPS-pixel coordinate transform
│   ├── time.ts                  # IST timezone helpers
│   ├── response.ts              # success()/error() helpers + ErrorCode enum
│   ├── locationAssignment.ts    # Cluster-weighted location assignment
│   └── minigames.ts             # MINIGAME_POOL (21 games, time limits)
├── functions/
│   ├── auth/                    # googleLogin, adminGoogleLogin, lambdaAuthorizer
│   ├── player/                  # getProfile, updateAvatar, updateFcmToken, getAssets, getStats
│   ├── game/
│   │   ├── scanQR.ts            # 9-step QR validation chain
│   │   ├── startMinigame.ts     # Session creation + puzzle generation
│   │   ├── completeMinigame.ts  # XP award, clan update, chest drop, lock on loss
│   │   ├── startPractice.ts     # Practice mode (no XP)
│   │   ├── checkin.ts           # Free-roam check-in
│   │   ├── submitLeave.ts       # Session departure recording
│   │   ├── submitSentiment.ts   # Location sentiment
│   │   └── mosaic/              # Mosaic puzzle generation helpers
│   ├── scores/
│   │   ├── getClanScores.ts     # All 5 clan scores
│   │   ├── getCaptureHistory.ts # Territory capture history
│   │   └── getSeasonSummary.ts  # Season-end summary
│   ├── spaces/                  # getCapturedSpaces, getDecoration, saveDecoration
│   ├── checkin/                 # submitCheckin
│   ├── admin/                   # 40+ admin endpoints (see API section)
│   ├── scheduled/
│   │   ├── dailyReset.ts        # 8 AM IST daily reset
│   │   ├── dailyScoring.ts      # 6 PM IST scoring + tiebreaker
│   │   ├── assetExpiry.ts       # Midnight IST asset expiry
│   │   ├── assetExpiryWarning.ts # 9 PM IST expiry warning
│   │   ├── computeDwellFallbacks.ts # Dwell time processing
│   │   └── processScheduledNotifications.ts # Queued push delivery
│   ├── websocket/
│   │   └── broadcast.ts         # WebSocket broadcast helpers
│   ├── debug/                   # resetPlayerState
│   ├── getMapConfig.ts          # Presigned S3 URL for map
│   ├── getTodayLocations.ts     # Player's daily assignments
│   ├── getDailyInfo.ts          # Daily config for players
│   ├── wsConnect.ts             # WebSocket $connect handler
│   ├── wsDisconnect.ts          # WebSocket $disconnect handler
│   └── wsDefault.ts             # WebSocket $default handler
├── scripts/
│   ├── seedLocations.ts         # Seed location data
│   ├── seedAssetCatalog.ts      # Seed asset catalog
│   ├── seedClusterWeights.ts    # Seed cluster weights
│   └── seedUserClusters.ts      # Import user cluster assignments
└── __tests__/                   # Backend tests
```

### Admin Dashboard (`admin/src/`)
```
admin/src/
├── api/
│   ├── client.ts                # API client with JWT auth
│   ├── analytics.ts             # Analytics endpoints
│   ├── daily.ts                 # Daily config CRUD
│   ├── locations.ts             # Location management
│   ├── notifications.ts         # Notification endpoints
│   ├── season.ts                # Season management
│   └── users.ts                 # User management
├── components/
│   ├── Layout.tsx               # Sidebar + content layout
│   ├── ProtectedRoute.tsx       # Auth guard wrapper
│   ├── MapHeatmap.tsx           # Analytics heatmap overlay
│   ├── MapPolygonEditor.tsx     # Draw territory polygons on map
│   └── [shared UI components]   # DataTable, Modal, FormField, etc.
├── constants/
│   ├── api.ts                   # BASE_URL, Firebase config
│   └── map.ts                   # Map dimensions (2000x1125, tile 16)
├── pages/
│   ├── LoginPage.tsx            # Google OAuth login
│   ├── DashboardPage.tsx        # Overview with clan scores
│   ├── DailyConfigPage.tsx      # Set daily locations and target
│   ├── LocationsPage.tsx        # Master location editor
│   ├── RosterPage.tsx           # CSV roster import
│   ├── MapCalibrationPage.tsx   # GPS-pixel calibration
│   ├── QRGeneratorPage.tsx      # Generate QR code PDFs
│   ├── NotificationsPage.tsx    # Push notification management
│   ├── AnalyticsPage.tsx        # 6-tab analytics dashboard
│   ├── UsersPage.tsx            # Player search and management
│   ├── SeasonPage.tsx           # Season management + exports
│   ├── CaptureHistoryPage.tsx   # Capture event viewer
│   ├── ClusterConfigPage.tsx    # Cluster weight editor
│   └── Phase1ImportPage.tsx     # Bulk CSV data import
├── store/
│   └── useAuthStore.ts          # Auth state + token management
├── types/
│   └── index.ts                 # All admin TypeScript types
└── utils/
    └── affineTransform.ts       # GPS-pixel transform (shared math)
```

---

## 16. Debug and Development

### Debug System

The mobile app includes a `DebugPanel` component (visible in dev builds) that provides:
- **GPS Override:** Set fake GPS coordinates for testing without physically being at a location
- **Player State Reset:** Call admin endpoint to reset XP, locks, and assignments
- **Game Lifecycle Short-circuit:** Skip QR scanning and go directly to minigame selection
- **Dev-mode QR bypass:** In dev builds, HMAC and assignment checks can be relaxed

### Admin Debug Tools

- **Trigger Scheduled Jobs:** Admin dashboard can manually trigger daily reset, scoring, or notifications via `POST /admin/debug/trigger-scheduled`
- **Adjust User XP:** Manually add/remove XP for testing via `POST /admin/users/{userId}/xp-adjust`
- **Reset Player State:** Clear a player's daily state via debug endpoint

### Building and Distribution

**APK Build:**
```bash
cd mobile/android
./gradlew assembleRelease
```
- Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`
- Distributed directly to testers (not via Play Store)

**Firebase SHA-1 Requirement:**
- Google Sign-In requires the APK signing key's SHA-1 fingerprint
- Must be registered in Firebase Console > Project Settings > Android App
- Debug key: `keytool -list -v -keystore ~/.android/debug.keystore`
- Release key: from your release keystore

### Environment Switching

**Backend:**
- `STAGE=dev` (default) — development environment
- `STAGE=prod` — production environment
- Controlled via SAM deploy parameters

**Mobile:**
- `__DEV__` flag (React Native built-in) switches between:
  - Dev: `http://10.0.2.2:3000` (emulator localhost)
  - Prod: `https://incbqo08d8.execute-api.ap-south-1.amazonaws.com/dev`

**Admin:**
- `VITE_STAGE` environment variable
- Controls API base URL and debug feature visibility

### SAM CLI

```bash
# Deploy backend (dev)
"/c/Program Files/Amazon/AWSSAMCLI/bin/sam.cmd" deploy --config-env dev

# Deploy backend (prod)
"/c/Program Files/Amazon/AWSSAMCLI/bin/sam.cmd" deploy --config-env prod

# Local testing
"/c/Program Files/Amazon/AWSSAMCLI/bin/sam.cmd" local start-api
```

---

*This document was generated from a comprehensive audit of the GroveWars codebase on 2026-03-19.*
