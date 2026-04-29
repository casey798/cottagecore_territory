# PRESENTATION_REFERENCE.md — GroveWars Thesis Jury Reference

> **For:** M.Arch thesis jury presentation at TCE, Tamil Nadu
> **Presenter:** Researcher/Developer
> **Audience:** Architecture academic panel (not a tech audience)
> **Date prepared:** 2026-03-25
> **Source of truth:** `docs/CODEBASE_TRUTH.md` (full-repo audit, same date)

---

## SECTION 1 — RESEARCH FRAMING

### Thesis Statement

Every college campus has spaces that students avoid — corridors nobody lingers in, courtyards walked through but never occupied, gardens that exist on the master plan but not in daily student life. **GroveWars tests the hypothesis that a location-based game can transform these "Dead Zones" into voluntarily visited, socially active spaces** by embedding gameplay rewards into the physical act of being present in underutilised areas. The research measures whether game-driven spatial activation produces measurable, sustained changes in how students occupy their campus.

### What Are "Dead Zones"?

In this study, a Dead Zone is any campus space where observed occupancy, dwell time, and voluntary activity are significantly below what the space's design capacity and location would predict. These are architecturally functional spaces that fail socially — students pass through them but do not stop, sit, gather, or engage.

### Phase 1 → Phase 2 Connection

- **Phase 1 ("Whatcha Doin'" baseline study):** 700+ activity logs collected over 1.5 weeks via a free-roam check-in tool. Students self-reported what they were doing, where, for how long, and how satisfied they were. This established the **pre-game spatial behaviour baseline** — which spaces are alive, which are dead.
- **Phase 2 (GroveWars gameplay):** The game directs players to specific locations (including Dead Zones) daily. Game session data — dwell time, visit frequency, sentiment, return intent — is collected passively. Comparing Phase 2 data against Phase 1 baselines reveals whether the game activated Dead Zones.
- **The bridge:** Free-roam check-ins remain active during Phase 2 (via **FreeRoamCheckInScreen**), so non-game spatial behaviour is tracked alongside game-driven visits.

### What Does Success Look Like?

Students voluntarily visiting spaces they previously ignored, returning to those spaces even without a game prompt, and reporting positive sentiment about the space itself (not just the game). The post-minigame question — *"Would you return to this space without the game?"* — is the key indicator.

### Key Metric

- **Target:** 300–500 daily active users (DAU) across a 9-week season
- **Campus:** Thiagarajar College of Engineering (TCE), Madurai, Tamil Nadu

---

## SECTION 2 — GAME CONCEPT TALKING POINTS

| # | Talking Point | 1-Sentence Pitch | File(s) to Show | What to Show Visually |
|---|---|---|---|---|
| 1 | **Daily Game Loop** | "Every day, students walk to assigned campus locations, scan a QR code to prove they're physically there, solve a short puzzle, and earn XP for their clan." | **backend/functions/game/scanQR.ts** (7-step validation), **backend/functions/game/completeMinigame.ts** (XP award) | Flow diagram: Walk → Scan → Solve → Earn XP → Clan scores update |
| 2 | **Five Clans** | "The campus is divided into five clans — Ember, Tide, Bloom, Gale, and Hearth — and students compete all day to see whose clan captures tonight's territory." | **backend/functions/scheduled/dailyScoring.ts** (6 PM scoring), **mobile/src/screens/ClanScoreboardScreen.tsx** | Clan scoreboard screen with live XP totals and clan colours |
| 3 | **15 Minigames** | "We designed 15 puzzle minigames in a cottagecore aesthetic — from memory-matching stones to nonogram weaving — each taking 60–180 seconds to play." | **mobile/src/minigames/** (15 solo dirs), **mobile/src/constants/minigames.ts** (MINIGAME_META registry) | MinigameSelectScreen showing the game grid, then one game in action |
| 4 | **Co-op Mode** | "At certain locations, two players share one phone and solve puzzles together — both clans get XP, encouraging cross-clan social interaction." | **mobile/src/screens/QRScannerScreen.tsx** (partner lookup), co-op minigame dirs (e.g. **mobile/src/minigames/stone-pairs-coop/**) | QR scanner with partner code entry, then a co-op game in split-view |
| 5 | **Campus Map + GPS Transform** | "We photographed the actual campus map, calibrated GPS coordinates to pixel positions using an affine transform, and render live player positions on it." | **mobile/src/utils/affineTransform.ts** (gpsToPixel, pixelToGps), **mobile/src/components/map/MapCanvas.tsx** | MainMapScreen with player dot, location pins, and territory overlays |
| 6 | **6 PM Territory Capture** | "At 6 PM every day, scores freeze, the winning clan captures today's target space on the map, and every player gets a push notification with the result." | **backend/functions/scheduled/dailyScoring.ts**, **mobile/src/screens/CaptureCelebrationScreen.tsx** | Capture celebration animation + push notification mock |
| 7 | **Asset/Decoration System** | "Winning games drops treasure chests with decorative assets — players place these on captured territories to personalise the map and mark clan identity." | **backend/functions/spaces/saveDecoration.ts**, **mobile/src/screens/SpaceDecorationScreen.tsx**, **mobile/src/screens/AssetInventoryScreen.tsx** | Asset inventory grid → decoration placement screen on a captured space |

---

## SECTION 3 — TECHNICAL ARCHITECTURE REFERENCE

### A. Mobile App — Screens (19 files)

> **Path:** `mobile/src/screens/`
> **Purpose:** Each file is one full-screen view in the app.

| File | Component | Purpose |
|---|---|---|
| **MainMapScreen.tsx** | MainMapScreen | Campus map with clan overlays, location pins, player marker, and navigation hub |
| **LoginScreen.tsx** | LoginScreen | Google Sign-In entry point |
| **TutorialScreen.tsx** | TutorialScreen | 9-scene onboarding (6 slides + character creation + practice map + outro) |
| **CharacterCreationScreen.tsx** | CharacterCreationScreen | Pixel avatar builder + clan selection |
| **QRScannerScreen.tsx** | QRScannerScreen | Camera-based QR scanning with optional co-op partner lookup |
| **MinigameSelectScreen.tsx** | MinigameSelectScreen | Grid of available minigames after a successful scan |
| **MinigamePlayScreen.tsx** | MinigamePlayScreen | Hosts the active minigame component, timer bar, and completion flow |
| **ResultScreen.tsx** | ResultScreen | Win/loss result, XP earned, chest drop, completion hash submission |
| **SpaceSentimentScreen.tsx** | SpaceSentimentScreen | Post-game survey: "Would you return to this space without the game?" |
| **ClanScoreboardScreen.tsx** | ClanScoreboardScreen | Real-time clan XP totals and capture history |
| **PlayerProfileScreen.tsx** | PlayerProfileScreen | Avatar display, stats, streak, season XP |
| **AssetInventoryScreen.tsx** | AssetInventoryScreen | Grid of collected decorative assets |
| **SpaceDecorationScreen.tsx** | SpaceDecorationScreen | Place assets on captured territory grid |
| **CaptureCelebrationScreen.tsx** | CaptureCelebrationScreen | 6 PM capture win/loss animation |
| **FreeRoamCheckInScreen.tsx** | FreeRoamCheckInScreen | Phase 1 "Whatcha Doin'" free-roam activity logger |
| **JournalScreen.tsx** | JournalScreen | Player's personal activity history |
| **SettingsScreen.tsx** | SettingsScreen | App settings, replay tutorial, logout |
| **TermsAndConditionsScreen.tsx** | TermsAndConditionsScreen | T&C acceptance gate |
| **SeasonSummaryScreen.tsx** | SeasonSummaryScreen | End-of-season stats and clan rankings |

**Jury interest:** The app is **landscape-locked** because the campus map is the central interface — it reads like a physical site plan, not a phone screen. Every screen runs in landscape orientation.

---

### B. Mobile App — Map System (7 + 1 files)

> **Path:** `mobile/src/components/map/` + `mobile/src/utils/affineTransform.ts`
> **Purpose:** Renders the campus map with GPS-positioned elements using react-native-skia.

| File | Export | Purpose |
|---|---|---|
| **MapCanvas.tsx** | MapCanvas | Main Skia canvas that renders the campus PNG and hosts all map layers |
| **MapPinsLayer.tsx** | MapPinsLayer | Renders location pins at GPS-transformed pixel positions |
| **MapPin.tsx** | MapPin | Individual pin component with category styling |
| **TerritoryOverlay.tsx** | TerritoryOverlay | Draws clan-coloured territory fills on captured spaces |
| **MapOverlay.tsx** | MapOverlay | HUD elements (XP bar, clan scores) overlaid on the map |
| **MapMinimap.tsx** | MapMinimap | Small overview inset when zoomed in |
| **DecorationMapItem.tsx** | DecorationMapItem | Renders placed decorative assets on the map |
| **affineTransform.ts** | gpsToPixel, pixelToGps, computeAffineParams | Least-squares 6-parameter affine transform between GPS and pixel coordinates |

**Jury interest:** The affine transform is calibrated using real GPS readings at known campus points — exactly the kind of site-survey-to-digital-overlay workflow architects do with CAD and GIS. The map is a 1920×1080 pixel art rendering of the actual TCE campus.

---

### C. Mobile App — Minigames (15 solo + 6 co-op)

> **Path:** `mobile/src/minigames/`
> **Purpose:** Each minigame is a self-contained folder with a Game component (rendering) and Logic file (pure puzzle logic).

#### Solo Minigames — 11 fully implemented with client-side files:

| ID | Display Name | Difficulty | Time | Key Files |
|---|---|---|---|---|
| stone-pairs | Flip & Match | easy | 90s | **StonePairsLogic.ts**, **StonePairsGame.tsx** |
| leaf-sort | Color Sort | easy | 90s | **LeafSortLogic.ts**, **LeafSortGame.tsx** |
| bloom-sequence | Spot the Pattern | easy | 60s | **BloomSequenceLogic.ts**, **BloomSequenceGame.tsx** |
| firefly-flow | Connect the Dots | easy | 90s | **FireflyFlowLogic.ts**, **FireflyFlowGame.tsx** |
| word-clusters | Word Clusters | medium | 180s | **WordClustersLogic.ts**, **WordClustersGame.tsx** |
| pips | Snuff Out | medium | 75s | **PipsLogic.ts**, **PipsGame.tsx** |
| mosaic | Tile Fit | medium | 120s | **MosaicLogic.ts**, **MosaicGame.tsx** |
| potion-logic | Logic Grid | hard | 150s | **PotionLogicLogic.ts**, **PotionLogicGame.tsx** |
| path-weaver | Nonogram | hard | 180s | **PathWeaverLogic.ts**, **PathWeaverGame.tsx** |
| grove-equations | Number Crunch | hard | 90s | **GroveEquationsLogic.ts**, **GroveEquationsGame.tsx** |
| shift-slide | Tile Slide | hard | 120s | **ShiftSlideLogic.ts**, **ShiftSlideGame.tsx** |

#### 4 Minigames — registered in pool, client files exist but flagged in audit as incomplete:

> ⚠️ Per CODEBASE_TRUTH.md Section 12 DEFERRED issue, these 4 were flagged as having no client-side Game/Logic files at audit time. Client directories with files have since been observed in the repo — **verify before demoing.**

| ID | Display Name | Difficulty | Status |
|---|---|---|---|
| number-grove | Mini Sudoku | easy | Verify before demo |
| grove-words | Wordle | medium | Verify before demo |
| cipher-stones | Cipher | medium | Verify before demo |
| vine-trail | Word Hunt | hard | Verify before demo |

#### 6 Co-op Variants:

| ID | Base Game | Key File |
|---|---|---|
| stone-pairs-coop | Flip & Match | **StonePairsCoopGame.tsx** |
| word-clusters-coop | Word Clusters | **WordClustersCoopGame.tsx** |
| pips-coop | Snuff Out | **PipsCoopGame.tsx** |
| cipher-stones-coop | Cipher | **CipherStonesCoopGame.tsx** |
| potion-logic-coop | Logic Grid | **PotionLogicCoopGame.tsx** |
| vine-trail-coop | Word Hunt | **VineTrailCoopGame.tsx** |

**Jury interest:** Each puzzle is procedurally generated (never hardcoded), so no two sessions are the same. The separation of Logic (testable pure functions) from Game (visual rendering) is deliberate software craftsmanship.

---

### D. Mobile App — State Management (7 Zustand stores)

> **Path:** `mobile/src/store/`
> **Purpose:** Zustand is a lightweight state manager — each store holds one domain of app state.

| File | Store | Purpose |
|---|---|---|
| **useAuthStore.ts** | Auth state | User profile, token, tutorial/TC flags; persisted to device storage |
| **useGameStore.ts** | Game state | Today's XP, current session, assignments, locks; persisted with daily auto-clear |
| **useMapStore.ts** | Map state | Map config, today's locations, captured spaces, player position; not persisted |
| **useClanStore.ts** | Clan state | Clan scores, WebSocket connection, capture results; not persisted |
| **useAssetStore.ts** | Asset state | Unplaced asset count for badge display |
| **useErrorStore.ts** | Error state | Global error handling |
| **useDebugStore.ts** | Debug state | Developer debug mode toggle |

**Jury interest:** The game store auto-clears stale daily data when the date rolls over — this is how the app knows "today" has changed and yesterday's assignments no longer apply.

---

### E. Mobile App — Hooks and Utils

> **Paths:** `mobile/src/hooks/` (7 files) + `mobile/src/utils/` (11 files)

#### Hooks (custom reusable behaviours):

| File | Hook | Purpose |
|---|---|---|
| **useGPS.ts** | useGPS | Watches device GPS and converts to map pixel position via affine transform |
| **useCountdown.ts** | useCountdown | Countdown timer for minigame time limits |
| **useClanScores.ts** | useClanScores | Fetches and subscribes to live clan score updates |
| **useWebSocket.ts** | useWebSocket | Manages WebSocket connection for real-time score broadcasts |
| **useDwellTracking.ts** | useDwellTracking | Tracks how long a player stays at a location (research metric) |
| **useScreenOrientation.ts** | useScreenOrientation | Enforces landscape lock |
| **useLocationLockTimer.ts** | useLocationLockTimer | Countdown for location lock expiry after a loss |

#### Utils (pure helper functions):

| File | Key Exports | Purpose |
|---|---|---|
| **affineTransform.ts** | gpsToPixel, pixelToGps | GPS ↔ pixel coordinate conversion |
| **hmac.ts** | generateCompletionHash | Client-side HMAC for anti-cheat verification |
| **qrValidation.ts** | parseQRPayload | Extracts and validates QR code data |
| **xpCalculations.ts** | calculateXpGain, isAtDailyCap | XP math and cap checking |
| **time.ts** | getISTDate, isGameHours | IST timezone helpers |
| **distance.ts** | haversineDistance | GPS distance calculation |
| **mapBounds.ts** | clampToMapBounds | Keeps player marker within map edges |
| **assetExpiry.ts** | isAssetExpiring | Checks if an asset expires at midnight |
| **notifications.ts** | — | Push notification permission and display helpers |
| **colorUtils.ts** | — | Colour manipulation for UI |
| **characterPresets.ts** | — | Default avatar configurations |

**Jury interest:** **useDwellTracking** is the research hook — it silently measures how long a student stays at a game location, which directly feeds the Dead Zone activation analysis.

---

### F. Backend — Scheduled Lambdas (8 files)

> **Path:** `backend/functions/scheduled/`
> **Purpose:** Automated daily game lifecycle — these run on timers, not player requests.

| File | IST Time | Purpose |
|---|---|---|
| **dailyClustering.ts** | 7:45 AM | K-means clustering of players into 5 behavioural profiles (runs before reset) |
| **dailyReset.ts** | 8:00 AM | Clears daily XP, clears locks, generates personalised location assignments, broadcasts DAILY_RESET |
| **eventWindowMorning.ts** | 10:40 AM | Push notification: morning break reminder to play |
| **eventWindowLunch.ts** | 12:40 PM | Push notification: lunch break reminder |
| **eventWindowFinal.ts** | 5:00 PM | Push notification: final hour push before scoring |
| **dailyScoring.ts** | 6:00 PM | Compares clan XP, determines winner, captures territory, broadcasts result |
| **assetExpiryWarning.ts** | 9:00 PM | Warns players about assets expiring at midnight |
| **assetExpiry.ts** | Midnight | Expires unplaced, non-permanent assets |

Additional scheduled functions:
- **computeDwellFallbacks.ts** — 6:30 PM: computes dwell time for sessions without explicit leave events
- **processScheduledNotifications.ts** — every 5 minutes: processes the notification queue

**Jury interest:** The 7:45 AM clustering → 8:00 AM reset pipeline means today's assignments are informed by yesterday's behavioural data. Students who always visit the same spaces get nudged to new ones. This is the **adaptive feedback loop** that makes the system a research instrument, not just a game.

---

### G. Backend — Game Lambdas (9 files)

> **Path:** `backend/functions/game/`
> **Purpose:** Core gameplay API — scan, start, complete, and collect research data.

| File | Endpoint | Purpose |
|---|---|---|
| **scanQR.ts** | POST /game/scan | 7-step QR validation: HMAC → active location → today's pool → assignment check → lock check → cap check → minigame roll (SOLO_SET_SIZE=6, COOP_SET_SIZE=3) |
| **startMinigame.ts** | POST /game/start | Creates game session, generates server-side puzzle data (for 6 minigames), stores salt for hash verification |
| **completeMinigame.ts** | POST /game/complete | Verifies completion hash + timing, awards 25 XP (atomic ADD with cap condition), updates clan XP, drops chest, records research data |
| **startPractice.ts** | POST /game/startPractice | Starts a practice session (no XP, no location required) |
| **checkin.ts** | POST /game/checkin | Records game-related check-in data |
| **submitLeave.ts** | POST /game/session/leave | Records when and why a player leaves a session (dwell time metric) |
| **submitSentiment.ts** | PATCH /game/session/{id}/sentiment | Records post-game space sentiment ("Would you return?") |
| **mosaic/** | — | Sub-directory with mosaic puzzle validation logic |

**Jury interest:** **submitSentiment** is where the core research question lives — after every game, the player answers whether the *space itself* was appealing, isolating spatial sentiment from game enjoyment.

---

### H. Backend — Admin Lambdas (59+ files)

> **Path:** `backend/functions/admin/`
> **Purpose:** Research team dashboard operations — daily config, analytics, exports, season management.

Key files (grouped by function):

| Category | Key Files | Purpose |
|---|---|---|
| **Daily Config** | **setDailyConfig.ts**, **getDailyConfig.ts**, **setQuietMode.ts**, **suggestDailyPool.ts** | Set today's active locations and capturable space |
| **Locations** | **locationsCrud.ts**, **updateLocation.ts**, **createMasterLocation.ts**, **deleteMasterLocation.ts** | CRUD for campus locations with GPS coords |
| **QR Codes** | **generateQR.ts**, **resetQR.ts** | Generate HMAC-signed QR codes for locations |
| **Users** | **getUsers.ts**, **getUserDetail.ts**, **getUserSessions.ts**, **updateUserStatus.ts**, **adjustUserXp.ts** | Player management and debugging |
| **Roster** | **importRoster.ts**, **seedRoster.ts** | Import student roster from CSV |
| **Notifications** | **sendNotification.ts**, **cancelNotification.ts**, **testNotification.ts**, **getNotificationHistory.ts** | Push notification management |
| **Analytics** | **analyticsOverview.ts**, **analyticsEngagement.ts**, **analyticsClans.ts**, **analyticsLocations.ts**, **analyticsMinigames.ts**, **analyticsFreeRoam.ts**, **analyticsClusters.ts**, **analyticsDecay.ts**, **analyticsClusterMigration.ts** | 9 analytics endpoints for research data |
| **Exports** | **exportGameSessions.ts**, **exportCheckins.ts**, **exportPlayerProfiles.ts**, **exportPlayerAssignments.ts**, **exportCaptureHistory.ts**, **exportLocations.ts**, **exportClusterHistory.ts**, + 6 more | 13 CSV export endpoints for thesis data analysis |
| **Clustering** | **triggerClustering.ts**, **importClusters.ts**, **getClusterWeights.ts**, **updateClusterWeights.ts**, **updateUserCluster.ts** | Manage player behavioural clustering |
| **Season** | **seasonReset.ts**, **seasonExport.ts**, **getSeasonStatus.ts**, **saveSeasonSchedule.ts**, **getSeasonSchedule.ts** | Season lifecycle management |
| **Map** | **mapUploadUrl.ts**, **saveMapCalibration.ts**, **deleteOverlays.ts** | Map image upload and GPS calibration |
| **Other** | **hallOfFame.ts**, **importPhase1Data.ts**, **importSpaceMetadata.ts**, **deployAssignments.ts** | Hall of fame, Phase 1 data import, assignment deployment |

**Jury interest:** The 13 export endpoints allow the researcher to extract all game data as CSV for statistical analysis in SPSS/R — this is how the thesis data gets from the game into the dissertation.

---

### I. Backend — DynamoDB Tables (21 total)

> **Defined in:** `backend/template.yaml`
> **All tables:** PAY_PER_REQUEST billing (scales automatically with player count)

| # | Table | Primary Key | Purpose |
|---|---|---|---|
| 1 | **users** | userId | Player profiles, XP, streaks, avatar, clan |
| 2 | **clans** | clanId | 5 clan records with todayXp, seasonXp, capture count |
| 3 | **locations** | locationId | Campus locations with GPS, geofence radius, category |
| 4 | **daily-config** | date | Daily game settings: active locations, target space, QR secret |
| 5 | **player-assignments** | dateUserId | Per-player daily location assignments (composite key: "YYYY-MM-DD#userId") |
| 6 | **game-sessions** | sessionId | Every minigame play: who, where, when, result, dwell time |
| 7 | **player-locks** | dateUserLocation | Location locks after losses (TTL-enabled, 1-hour duration) |
| 8 | **captured-spaces** | spaceId | Territory capture history by season |
| 9 | **asset-catalog** | assetId | Master list of decorative assets |
| 10 | **player-assets** | userAssetId | Assets owned by players (from chest drops) |
| 11 | **space-decorations** | userSpaceId | Placed decorations on captured territories |
| 12 | **map-calibration** | calibrationId | GPS-to-pixel affine transform parameters |
| 13 | **admin-notifications** | notificationId | Push notification history |
| 14 | **ws-connections** | connectionId | Active WebSocket connections (TTL-enabled) |
| 15 | **roster** | email | Pre-imported student roster for registration validation |
| 16 | **checkins** | checkInId | Free-roam check-in data (Phase 1 + Phase 2 baseline) |
| 17 | **admin-audit** | auditId | Admin action audit trail |
| 18 | **location-master-config** | locationId | Master location metadata (category, classification) |
| 19 | **cluster-weight-config** | configId | Weights for assignment algorithm tuning |
| 20 | **clustering-runs** | date | Daily clustering run results (TTL-enabled) |
| 21 | **cluster-history** | userId + date (SK) | Per-player cluster assignment over time |

> ⚠️ CLAUDE.md references 19 tables. The actual count is **21** — the 2 additional tables are **cluster-history** and **roster** (per CODEBASE_TRUTH.md Section 3).

**Jury interest:** Tables 16–21 exist purely for research — they track free-roam behaviour, admin actions, and the clustering pipeline that makes assignment adaptive. The game tables (1–15) run the game; the research tables (16–21) run the thesis.

---

### J. Admin Dashboard — Pages (15 pages)

> **Path:** `admin/src/pages/`
> **Stack:** React 18 + Vite + Tailwind CSS + TanStack Query

| File | Page | Purpose |
|---|---|---|
| **LoginPage.tsx** | Login | Admin Google OAuth login |
| **DashboardPage.tsx** | Dashboard | Overview stats: DAU, active games, clan standings |
| **DailyConfigPage.tsx** | Daily Config | Set today's active locations, target space, quiet mode |
| **LocationsPage.tsx** | Locations | CRUD for campus locations (GPS, category, geofence, notes) |
| **MapCalibrationPage.tsx** | Map Calibration | Upload campus map image + set GPS calibration points |
| **QRGeneratorPage.tsx** | QR Generator | Generate printable QR codes for locations |
| **RosterPage.tsx** | Roster | Import/manage student roster CSV |
| **UsersPage.tsx** | Users | Player list with status, clan, XP, session history |
| **NotificationsPage.tsx** | Notifications | Send and schedule push notifications |
| **AnalyticsPage.tsx** | Analytics | Research analytics dashboard (9 sub-views) |
| **CaptureHistoryPage.tsx** | Capture History | Daily territory capture log |
| **ClusterConfigPage.tsx** | Cluster Config | View/edit clustering weights and player segments |
| **ExportsPage.tsx** | Exports | Download research data as CSV (13 export types) |
| **SeasonPage.tsx** | Season | Season schedule, reset, export |
| **Phase1ImportPage.tsx** | Phase 1 Import | Import "Whatcha Doin'" baseline data |

**Jury interest:** The admin dashboard is the **research control panel** — it's where the researcher configures each day's experiment (which locations to activate, which space to make capturable) and extracts data for analysis. It's not a typical "admin panel" — it's a research instrument interface.

---

### K. Backend — Shared Utilities (27+ .ts files)

> **Path:** `backend/shared/`
> **Purpose:** Common logic used across all Lambda functions.

| File | Key Exports | Purpose |
|---|---|---|
| **db.ts** | tableName, getItem, putItem, updateItem, queryItems, scanItems | DynamoDB operations wrapper (constructs table names from stage) |
| **auth.ts** | verifyToken, extractUserId | Firebase token verification for API auth |
| **firebase.ts** | firebaseAdmin | Firebase Admin SDK initialisation |
| **hmac.ts** | generateHmac, verifyHmac, generateCompletionHash | QR code HMAC signing + completion hash verification (anti-cheat) |
| **types.ts** | User, Clan, Location, GameSession, etc. | All TypeScript type definitions |
| **schemas.ts** | scanQRSchema, completeMinigameSchema, etc. | Zod validation schemas for all API inputs |
| **response.ts** | success, error, ErrorCode | Standardised API response helpers |
| **time.ts** | getISTDate, getISTTimestamp, isGameHours | IST timezone helpers (date-fns-tz with "Asia/Kolkata") |
| **geo.ts** | haversineDistance | GPS distance calculation (Haversine formula) |
| **affineTransform.ts** | computeAffineParams, transformPoint | Server-side affine transform (least-squares 6×6 matrix) |
| **notifications.ts** | sendPushNotification, sendMulticast | FCM push via firebase-admin SDK |
| **constants.ts** | LOCK_DURATION_MS, ADJACENCY_EXCLUSION_RADIUS_METERS, rotation modifiers | Game-wide constants |
| **generatePlayerAssignment.ts** | generateAssignment | Core assignment algorithm: cluster-aware, weighted, rotation-history-based |
| **locationAssignment.ts** | — | Location pool filtering and selection logic |
| **weightedAssignment.ts** | — | Weighted random selection with rotation/adjacency modifiers |
| **clustering.ts** | — | K-means clustering implementation |
| **clusteringPipeline.ts** | — | End-to-end clustering orchestration |
| **clusterFeatures.ts** | — | Feature extraction for clustering (14 behavioural features) |
| **sessionClassification.ts** | — | Classifies game sessions for analytics |
| **clanLabels.ts** | — | Clan display names and colour mappings |
| **quietMode.ts** | — | Quiet mode (disable gameplay for a day) logic |
| **minigames.ts** | MINIGAME_META, MINIGAME_POOL | Minigame registry and pool configuration |

#### Server-Side Puzzle Generators (`backend/shared/minigames/`):

| File | Purpose |
|---|---|
| **bloomSequenceGenerator.ts** | Generates pattern-completion puzzles |
| **groveEquationsGenerator.ts** | Generates arithmetic/algebra puzzles |
| **pathWeaverGenerator.ts** | Generates nonogram grids |
| **pipsGenerator.ts** | Generates lights-out puzzle boards |
| **potionLogicGenerator.ts** | Generates logic grid puzzles |

**Jury interest:** Server-side puzzle generation means students cannot predict or pre-solve puzzles — the server creates a unique puzzle per session and validates the solution. This ensures the student was actually *present and engaged*, not just scanning and walking away.

---

## SECTION 4 — KEY ALGORITHMS

### 1. GPS ↔ Pixel Affine Transform

**Plain English:** We take 3 or more real GPS readings at known points on the campus map (e.g., "the library entrance is at this latitude/longitude AND at this pixel position on the map image"). From these paired points, we compute a mathematical formula that can convert any GPS coordinate to the correct pixel on the map, and vice versa. It's the same principle as georeferencing a site plan in GIS software.

**File:** **mobile/src/utils/affineTransform.ts** — functions `gpsToPixel()`, `pixelToGps()`, `computeAffineParams()`
**Also:** **backend/shared/affineTransform.ts** (server-side, used during map calibration)

**Architectural relevance:** This is the digital equivalent of placing a tracing paper site plan over a satellite image — the affine transform is how the virtual game layer aligns precisely with the physical campus.

---

### 2. HMAC QR Validation

**Plain English:** Each QR code contains the location ID plus a cryptographic signature. When a student scans a QR code, the server regenerates the signature using a secret key and checks if it matches. If someone photographs a QR and tries to modify it, or creates a fake QR code, the signatures won't match and the scan is rejected. The QR must be physically present at the location — you can't forge it.

**File:** **backend/shared/hmac.ts** — functions `generateHmac()`, `verifyHmac()`
**Called from:** **backend/functions/game/scanQR.ts** (step 1 of the 7-step validation)

**Architectural relevance:** This ensures that the spatial data is honest — a game session at "the north courtyard" means the student was actually at the north courtyard holding their phone up to that physical QR code.

---

### 3. Daily Location Assignment

**Plain English:** Every morning at 8 AM, each player gets a personalised set of 3–5 locations to visit that day. The algorithm considers which locations the player visited recently (to avoid repetition), which behavioural cluster they belong to (to nudge them toward new spaces), location category balance (mix of courtyards, corridors, gardens), and adjacency rules (don't assign two locations right next to each other). This means different students get different assignments — there's no single "today's location" that everyone crowds.

**Files:**
- **backend/functions/scheduled/dailyReset.ts** — orchestrates the daily assignment generation
- **backend/shared/generatePlayerAssignment.ts** — core assignment algorithm
- **backend/shared/weightedAssignment.ts** — weighted selection with rotation modifiers
- **backend/functions/game/scanQR.ts** — `SOLO_SET_SIZE=6`, `COOP_SET_SIZE=3` (minigames offered per scan)

**Architectural relevance:** This is the spatial distribution engine. Instead of all 500 students going to the same place, the algorithm spreads them across campus — including into Dead Zones that they'd normally avoid.

---

### 4. Daily Clustering Pipeline

**Plain English:** Every morning at 7:45 AM (15 minutes before reset), the system analyses the last 3 days of player behaviour across 14 features — things like how many unique locations they visited, their average dwell time, whether they explored or stuck to familiar spots, and their game performance. It groups all players into 5 behavioural clusters: *Campus Nomads* (explore widely), *Hidden Gem Seekers* (prefer quiet spots), *Social Drifters* (follow friends), *Forced Occupants* (visit only assigned locations), and *Disengaged Visitors* (minimal engagement). These clusters feed into the next day's assignment algorithm.

**File:** **backend/functions/scheduled/dailyClustering.ts**
**Supporting:** **backend/shared/clusterFeatures.ts** (14 features), **backend/shared/clustering.ts** (k-means, k=5), **backend/shared/clusteringPipeline.ts** (orchestration)

**Architectural relevance:** This is the adaptive research intelligence. The system learns which students are already exploring (and leaves them alone) versus which students are stuck in patterns (and gently redirects them). It's a feedback loop between observed spatial behaviour and designed spatial intervention.

---

### 5. 6 PM Territory Scoring

**Plain English:** At 6 PM every day, the server looks at how much total XP each clan earned that day. The clan with the most XP captures today's target space on the campus map. If two clans are tied, the one that reached that XP total first wins (we track the timestamp of each XP change). The captured territory then appears on every player's map in that clan's colour.

**File:** **backend/functions/scheduled/dailyScoring.ts**
**Key logic:** Compares `clan.todayXp` across all 5 clans; tiebreaker uses `todayXpTimestamp` (earlier wins). Season hardcoded as `'1'`.

**Architectural relevance:** This is the daily payoff — the physical campus map changes colour based on which student community was most active that day. Territory capture makes spatial activation visible and competitive.

---

### 6. Anti-Cheat — Completion Hash

**Plain English:** When a player starts a minigame, the server generates a secret salt. When the player finishes, the app computes a hash (a mathematical fingerprint) of the session ID, result, and time taken, using a known salt. The server checks this hash matches what it expects. This prevents someone from sending a fake "I won" message without actually playing the game. The system uses a dual-salt approach — checking the client-generated salt first, then the server-stored salt as fallback.

**File:** **backend/functions/game/completeMinigame.ts** — hash verification section
**Supporting:** **backend/shared/hmac.ts** — `generateCompletionHash()`
**Mobile:** **mobile/src/utils/hmac.ts** — client-side hash generation

> ⚠️ Confirmed clean per CODEBASE_TRUTH.md Issue 5 — both mobile crypto-js and Node crypto produce identical outputs.

**Architectural relevance:** This ensures research data integrity — every recorded "game win" represents a real cognitive engagement event, not a spoofed data point.

---

### 7. XP Cap Atomicity

**Plain English:** Each player can earn at most 100 XP per day (4 wins × 25 XP). The database enforces this with an atomic operation — it says "add 25 to this player's XP, but only if their current XP is 75 or less." If two wins arrive at the exact same millisecond, one succeeds and one is rejected. This prevents any player from exceeding the cap, even under race conditions. The win is still counted for stats even if XP is denied.

**File:** **backend/functions/game/completeMinigame.ts** — function `awardXpAndStreak()`
**Mechanism:** DynamoDB conditional ADD with `todayXp <= :maxXp` (where maxXp = 75)

> ⚠️ Confirmed clean per CODEBASE_TRUTH.md Issue 3 — atomic operation prevents exceeding 100 XP cap.

**Architectural relevance:** The 100 XP cap is a deliberate design choice — it means a student only needs to visit 4 locations to "max out" for the day, keeping the time commitment reasonable (roughly 30–40 minutes of campus walking). More visits are allowed but for practice only, not competitive advantage.

---

## SECTION 5 — LIVE DEMO SCRIPT

### Step 1: Admin — Set Today's Locations

**Say:** "Each morning, the research team configures which campus locations are active and which space is up for capture today."
**Navigate:** Admin dashboard → **DailyConfigPage**
**Show:** The form where active locations are selected from the location pool, the target space is named, and the day is set to "active" (or "quiet" for off-days).

### Step 2: Admin — Show Location List

**Say:** "Here are all the mapped campus locations — each has GPS coordinates, a geofence radius, a category like courtyard or corridor, and notes from our Phase 1 observations."
**Navigate:** Admin dashboard → **LocationsPage**
**Show:** Data table with location names, GPS coords, categories, active status. Point out a known Dead Zone in the list.

### Step 3: Admin — Generate QR Code

**Say:** "For each location, we generate a cryptographically signed QR code. This is what gets printed and physically placed at the campus location."
**Navigate:** Admin dashboard → **QRGeneratorPage**
**Show:** Select a location, generate QR, show the resulting code. Explain that the signature prevents forgery.

### Step 4: Mobile — Campus Map

**Say:** "This is the main game interface — a pixel-art rendering of the TCE campus. The coloured territories show which clans have captured which spaces. The pins show today's active locations."
**Navigate:** Mobile app → **MainMapScreen**
**Show:** Campus map with territory overlays, location pins, player position dot, clan XP bar at the top.

### Step 5: Mobile — QR Scanner

**Say:** "When a student walks to one of their assigned locations, they open the scanner and hold it up to the QR code. The server validates the code is genuine and checks the student's assignment."
**Navigate:** Tap a location pin or scanner icon → **QRScannerScreen**
**Show:** Camera viewfinder with scan target area. If demoing co-op, show the partner code entry field.

### Step 6: Mobile — Minigame Selection

**Say:** "After a valid scan, the server offers a selection of minigames suited to this location's difficulty. The student picks one to play."
**Navigate:** After successful scan → **MinigameSelectScreen**
**Show:** Grid of available minigames with difficulty indicators and time limits. **Recommended for demo: Stone Pairs (Flip & Match)** — it's visually clear, easy to explain, and fully implemented.

### Step 7: Mobile — Play the Minigame

**Say:** "Each minigame is a short puzzle — this one is a memory matching game with a cottagecore stone theme. The student has 90 seconds to complete it."
**Navigate:** Select Stone Pairs → **MinigamePlayScreen**
**Show:** Play the game briefly. Show the timer bar, the tile-flip animation, the match feedback.

### Step 8: Mobile — Result Screen

**Say:** "On winning, the student earns 25 XP for their clan. The XP updates in real-time on everyone's scoreboard. They may also receive a decorative asset from a chest drop."
**Navigate:** Complete the game → **ResultScreen**
**Show:** Win animation, +25 XP display, chest drop (if triggered), clan XP update.

### Step 9: Admin — Analytics Dashboard

**Say:** "All gameplay data flows into the analytics dashboard — we can see location visit frequency, dwell times, free-roam vs. game-driven visits, and cluster migration over time. This is where Phase 1 and Phase 2 data meet for comparison."
**Navigate:** Admin dashboard → **AnalyticsPage**
**Show:** Whatever analytics views are populated. Explain the 9 sub-views: overview, engagement, clans, locations, minigames, free-roam, clusters, decay, cluster-migration. Note that some views may show placeholder data if the season hasn't started yet.

### Step 10: Admin — Clan Scores & Capture History

**Say:** "At the end of each day, we can see which clan won, what the final scores were, and the full capture history across the season — this is the spatial activation timeline."
**Navigate:** Admin dashboard → **CaptureHistoryPage** (or DashboardPage clan scores section)
**Show:** Capture history table showing dates, winning clans, target spaces, and XP totals.

---

## SECTION 6 — ANTICIPATED JURY QUESTIONS AND ANSWERS

### Q1: Why a game and not a survey or passive tracking tool?

Surveys capture what students *say* they do; passive tracking captures where they *are* but not why. A game creates a reason to go somewhere new — it turns spatial exploration into a voluntary, social, rewarding activity. The game generates both behavioural data (where students go, how long they stay) and attitudinal data (the post-game sentiment question). Passive tracking alone cannot create the *intervention* — it can only observe existing patterns.

### Q2: How does this differ from Pokémon GO or Google Maps gamification?

Pokémon GO distributes virtual content across public spaces at city scale with no control over which spaces get activated. GroveWars targets a specific bounded campus, activates *deliberately chosen* underutilised spaces, and uses an adaptive assignment algorithm that personalises which locations each student visits. The research question isn't "can games get people to walk around" — it's "can a game redirect spatial behaviour toward specific architectural Dead Zones."

### Q3: Are you tracking students without consent?

No. Students opt in by downloading the app and accepting terms and conditions (enforced by **TermsAndConditionsScreen** before any gameplay). GPS is used only during active gameplay for map display — it is not stored or tracked when the app is backgrounded. The free-roam check-ins are self-reported. The roster import requires students to be pre-registered by the institution. All data exports are anonymisable.

### Q4: How do you measure whether Dead Zones were actually activated?

Three metrics compared between Phase 1 (baseline) and Phase 2 (gameplay): (1) **Visit frequency** — did more students visit the space? (2) **Dwell time** — did they stay longer than the walk-through baseline? (3) **Return intent** — the post-game question "Would you return without the game?" This third metric is the most important, as it measures whether the game created a lasting spatial connection, not just a transactional visit.

### Q5: What happens after the game season ends — is the effect permanent?

That's the core research question. The 9-week season creates repeated exposure to spaces students previously avoided. Behavioural psychology suggests that positive repeated experiences can shift spatial habits. Phase 3 of the research (post-gameplay audit) would re-run the Phase 1 baseline study to check if visit patterns persisted. The hypothesis is partial persistence — some spaces will retain new visitors, others won't, and the differentiator will be the space's inherent qualities revealed through the sentiment data.

### Q6: How is clan assignment done — is it random or roster-based?

Players choose their own clan during onboarding (via **CharacterCreationScreen**). The choice is permanent for the season — a backend guard prevents switching after initial selection. There are 5 clans (Ember, Tide, Bloom, Gale, Hearth). Self-selection was chosen over random assignment to leverage existing social groups, which increases engagement and makes the clan identity emotionally meaningful.

### Q7: What if a student cheats by sending a fake GPS location?

> ⚠️ Honest answer: Geofence validation (checking GPS distance to location) is documented in the design but **not currently implemented** in the scan flow (per CODEBASE_TRUTH.md Section 11). The primary anti-cheat is **physical QR presence** — the student must physically see and scan the QR code at the location, which is validated via HMAC cryptographic signature. GPS is used for map display only, not access control. A student could spoof GPS to fake their map dot, but they still need to physically be at the QR code to play.

### Q8: How many locations does TCE have mapped, and why those specific ones?

The number of mapped locations is configured in the admin dashboard's **LocationsPage** and can be viewed in the locations table. Location selection was informed by Phase 1 data — spaces were chosen across a spectrum from heavily-used (positive control) to completely unused (Dead Zones), with deliberate inclusion of architecturally interesting but socially inactive spaces. The mix ensures the game has both "easy" locations students already visit and "discovery" locations that test the activation hypothesis.

### Q9: Does the cottagecore aesthetic have a design rationale?

Yes. A cottagecore/whimsical fantasy theme was chosen because it creates an emotional contrast with the institutional campus environment. It makes mundane spaces feel enchanted — a bare corridor becomes a "vine trail," a forgotten garden becomes a "grove." The aesthetic reframes the student's perception of the space through narrative overlay. Additionally, the non-competitive, pastoral tone of cottagecore reduces aggressive competitive behaviour between clans.

### Q10: What is the fallback if GPS accuracy is poor on campus?

GPS accuracy varies across campus (building shadows, covered walkways). The system handles this in three ways: (1) GPS is used for the map display dot, not for access control — even if the dot drifts, the QR scan still works. (2) The affine transform is calibrated using real on-site GPS readings, so the calibration accounts for typical drift in that environment. (3) The map pin positions are GPS-transformed at the server using the same calibration, so relative accuracy between the player dot and the pin is consistent even if absolute accuracy fluctuates.

### Q11: How is the admin dashboard used day-to-day by the research team?

Every game morning: (1) Check yesterday's analytics on **AnalyticsPage**. (2) Set today's active locations and target space on **DailyConfigPage**. (3) Optionally review cluster data on **ClusterConfigPage** to see how player behaviour is shifting. (4) Monitor live clan scores during the day on **DashboardPage**. (5) After 6 PM scoring, check capture results on **CaptureHistoryPage**. Weekly: export research data via **ExportsPage** for analysis.

### Q12: What would Phase 3 of the research look like?

Phase 3 is the post-gameplay spatial audit. After the 9-week game season ends, the Phase 1 "Whatcha Doin'" free-roam study would be repeated with the same methodology — observing and logging spatial behaviour without any game incentive. Comparing Phase 3 (post-game baseline) against Phase 1 (pre-game baseline) reveals which spatial behaviour changes persisted after the game intervention was removed. This is the longitudinal evidence for or against the Dead Zone activation hypothesis.

---

## SECTION 7 — QUICK GLOSSARY

| Term | Plain English Definition |
|---|---|
| **Dead Zone** | A campus space that is architecturally functional but socially inactive — students walk through it but never voluntarily stop or gather. |
| **Daily Reset** | The 8:00 AM automated process that clears yesterday's scores, generates fresh location assignments for every player, and starts a new game day. |
| **XP (Experience Points)** | Points earned by winning minigames — 25 per win, max 100 per day — that contribute to your clan's daily score. |
| **Clan** | One of five teams (Ember, Tide, Bloom, Gale, Hearth) that students permanently join; all gameplay XP contributes to the clan's collective score. |
| **Territory Capture** | At 6 PM daily, the clan with the most XP "captures" a designated campus space — it appears in their colour on every player's map. |
| **Geofence** | A virtual boundary around a real-world location (typically 15 metres radius) used to verify that a player is physically near the location. |
| **QR Code (in this context)** | A printed code physically placed at each campus location; scanning it proves the student is physically present and triggers gameplay. |
| **Affine Transform** | A mathematical formula that converts GPS coordinates (latitude/longitude) into pixel positions on the campus map image, and vice versa. |
| **Lambda Function** | A small piece of server code that runs on-demand in the cloud — each game action (scan, play, score) triggers its own Lambda. |
| **DynamoDB** | Amazon's cloud database service — stores all player data, game sessions, scores, and research data in 21 tables. |
| **WebSocket** | A persistent connection between the app and server that pushes real-time score updates to all players without them needing to refresh. |
| **HMAC** | A cryptographic signature technique used to ensure QR codes are genuine and game completion reports haven't been forged. |
| **Daily Clustering** | An automated morning analysis that groups players into 5 behavioural profiles based on how they've been using the campus, which then influences their next day's assignments. |
| **Co-op Mode** | A two-player game mode where both players share one phone at a location, solve a puzzle together, and both earn rewards — encouraging social interaction at the space. |
| **FCM (Push Notification)** | Firebase Cloud Messaging — the technology that sends alerts to students' phones (e.g., "Morning break! Time to visit your locations" or "Ember captured the Library Garden!"). |

---

## SECTION 8 — KNOWN DIVERGENCES (honest audit summary)

> Source: CODEBASE_TRUTH.md Section 11 & 12, audited 2026-03-25

| Divergence | Documented Behaviour | Actual Code Behaviour | Status |
|---|---|---|---|
| **Geofence validation** | QR validation step 4 checks GPS distance to location | Not implemented — scanQR accepts GPS but never checks distance | **Deferred** (intentional per researcher) |
| **5-minute cooldown** | 5 minutes required between minigame completions | Not implemented anywhere in code | **Deferred** (intentional per researcher) |
| **Location lock duration** | Locked until next 8:00 AM daily reset | 1-hour lock (`LOCK_DURATION_MS = 3,600,000`) with DynamoDB TTL | **Intentional** (shorter lock is better UX) |
| **Clan switching guard** | Clan choice is permanent for the season | Was allowing unlimited switching — no condition check | **Fixed** (setClan.ts now has `attribute_not_exists(clan)` guard) |
| **Clan seasonXp** | Should accumulate across the season | Was never being incremented in clan record | **Fixed** (completeMinigame.ts now adds `seasonXp :xp` for both player and co-op partner) |
| **4 minigames without client code** | grove-words, number-grove, cipher-stones, vine-trail listed in pool | Flagged as having no client Game/Logic files at audit time; files have since been observed in repo | **Verify** (test before demoing) |
| **Chest drop rate** | CLAUDE.md says "15% base × chestDropModifier" | Code: 100% drop on XP-earning wins, weighted by minigame difficulty | **Intentional** (design change) |
| **DynamoDB table count** | CLAUDE.md says 19 tables | template.yaml defines 21 tables (adds cluster-history, correct roster count) | **Documentation lag** |
| **Notifications** | CLAUDE.md says "FCM via raw HTTPS" | Code uses firebase-admin SDK (`messaging.sendEachForMulticast`) | **Documentation lag** |
| **Admin auth** | CLAUDE.md says "Cognito" | Code uses Google OAuth for admin, Firebase for mobile | **Documentation lag** |

### What NOT to claim in presentation:

- Do **not** claim geofence validation is enforced — it is not. Say "QR physical presence is the primary spatial verification."
- Do **not** claim there is a cooldown between games — there is not.
- Do **not** demo grove-words, number-grove, cipher-stones, or vine-trail without testing them first.
- Do **not** cite "19 tables" — the correct count is **21**.

---

*End of presentation reference. Total system: 19 mobile screens, 15 solo + 6 co-op minigames, 21 DynamoDB tables, 10 scheduled jobs, 70+ API endpoints, 15 admin pages, 7 Zustand stores — all built as a research instrument for campus spatial activation.*
