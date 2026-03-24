# CODEBASE_TRUTH.md — GroveWars Source of Truth

Generated: 2026-03-25 by full-repo audit.
**This document describes what the code actually does, not what the design docs say.**

---

## 1. Tech Stack Versions (from package.json)

### Backend (`backend/`)
| Package | Version |
|---|---|
| TypeScript | ^5.4.3 |
| Node Runtime | nodejs20.x (SAM Globals) |
| @aws-sdk/* | ^3.540.0 |
| firebase-admin | ^13.7.0 |
| google-auth-library | ^10.6.1 |
| date-fns | ^3.6.0 |
| date-fns-tz | ^3.1.0 |
| zod | ^3.22.5 |
| jsonwebtoken | ^9.0.2 |
| jwks-rsa | ^3.1.0 |
| uuid | ^9.0.1 |
| qrcode | ^1.5.3 |
| pdfkit | ^0.17.2 |
| esbuild | ^0.27.3 (build) |
| jest / ts-jest | ^29.7.0 / ^29.1.2 |

### Mobile (`mobile/`)
| Package | Version |
|---|---|
| React Native | 0.73.11 |
| React | 18.2.0 |
| TypeScript | 5.0.4 |
| zustand | ^5.0.11 |
| zod | ^4.3.6 |
| date-fns | ^4.1.0 |
| date-fns-tz | ^3.2.0 |
| @react-navigation/native | ^6.1.18 |
| @shopify/react-native-skia | ^0.1.240 |
| react-native-vision-camera | ^3.9.2 |
| react-native-reanimated | ^3.6.3 |
| crypto-js | ^4.2.0 |
| amazon-cognito-identity-js | ^6.3.16 |
| @react-native-firebase/* | ^23.8.6 |
| @react-native-google-signin/google-signin | ^16.1.2 |

### Admin (`admin/`)
| Package | Version |
|---|---|
| React | ^18.3.1 |
| TypeScript | ^5.9.3 |
| Vite | ^7.3.1 |
| Tailwind CSS | ^4.2.1 |
| zustand | ^5.0.11 |
| zod | ^4.3.6 |
| @tanstack/react-query | ^5.90.21 |
| react-router-dom | ^6.30.3 |
| recharts | ^3.8.0 |
| vitest | ^4.0.18 |

**Note:** Mobile uses zod v4 while backend uses zod v3. These have different APIs.

---

## 2. Repo Structure

```
cottagecore_territory/
├── CLAUDE.md                    # Session context (checked in)
├── DESIGN_DOCUMENT.md           # GDD v2.0 (partially outdated)
├── docs/
│   ├── CLAUDE.md                # Legacy context (outdated)
│   ├── GroveWars_TechSpec.md    # Tech spec (outdated)
│   ├── GroveWars_AssetSpec.md   # Asset spec
│   ├── GroveWars_Complete_Guide.md
│   └── GroveWars_GDD_v1.1.md
├── backend/
│   ├── template.yaml            # SAM template (all AWS resources)
│   ├── samconfig.toml           # Deploy configs (dev/prod)
│   ├── package.json
│   ├── tsconfig.json            # strict, ES2020, commonjs, @shared/* alias
│   ├── jest.config.ts
│   ├── shared/                  # 27 .ts files (types, db, auth, hmac, etc.)
│   │   └── minigames/           # Server-side puzzle generators (5 files)
│   ├── functions/
│   │   ├── auth/                # 3 files (googleLogin, adminGoogleLogin, lambdaAuthorizer)
│   │   ├── player/              # 10 files
│   │   ├── game/                # 9 files (incl. mosaic/ sub-dir)
│   │   ├── scores/              # 3 files
│   │   ├── spaces/              # 3 files
│   │   ├── admin/               # 40+ files
│   │   ├── scheduled/           # 8 files
│   │   ├── websocket/           # broadcast.ts
│   │   ├── debug/               # resetPlayerState.ts
│   │   └── *.ts                 # 6 root files (getMapConfig, getTodayLocations, etc.)
│   ├── scripts/                 # Seed scripts
│   └── __tests__/               # 20 test files
├── mobile/
│   ├── package.json
│   ├── tsconfig.json            # extends @react-native/typescript-config, @/ alias
│   ├── babel.config.js          # module-resolver + reanimated plugin
│   ├── jest.config.js
│   └── src/
│       ├── constants/           # 7 files (api, colors, config, assets, minigames, fonts, playerAssets)
│       ├── types/               # 2 files (index.ts, minigame.ts)
│       ├── store/               # 7 Zustand stores
│       ├── navigation/          # RootNavigator.tsx, MainStack.tsx
│       ├── screens/             # 18 screen files
│       ├── components/          # ~37 files (common, tutorial, map, minigames, profile)
│       ├── minigames/           # 11 implemented minigame dirs (30 files)
│       ├── hooks/               # 10 hook files
│       ├── utils/               # 14 utility files
│       ├── api/                 # 8 API client files
│       └── assets/              # Images, fonts
└── admin/
    ├── package.json
    ├── tsconfig.json            # ES2020, bundler resolution, @/ alias
    ├── vite.config.ts
    └── src/
        ├── api/                 # 12 files
        ├── pages/               # 15 page components
        ├── components/          # 15 components
        ├── store/               # useAuthStore.ts
        ├── types/               # index.ts
        ├── utils/               # 2 files
        ├── constants/           # 3 files (api, map, clans)
        ├── App.tsx, main.tsx
        └── test/                # 4 test files
```

---

## 3. AWS Resources (from template.yaml)

### Parameters
- `Stage`: dev | staging | prod (default: dev)
- `AllowedEmailDomain`: email domain whitelist
- `HmacSecret`: QR code HMAC secret (NoEcho)

### API Gateways
- **REST API**: `grovewars-${Stage}-api` with Lambda Authorizer (Firebase token, 300s cache)
- **WebSocket API**: `grovewars-${Stage}-ws` (no auth on routes)

### S3
- `grovewars-${Stage}-assets` — versioned, CORS for GET/PUT, public GetObject on `maps/*`

### DynamoDB Tables (21 total, all PAY_PER_REQUEST)

| # | Table | PK | SK | GSIs | TTL |
|---|---|---|---|---|---|
| 1 | users | userId | — | ClanIndex(clan+todayXp), EmailIndex(email), PlayerCodeIndex(playerCode) | — |
| 2 | clans | clanId | — | — | — |
| 3 | locations | locationId | — | — | — |
| 4 | daily-config | date | — | — | — |
| 5 | player-assignments | dateUserId | — | — | — |
| 6 | game-sessions | sessionId | — | UserDateIndex(userId+date) | — |
| 7 | player-locks | dateUserLocation | — | — | ttl |
| 8 | captured-spaces | spaceId | — | SeasonIndex(season+dateCaptured) | — |
| 9 | asset-catalog | assetId | — | — | — |
| 10 | player-assets | userAssetId | — | UserAssetsIndex(userId+obtainedAt) | — |
| 11 | space-decorations | userSpaceId | — | — | — |
| 12 | map-calibration | calibrationId | — | — | — |
| 13 | admin-notifications | notificationId | — | — | — |
| 14 | ws-connections | connectionId | — | — | ttl |
| 15 | roster | email | — | — | — |
| 16 | checkins | checkInId | — | UserDateIndex(userId+date), DateIndex(date+timestamp) | — |
| 17 | admin-audit | auditId | — | — | — |
| 18 | location-master-config | locationId | — | — | — |
| 19 | cluster-weight-config | configId | — | — | — |
| 20 | clustering-runs | date | — | — | expiresAt |
| 21 | cluster-history | userId | date | — | — |

### Scheduled Events (EventBridge Rules)

| Schedule | IST Time | Lambda | Description |
|---|---|---|---|
| cron(15 2 * * ? *) | 7:45 AM | dailyClustering | K-means player clustering |
| cron(30 2 * * ? *) | 8:00 AM | dailyReset | Reset XP, locks, streaks; generate assignments |
| cron(30 12 * * ? *) | 6:00 PM | dailyScoring | Determine daily winner, capture space |
| cron(30 18 * * ? *) | midnight | assetExpiry | Expire unplaced assets |
| cron(30 15 * * ? *) | 9:00 PM | assetExpiryWarning | Warn about expiring assets |
| cron(10 5 * * ? *) | 10:40 AM | eventWindowMorning | Morning break notification |
| cron(10 7 * * ? *) | 12:40 PM | eventWindowLunch | Lunch break notification |
| cron(30 11 * * ? *) | 5:00 PM | eventWindowFinal | Final push notification |
| cron(0 13 * * ? *) | 6:30 PM | computeDwellFallbacks | Compute dwell fallbacks |
| cron(0/5 * * * ? *) | every 5min | processScheduledNotifications | Process notification queue |

---

## 4. Environment Variables

All Lambdas receive via SAM Globals:
```
STAGE, ALLOWED_EMAIL_DOMAIN, HMAC_SECRET, AWS_REGION_NAME,
USERS_TABLE, CLANS_TABLE, LOCATIONS_TABLE, DAILY_CONFIG_TABLE,
PLAYER_ASSIGNMENTS_TABLE, GAME_SESSIONS_TABLE, PLAYER_LOCKS_TABLE,
CAPTURED_SPACES_TABLE, ASSET_CATALOG_TABLE, PLAYER_ASSETS_TABLE,
SPACE_DECORATIONS_TABLE, MAP_CALIBRATION_TABLE, ADMIN_NOTIFICATIONS_TABLE,
WS_CONNECTIONS_TABLE, ASSETS_BUCKET, CHECKINS_TABLE, ADMIN_AUDIT_TABLE,
LOCATION_MASTER_CONFIG_TABLE, CLUSTER_WEIGHT_CONFIG_TABLE,
CLUSTERING_RUNS_TABLE, CLUSTER_HISTORY_TABLE
```

Additional per-function:
- `WEBSOCKET_API_ENDPOINT` — completeMinigame, dailyReset, dailyScoring, broadcast functions

**Note:** The `*_TABLE` env vars are set but **never used by code**. All Lambda functions use `db.ts`'s `tableName(shortName)` which constructs `grovewars-${STAGE}-${name}` from `process.env.STAGE`. The env vars are redundant.

---

## 5. API Endpoints

### Public (no auth)
| Method | Path | Handler |
|---|---|---|
| POST | /auth/google-login | googleLogin |
| POST | /admin/auth/google-login | adminGoogleLogin |

### Player (Firebase auth)
| Method | Path | Handler |
|---|---|---|
| GET | /player/profile | getProfile |
| PUT | /player/avatar | updateAvatar |
| GET | /player/assets | getAssets |
| GET | /player/stats | getStats |
| PUT | /player/clan | setClan |
| PUT | /player/fcm-token | updateFcmToken |
| PUT | /player/tutorialDone | updateTutorialDone |
| PUT | /player/acceptTc | acceptTc |
| GET | /player/journal | getJournal |
| GET | /player/search | searchPlayer |

### Game (Firebase auth)
| Method | Path | Handler |
|---|---|---|
| POST | /game/scan | scanQR |
| POST | /game/start | startMinigame |
| POST | /game/complete | completeMinigame |
| POST | /game/startPractice | startPractice |
| POST | /game/session/leave | submitLeave |
| PATCH | /game/session/{sessionId}/sentiment | submitSentiment |
| POST | /game/checkin | checkin |
| POST | /checkin/submit | submitCheckIn (free-roam) |

### Map/Locations/Daily (Firebase auth)
| Method | Path | Handler |
|---|---|---|
| GET | /map/config | getMapConfig |
| GET | /locations/today | getTodayLocations |
| GET | /daily/info | getDailyInfo |

### Scores/Spaces (Firebase auth)
| Method | Path | Handler |
|---|---|---|
| GET | /scores/clans | getClanScores |
| GET | /scores/history | getCaptureHistory |
| GET | /season/summary | getSeasonSummary |
| GET | /spaces/captured | getCapturedSpaces |
| GET | /spaces/{spaceId}/decoration | getDecoration |
| PUT | /spaces/{spaceId}/decoration | saveDecoration |

### Admin (Firebase auth + isAdmin check in handler)
70+ endpoints — CRUD for locations, master config, daily config, users, notifications, QR generation, roster import, season management, analytics (overview, engagement, clans, locations, minigames, free-roam, clusters, decay, cluster-migration), clustering runs, exports (13 export endpoints), hall of fame, and debug tools.

### Debug (dev only)
| Method | Path | Handler |
|---|---|---|
| POST | /debug/reset-player-state | resetPlayerState |
| POST | /admin/debug/trigger-scheduled | triggerScheduled (IsNotProd) |
| GET | /admin/debug/assignment | getPlayerAssignment |

---

## 6. Navigation & Auth Flow

### Cold Launch Flow
```
RootNavigator
  ├── Splash (session restoration from Keychain)
  ├── IF no token → LoginScreen (Google Sign-In → Firebase → backend /auth/google-login)
  ├── IF no TC accepted → TermsAndConditionsScreen
  ├── IF !tutorialDone → TutorialScreen (9 scenes: 6 slides + char creation + map + outro)
  └── MainStack (modal stack)
       ├── MainMapScreen (default)
       ├── ClanScoreboardScreen
       ├── PlayerProfileScreen
       ├── AssetInventoryScreen
       ├── QRScannerScreen
       ├── MinigameSelectScreen
       ├── MinigamePlayScreen
       ├── ResultScreen
       ├── SpaceSentimentScreen
       ├── SpaceDecorationScreen
       ├── CaptureCelebrationScreen
       ├── SettingsScreen
       ├── CharacterCreationScreen
       ├── FreeRoamCheckInScreen
       ├── JournalScreen
       ├── TermsAndConditionsScreen
       └── SeasonSummaryScreen
```

### Auth Details
- Mobile: Google Sign-In → Firebase Auth → backend verifies Firebase ID token
- Admin: Google OAuth (@react-oauth/google) → backend verifies Google ID token against ADMIN_EMAILS hardcoded list
- Lambda Authorizer: tries Firebase first, falls back to Google OAuth; sets `sub`, `email`, `isAdmin` in context
- Token storage: Mobile uses react-native-keychain (service: 'grovewars-auth')
- 401 retry: apiClient auto-refreshes Firebase token on 401, retries once

---

## 7. Screens Detail

| Screen | State Read | API Calls | Navigates To |
|---|---|---|---|
| MainMapScreen | mapStore, gameStore, authStore, clanStore, debugStore | loadMapConfig, loadTodayLocations, loadCapturedSpaces, getDailyInfo | QRScanner, ClanScoreboard, PlayerProfile, AssetInventory, Settings, SpaceDecoration, FreeRoamCheckIn, Journal, CaptureCelebration |
| QRScannerScreen | authStore, gameStore, mapStore | scanQR (with optional coopPartnerId) | MinigameSelect |
| MinigameSelectScreen | gameStore | — | MinigamePlay |
| MinigamePlayScreen | gameStore, authStore | startMinigame or startPractice | Result |
| ResultScreen | gameStore, authStore, clanStore | completeMinigame | SpaceSentiment, MainMap, MinigameSelect |
| SpaceSentimentScreen | — | submitSpaceSentiment | MainMap |
| ClanScoreboardScreen | clanStore, authStore | getClanScores, getCaptureHistory | — |
| PlayerProfileScreen | authStore, gameStore | getStats | CharacterCreation, Settings |
| AssetInventoryScreen | authStore | getAssets | SpaceDecoration |
| SpaceDecorationScreen | authStore, mapStore | getDecoration, saveDecoration | — |
| CaptureCelebrationScreen | clanStore | — | MainMap |
| SettingsScreen | authStore | — | CharacterCreation, TermsAndConditions |
| JournalScreen | authStore | getJournal | — |
| FreeRoamCheckInScreen | authStore, mapStore | submitCheckIn | MainMap |
| SeasonSummaryScreen | authStore | getSeasonSummary | — |
| TutorialScreen | authStore | — | MainStack |
| CharacterCreationScreen | authStore | updateAvatar, setClan | MainMap |

---

## 8. Minigames

### Implemented (11 solo + 6 co-op IDs registered)

| ID | Display Name | Difficulty | Time | Client Logic | Server Validation | Co-op Variant | Tests |
|---|---|---|---|---|---|---|---|
| stone-pairs | Flip & Match | easy | 90s | StonePairsLogic.ts | — | stone-pairs-coop | Yes |
| leaf-sort | Color Sort | easy | 90s | LeafSortLogic.ts | — | — | — |
| bloom-sequence | Spot the Pattern | easy | 60s | BloomSequenceLogic.ts | validateBloomSequenceAnswers | — | Yes |
| firefly-flow | Connect the Dots | easy | 90s | FireflyFlowLogic.ts | — | — | Yes |
| number-grove | Mini Sudoku | easy | 90s | NOT FOUND | — | — | — |
| grove-words | Wordle | medium | 120s | NOT FOUND | — | — | — |
| word-clusters | Word Clusters | medium | 180s | WordClustersLogic.ts | — | word-clusters-coop | Yes |
| cipher-stones | Cipher | medium | 150s | NOT FOUND | — | cipher-stones-coop | — |
| pips | Snuff Out | medium | 75s | PipsLogic.ts (mobile) | pipsGenerator replay | pips-coop | — |
| mosaic | Tile Fit | medium | 120s | MosaicLogic.ts | validateMosaicSolution | — | — |
| potion-logic | Logic Grid | hard | 150s | PotionLogicLogic.ts | validatePotionLogicSubmission | potion-logic-coop | — |
| path-weaver | Nonogram | hard | 180s | PathWeaverLogic.ts | validatePathWeaverSubmission | — | — |
| grove-equations | Number Crunch | hard | 90s | GroveEquationsLogic.ts | validateGroveEquationsSolution | — | — |
| shift-slide | Tile Slide | hard | 120s | ShiftSlideLogic.ts | finalBoard check | — | — |
| vine-trail | Word Hunt | hard | 180s | NOT FOUND | — | vine-trail-coop | — |

**Not implemented (no client Game/Logic files):** number-grove, grove-words, cipher-stones, vine-trail. These are registered in MINIGAME_POOL but have no mobile code. They can still be assigned and started — the MinigamePlayScreen would crash or show a blank screen.

### Server-Side Puzzle Generation
Server generates puzzles for: mosaic, path-weaver, grove-equations, bloom-sequence, pips, potion-logic (via startMinigame). Client puzzles: stone-pairs, leaf-sort, firefly-flow, word-clusters, shift-slide.

---

## 9. Zustand Stores

### useAuthStore (persisted to AsyncStorage)
```ts
{
  user: User | null,
  token: string | null,
  isAuthenticated: boolean,
  isLoading: boolean,
  error: string | null,
  tutorialDone: boolean,
  tcAccepted: boolean,
  hydrated: boolean,
}
```
Actions: googleSignIn, logout, setClan, refreshSession, setTutorialDone, resetTutorial
Persisted: user, token, isAuthenticated, tutorialDone, tcAccepted

### useGameStore (persisted to AsyncStorage)
```ts
{
  todayXp: number,
  currentSessionId: string | null,
  lastScanResult: ScanResult | null,
  captureResult: CaptureResult | null,
  dailyAssignments: string[],
  locationLocks: Record<string, string>,
  xpEarnedLocations: string[],
  celebrationPending: boolean,
  celebrationData: CelebrationData | null,
}
```
Actions: recordWin, recordLoss, clearSession, markXpEarnedAtLocation
Rehydration: clears daily state if stored date !== today

### useMapStore (NOT persisted)
```ts
{
  mapConfig: MapConfig | null,
  todayLocations: LocationWithStatus[],
  capturedSpaces: CapturedSpace[],
  skiaMapImage: SkImage | null,
  playerPosition: { lat, lng, pixelX, pixelY } | null,
  locationLocks: Record<string, { lockedUntil: string }>,
}
```
Actions: loadMapConfig, loadTodayLocations, loadCapturedSpaces, loadSpaceDecoration

### useClanStore (NOT persisted)
```ts
{
  clans: ClanScore[],
  wsConnected: boolean,
  captureResult: CaptureResult | null,
}
```
Actions: setClans, updateClanXp, setCaptureResult, refreshScores

### useAssetStore, useErrorStore, useDebugStore
Simple stores for unplaced asset count, global error, and dev debug mode.

---

## 10. Constants & Magic Numbers

### Backend Constants (shared/constants.ts)
- `LOCK_DURATION_MS` = 3,600,000 (1 hour)
- `LOCK_DURATION_SECONDS` = 3600
- `ADJACENCY_EXCLUSION_RADIUS_METERS` = 15
- `ROTATION_HISTORY_WINDOW_DAYS` = 3
- Rotation modifiers: count_0=2.5, count_1=1.2, count_2=0.8, count_3_plus=0.5

### Backend Constants (in-handler, not extracted)
- `XP_PER_WIN` = 25 (completeMinigame.ts:38, scanQR.ts:24)
- `DAILY_XP_CAP` = 100 (completeMinigame.ts:39, scanQR.ts:24, startMinigame.ts:26)
- `TIME_GRACE_SECONDS` = 5 (completeMinigame.ts:40)
- `MIN_COMPLETION_SECONDS` = 5 (completeMinigame.ts:41)
- `SOLO_SET_SIZE` = 6 (scanQR.ts:25)
- `COOP_SET_SIZE` = 3 (scanQR.ts:26)
- `TARGET_EASY` = 2, `TARGET_MEDIUM` = 3, `TARGET_HARD` = 1 (scanQR.ts:27-29)
- `MAX_COOP_SLOTS_PER_PLAYER` = 2 (dailyReset.ts:194)
- Season hardcoded as `'1'` (dailyScoring.ts:95)

### Mobile Constants (constants/config.ts)
- `XP_PER_WIN` = 25
- `DAILY_XP_CAP` = 100
- `GEOFENCE_RADIUS_DEFAULT` = 15
- `GAME_START_HOUR` = 8, `GAME_END_HOUR` = 18
- `COMPLETION_SALT` = 'grovewars-v1-completion-salt'
- `MAP_TILE_SIZE` = 16, `MAP_WIDTH` = 1920, `MAP_HEIGHT` = 1080
- `PLAYER_CODE_PREFIX` = 'GRV'
- `TC_VERSION` = '1.0.0'
- Time limits per minigame (all match backend MINIGAME_META)

### Admin Constants
- `MAP_WIDTH` = 1920, `MAP_HEIGHT` = 1080, `MAP_TILE_SIZE` = 32 (admin/constants/map.ts)
- **Divergence:** Admin MAP_TILE_SIZE is 32, mobile is 16

---

## 11. Divergences: Code vs Documentation

| Topic | CLAUDE.md / Design Doc | Actual Code |
|---|---|---|
| Geofence validation | Listed as QR validation step 4 | **Not implemented in scanQR** — no GPS distance check |
| Chest drop rate | CLAUDE.md says "15% base × chestDropModifier" | Code: 100% drop on XP-earning wins, weighted by minigame difficulty |
| Location lock duration | CLAUDE.md says "until next 8 AM IST reset" | Code: 1-hour lock (LOCK_DURATION_MS = 3,600,000) with TTL |
| Cooldown | CLAUDE.md says "5 minutes between completions" | **Not implemented** — no cooldown check in startMinigame or completeMinigame |
| DynamoDB tables | CLAUDE.md says 19 | template.yaml has 21 (adds cluster-history, roster was miscounted) |
| Notifications | CLAUDE.md says "FCM via raw HTTPS" | Code uses firebase-admin SDK (messaging.sendEachForMulticast) |
| Auth | CLAUDE.md says "Cognito" for admin | Code uses Google OAuth for admin, Firebase for mobile |
| MAP_TILE_SIZE | — | Backend/mobile: 16, Admin: 32 |
| Daily reset time | CLAUDE.md says "cron 2:30 UTC" | Correct: cron(30 2 * * ? *) = 8:00 AM IST |
| Daily scoring time | CLAUDE.md says "cron 12:30 UTC" | Correct: cron(30 12 * * ? *) = 6:00 PM IST |
| Clan seasonXp | Expected to accumulate | **Never updated in clan record** (see Section 12) |
| setClan permanence | "Clan choice is permanent for the season" | **No guard** — endpoint allows unlimited switching |

---

## 12. Audit: Issues Found, Fixed, and Deferred

### ISSUE 1: Clan seasonXp Never Updated (CRITICAL — FIXED)

**What:** In `completeMinigame.ts`, the clan update expressions increment `todayXp` but never `seasonXp`. User-level seasonXp IS correctly accumulated via `ADD todayXp :xp, seasonXp :xp, totalWins :one` in `awardXpAndStreak()`. But the clan-level `seasonXp` field in the clans table is never incremented, meaning it stays at its initial value forever.

**Impact:** `getClanScores` reads `clan.seasonXp` from the clans table, so the season leaderboard shows stale/zero values for clan season XP. The SeasonSummary endpoint also reads clan seasonXp.

**Code path:**
- `completeMinigame.ts` line 524-536: main player clan update only does `ADD todayXp :xp`
- `completeMinigame.ts` line 588-601: co-op partner clan update same
- `dailyScoring.ts`: no clan seasonXp update
- `dailyReset.ts`: no clan seasonXp update

**Fix:** Added `seasonXp :xp` to the ADD expressions for both main player and co-op partner clan updates in `completeMinigame.ts`.

**Files changed:** `backend/functions/game/completeMinigame.ts`

---

### ISSUE 2: setClan Allows Unlimited Clan Switching (SECURITY — FIXED)

**What:** The `setClan.ts` handler performs an unconditional `SET clan = :clan` update with no check on whether the user already belongs to a clan. CLAUDE.md explicitly states "clan choice is permanent for the season."

**Impact:** Any authenticated player can call `PUT /player/clan` at any time to switch clans. This enables gaming the scoring system (e.g., switching to the leading clan before 6 PM scoring).

**Code path:** `setClan.ts` line 22-27 — simple updateItem with no condition.

**Fix:** Added a DynamoDB condition expression `attribute_not_exists(clan) OR clan = :empty` so the update only succeeds if the user has no clan yet. Returns `FORBIDDEN` if they already have one.

**Files changed:** `backend/functions/player/setClan.ts`

---

### ISSUE 3: Confirmed Clean — XP Atomicity

The `awardXpAndStreak()` function uses DynamoDB ADD with condition `todayXp <= :maxXp` (where maxXp = 75, i.e., 100 - 25). This is atomic and prevents exceeding the 100 XP daily cap. If the condition fails (ConditionalCheckFailedException), the win is still counted via a separate totalWins increment. Correct.

---

### ISSUE 4: Confirmed Clean — Tiebreaker Logic

`dailyScoring.ts` correctly implements "earlier todayXpTimestamp wins" tiebreaker. String comparison of ISO timestamps works correctly for chronological ordering. Handles edge case where a tied clan has no timestamp (loses to one that does).

---

### ISSUE 5: Confirmed Clean — Completion Hash Verification

Backend tries client-salt hash first (sessionId:result:timeTaken with hardcoded salt), then server-salt hash (sessionId:userId:result with per-session salt). Mobile generates client-salt hash using same format. crypto-js HmacSHA256 and Node crypto.createHmac produce identical output for same inputs. No mismatch.

---

### ISSUE 6: Confirmed Clean — Asset Expiry

`assetExpiry.ts` marks non-permanent, unplaced assets as expired at midnight IST. Uses `expiresAt <= now` comparison. Placed assets are safe (checked via `placed === false`). `assetExpiryWarning.ts` runs at 9 PM IST. Both correctly use the checkins/player-assets tables.

---

### ISSUE 7: Confirmed Clean — WebSocket Broadcast

All WS broadcasts are wrapped in try/catch. Stale connection errors are caught and logged. Broadcasts are non-fatal — game logic continues even if WS fails.

---

### DEFERRED: Co-op Partner Per-Location XP Duplication

**What:** In `completeMinigame.ts`, the main player checks `alreadyEarnedXpHere` (whether any win at same location already earned XP today) before awarding XP. The co-op partner path calls `awardXpAndStreak` directly without this per-location check. This means a co-op partner who already earned XP at this location (via a previous session) could earn XP again at the same location.

**Mitigation:** The daily cap (100 XP) still applies. And `startMinigame.ts` prevents the partner from starting the same minigame they already won. But different minigames at the same location could yield double per-location XP for the partner.

**Why deferred:** The fix requires adding a partner-specific todaySessions query and alreadyEarnedXpHere check before calling awardXpAndStreak. This changes co-op reward semantics and needs design review to confirm the intended behavior.

---

### DEFERRED: Unimplemented Minigames in Pool

**What:** `number-grove`, `grove-words`, `cipher-stones`, and `vine-trail` are registered in `MINIGAME_META` and can be assigned to players via `scanQR`'s `pickRandomMinigames()`. But they have no client-side Game/Logic files. If a player selects one, `MinigamePlayScreen` would fail to render the game component.

**Why deferred:** This may be intentional if those minigames are in development. Removing them from the pool would change game balance. Needs design confirmation.

---

### DEFERRED: Missing Geofence and Cooldown

**What:** CLAUDE.md lists geofence validation and 5-minute cooldown as game rules. Neither is implemented in the current code. The scanQR handler accepts `gpsLat`/`gpsLng` in its schema but never validates distance. No cooldown logic exists anywhere.

**Why deferred:** User confirmed "the current implementation is final." These may have been intentionally removed. Documenting as divergence, not fixing.
