# GroveWars — Technical Specification
### Implementation Guide for Claude Code
**Version 1.0 — March 2026**

---

## 1. DynamoDB Table Design

All tables use on-demand billing (pay-per-request) to handle bursty traffic patterns (event windows). Table names are prefixed with `grovewars-{stage}-` where stage is `dev`, `staging`, or `prod`.

### 1.1 Users Table

**Table:** `grovewars-{stage}-users`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `userId` | String (UUID) | PK | Unique player ID |
| `email` | String | — | College email (unique, verified) |
| `displayName` | String | — | Player-chosen pseudonym (3–20 chars) |
| `clan` | String | — | `"ember"` \| `"tide"` \| `"bloom"` \| `"gale"` |
| `avatarConfig` | Map | — | `{ hairStyle: number, hairColor: number, skinTone: number, outfit: number, accessory: number }` |
| `todayXp` | Number | — | Current day XP (0–100), reset at 8 AM |
| `seasonXp` | Number | — | Cumulative season XP |
| `totalWins` | Number | — | Lifetime minigame wins |
| `currentStreak` | Number | — | Consecutive game days with ≥1 win |
| `bestStreak` | Number | — | Highest streak this season |
| `lastActiveDate` | String | — | ISO date of last game day with ≥1 win |
| `tutorialDone` | Boolean | — | Whether tutorial is complete |
| `fcmToken` | String | — | Firebase Cloud Messaging device token |
| `createdAt` | String | — | ISO 8601 timestamp |

**GSI-1 (ClanIndex):** PK = `clan`, SK = `todayXp` (descending) — for clan member leaderboards.

**GSI-2 (EmailIndex):** PK = `email` — for login lookup.

### 1.2 Clans Table

**Table:** `grovewars-{stage}-clans`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `clanId` | String | PK | `"ember"` \| `"tide"` \| `"bloom"` \| `"gale"` |
| `todayXp` | Number | — | Aggregate today XP (real-time) |
| `todayXpTimestamp` | String | — | ISO timestamp of when todayXp last changed (for tiebreaker) |
| `seasonXp` | Number | — | Cumulative season XP |
| `spacesCaptured` | Number | — | Count of captured spaces this season |

**Atomic updates only.** Use `UpdateExpression: 'ADD todayXp :xp SET todayXpTimestamp = :ts'` to prevent race conditions.

### 1.3 Locations Table

**Table:** `grovewars-{stage}-locations`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `locationId` | String (UUID) | PK | Unique location ID |
| `name` | String | — | Human-readable name |
| `gpsLat` | Number | — | Latitude (6 decimal places) |
| `gpsLng` | Number | — | Longitude (6 decimal places) |
| `geofenceRadius` | Number | — | Meters (default 15) |
| `category` | String | — | `"courtyard"` \| `"corridor"` \| `"garden"` \| `"classroom"` \| `"other"` |
| `active` | Boolean | — | Admin toggle |
| `chestDropModifier` | Number | — | Multiplier (1.0 = normal, 1.5 = boosted) |
| `notes` | String | — | Admin notes / activity log insights |

### 1.4 Daily Config Table

**Table:** `grovewars-{stage}-daily-config`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `date` | String | PK | `"2026-03-07"` (IST date) |
| `activeLocationIds` | List\<String\> | — | Location IDs in today's pool |
| `targetSpace` | Map | — | `{ name: string, description: string, mapOverlayId: string }` |
| `qrSecret` | String | — | Daily HMAC secret (generated fresh each day) |
| `winnerClan` | String \| null | — | Set at 6 PM scoring |
| `status` | String | — | `"active"` \| `"scoring"` \| `"complete"` |
| `difficulty` | String | — | `"easy"` \| `"medium"` \| `"hard"` |

### 1.5 Player Location Assignments Table

**Table:** `grovewars-{stage}-player-assignments`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `dateUserId` | String | PK | `"2026-03-07#userId"` (composite) |
| `assignedLocationIds` | List\<String\> | — | 3–5 location IDs assigned to this player |

### 1.6 Game Sessions Table

**Table:** `grovewars-{stage}-game-sessions`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `sessionId` | String (UUID) | PK | Unique session ID |
| `userId` | String | — | Player ID |
| `locationId` | String | — | Where the game was played |
| `minigameId` | String | — | Which minigame |
| `date` | String | — | IST date string |
| `startedAt` | String | — | ISO timestamp (server-recorded) |
| `completedAt` | String \| null | — | ISO timestamp (null if abandoned) |
| `result` | String | — | `"win"` \| `"lose"` \| `"timeout"` \| `"abandoned"` |
| `xpEarned` | Number | — | 0 or 25 |
| `chestDropped` | Boolean | — | Whether a chest dropped |
| `chestAssetId` | String \| null | — | Asset ID if chest dropped |
| `completionHash` | String | — | HMAC for validation |
| `coopPartnerId` | String \| null | — | Co-op partner's userId (null if solo) |

**GSI (UserDateIndex):** PK = `userId`, SK = `date` — for querying a player's sessions today (cooldown check, daily cap check).

### 1.7 Player Locks Table

**Table:** `grovewars-{stage}-player-locks`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `dateUserLocation` | String | PK | `"2026-03-07#userId#locationId"` |
| `lockedAt` | String | — | ISO timestamp |

**TTL:** Set DynamoDB TTL on this table. Calculate TTL as next day's 8 AM IST in epoch seconds. Locks auto-expire.

### 1.8 Captured Spaces Table

**Table:** `grovewars-{stage}-captured-spaces`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `spaceId` | String (UUID) | PK | Unique capture record ID |
| `dateCaptured` | String | — | IST date |
| `clan` | String | — | Winning clan |
| `spaceName` | String | — | Human-readable space name |
| `season` | Number | — | Season number |
| `mapOverlayId` | String | — | Reference to map overlay region |

**GSI (SeasonIndex):** PK = `season`, SK = `dateCaptured` — for loading all captures in current season (map overlay).

### 1.9 Assets Catalog Table

**Table:** `grovewars-{stage}-asset-catalog`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `assetId` | String (UUID) | PK | Unique asset type ID |
| `name` | String | — | Display name |
| `category` | String | — | `"banner"` \| `"statue"` \| `"furniture"` \| `"mural"` \| `"pet"` \| `"special"` |
| `rarity` | String | — | `"common"` \| `"uncommon"` \| `"rare"` \| `"legendary"` |
| `imageKey` | String | — | S3 key for the sprite image |
| `dropWeight` | Number | — | Relative weight for chest drops (higher = more likely) |

### 1.10 Player Assets Table

**Table:** `grovewars-{stage}-player-assets`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `userAssetId` | String | PK | `"userId#assetInstanceId"` |
| `userId` | String | — | Owner |
| `assetId` | String | — | FK to asset catalog |
| `obtainedAt` | String | — | ISO timestamp |
| `obtainedFrom` | String | — | `"chest"` \| `"reward"` \| `"event"` |
| `locationId` | String \| null | — | Where it was earned |
| `placed` | Boolean | — | Whether placed in a decoration |
| `expiresAt` | String \| null | — | ISO timestamp (midnight IST), null if permanent |
| `expired` | Boolean | — | Set true by cleanup job |

**GSI (UserAssetsIndex):** PK = `userId`, SK = `obtainedAt` — for loading player inventory.

**TTL:** Not used here (we want to keep expired records for analytics). The `assetExpiry` Lambda marks them `expired: true`.

### 1.11 Space Decorations Table

**Table:** `grovewars-{stage}-space-decorations`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `userSpaceId` | String | PK | `"userId#spaceId"` |
| `layout` | Map | — | `{ placedAssets: [{ assetId, x, y, rotation }] }` |
| `updatedAt` | String | — | ISO timestamp |

### 1.12 Map Calibration Table

**Table:** `grovewars-{stage}-map-calibration`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `calibrationId` | String (UUID) | PK | Unique calibration ID |
| `mapImageKey` | String | — | S3 key for campus PNG |
| `mapWidth` | Number | — | Map image width in pixels (e.g., 2000) |
| `mapHeight` | Number | — | Map image height in pixels (e.g., 1125) |
| `tileSize` | Number | — | Tile grid size in pixels (32) |
| `points` | List\<Map\> | — | `[{ gpsLat, gpsLng, pixelX, pixelY } × 4]` |
| `transformMatrix` | Map | — | `{ a, b, c, d, tx, ty }` |
| `active` | Boolean | — | Only one active at a time |
| `createdAt` | String | — | ISO timestamp |

### 1.13 Admin Notifications Table

**Table:** `grovewars-{stage}-admin-notifications`

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `notificationId` | String (UUID) | PK | Unique notification ID |
| `message` | String | — | Text (max 140 chars) |
| `target` | String | — | `"all"` \| `"ember"` \| `"tide"` \| `"bloom"` \| `"gale"` |
| `notificationType` | String | — | `"event"` \| `"alert"` \| `"hype"` \| `"info"` |
| `sentAt` | String | — | ISO timestamp |
| `sentBy` | String | — | Admin userId |
| `deliveryCount` | Number | — | Devices reached |

---

## 2. API Endpoint Specifications

Base URL: `https://api.grovewars.{domain}/v1`

All endpoints require `Authorization: Bearer <jwt>` header unless marked PUBLIC. Admin endpoints require the JWT to contain `cognito:groups` including `"admin"`.

### 2.1 Auth Endpoints

#### `POST /auth/signup` — PUBLIC

Register a new player.

```json
// Request
{
  "email": "student@college.edu"
}

// Response 200
{
  "success": true,
  "data": {
    "message": "Verification code sent to student@college.edu"
  }
}

// Response 400
{
  "success": false,
  "error": {
    "code": "INVALID_DOMAIN",
    "message": "Email must be from an allowed college domain"
  }
}
```

**Logic:** Check email against allowed domain list. Trigger Cognito sign-up with email verification. If email exists in clan roster CSV, pre-assign clan. If not in roster, reject with `NOT_IN_ROSTER`.

#### `POST /auth/verify` — PUBLIC

```json
// Request
{
  "email": "student@college.edu",
  "code": "123456"
}

// Response 200
{
  "success": true,
  "data": {
    "userId": "uuid",
    "token": "jwt-string",
    "refreshToken": "refresh-jwt",
    "clan": "ember",
    "tutorialDone": false
  }
}
```

#### `POST /auth/login` — PUBLIC

```json
// Request
{
  "email": "student@college.edu",
  "code": "123456"
}

// Response 200 — same shape as verify
```

**Note:** Login also uses email + code (passwordless). Cognito custom auth flow with email OTP.

### 2.2 Player Endpoints

#### `GET /player/profile`

```json
// Response 200
{
  "success": true,
  "data": {
    "userId": "uuid",
    "displayName": "MossyFox",
    "clan": "ember",
    "avatarConfig": {
      "hairStyle": 3,
      "hairColor": 5,
      "skinTone": 2,
      "outfit": 1,
      "accessory": 0
    },
    "todayXp": 50,
    "seasonXp": 475,
    "totalWins": 19,
    "currentStreak": 7,
    "bestStreak": 7,
    "tutorialDone": true
  }
}
```

#### `PUT /player/avatar`

```json
// Request
{
  "displayName": "MossyFox",
  "avatarConfig": {
    "hairStyle": 3,
    "hairColor": 5,
    "skinTone": 2,
    "outfit": 1,
    "accessory": 0
  }
}

// Response 200
{
  "success": true,
  "data": { "updated": true }
}
```

**Validation:** `displayName` must be 3–20 chars, alphanumeric + spaces. All avatar indices must be within valid range for each category.

#### `GET /player/assets`

```json
// Response 200
{
  "success": true,
  "data": {
    "assets": [
      {
        "userAssetId": "userId#instanceId",
        "assetId": "uuid",
        "name": "Mossy Owl Statue",
        "category": "statue",
        "rarity": "uncommon",
        "imageKey": "assets/statues/mossy-owl.png",
        "placed": false,
        "expiresAt": "2026-03-07T18:30:00.000Z",
        "obtainedFrom": "chest"
      }
    ]
  }
}
```

### 2.3 Map & Location Endpoints

#### `GET /map/config`

```json
// Response 200
{
  "success": true,
  "data": {
    "mapImageUrl": "https://s3.../campus-v1.png",
    "mapWidth": 2000,
    "mapHeight": 1125,
    "tileSize": 32,
    "transformMatrix": {
      "a": 123456.78,
      "b": -98765.43,
      "c": 45678.90,
      "d": 123456.78,
      "tx": -9876543.21,
      "ty": -5432109.87
    }
  }
}
```

**Note:** `tileSize` is the pixel art tile grid size (32 px). All on-map elements (pins, markers, overlays, polygon boundaries) should snap to this grid. Client uses `mapWidth` and `mapHeight` for overlay rendering and pan/zoom bounds.

#### `GET /locations/today`

Returns only this player's assigned locations for today.

```json
// Response 200
{
  "success": true,
  "data": {
    "locations": [
      {
        "locationId": "uuid",
        "name": "North Garden",
        "gpsLat": 13.012345,
        "gpsLng": 80.234567,
        "geofenceRadius": 15,
        "category": "garden",
        "locked": false
      },
      {
        "locationId": "uuid",
        "name": "Library Corridor",
        "gpsLat": 13.012567,
        "gpsLng": 80.234789,
        "geofenceRadius": 15,
        "category": "corridor",
        "locked": true
      }
    ]
  }
}
```

**Logic:** Look up `player-assignments` table for today + userId. For each assigned location, check `player-locks` to set `locked` flag.

#### `GET /daily/info`

```json
// Response 200
{
  "success": true,
  "data": {
    "date": "2026-03-07",
    "targetSpace": {
      "name": "North Courtyard",
      "description": "The shaded courtyard near the old oak",
      "mapOverlayId": "overlay-north-courtyard"
    },
    "status": "active",
    "difficulty": "medium",
    "eventWindows": [
      { "label": "Morning break", "startTime": "10:40", "endTime": "11:00" },
      { "label": "Lunch break", "startTime": "12:40", "endTime": "13:40" },
      { "label": "Final push", "startTime": "17:00", "endTime": "18:00" }
    ]
  }
}
```

### 2.4 Game Session Endpoints

#### `POST /game/scan`

Player scans a QR code. Server validates and returns available minigames.

```json
// Request
{
  "qrData": {
    "v": 1,
    "l": "location-uuid",
    "d": "2026-03-07",
    "h": "hmac-signature"
  },
  "gpsLat": 13.012345,
  "gpsLng": 80.234567
}

// Response 200 (success)
{
  "success": true,
  "data": {
    "locationId": "uuid",
    "locationName": "North Garden",
    "availableMinigames": [
      { "minigameId": "grove-words", "name": "Grove Words", "timeLimit": 120, "description": "Guess the word in 6 tries" },
      { "minigameId": "kindred", "name": "Kindred", "timeLimit": 150, "description": "Group 16 words into 4 groups" },
      { "minigameId": "stone-pairs", "name": "Stone Pairs", "timeLimit": 60, "description": "Find matching pairs" },
      { "minigameId": "pips", "name": "Pips", "timeLimit": 90, "description": "Fill the shape in limited moves" }
    ]
  }
}

// Response 400 (various failures)
{
  "success": false,
  "error": {
    "code": "QR_EXPIRED",        // or GPS_OUT_OF_RANGE, LOCATION_LOCKED,
    "message": "..."              //    NOT_ASSIGNED, DAILY_CAP_REACHED, QR_INVALID
  }
}
```

**Validation chain (in order):**
1. Is `qrData.d` today's date? → `QR_EXPIRED`
2. Is HMAC valid? → `QR_INVALID`
3. Is player GPS within geofence of location? → `GPS_OUT_OF_RANGE`
4. Is location in player's assigned set? → `NOT_ASSIGNED`
5. Is location locked for this player? → `LOCATION_LOCKED`
6. Has player hit 100 XP today? → `DAILY_CAP_REACHED`
7. Is player on cooldown? → `ON_COOLDOWN` (include `cooldownEndsAt` in response)

**Minigame selection:** Randomly pick 3–5 from the pool of 12. Exclude any minigame the player already played at this location today (optional — prevents repetition).

#### `POST /game/start`

```json
// Request
{
  "locationId": "uuid",
  "minigameId": "grove-words",
  "coopPartnerId": null
}

// Response 200
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "serverTimestamp": "2026-03-07T08:30:00.000Z",
    "timeLimit": 120,
    "puzzleData": {
      // Minigame-specific puzzle config — see Section 4
    }
  }
}
```

**Logic:** Create session record with `startedAt = now()`. If co-op, validate partner is same clan and hasn't hit daily cap. Return puzzle seed/config so client can render the game.

#### `POST /game/complete`

```json
// Request
{
  "sessionId": "uuid",
  "result": "win",
  "completionHash": "hmac-of-session-data",
  "solutionData": {
    // Minigame-specific proof of solution — see Section 4
  }
}

// Response 200 (win)
{
  "success": true,
  "data": {
    "result": "win",
    "xpEarned": 25,
    "newTodayXp": 75,
    "clanTodayXp": 1250,
    "chestDrop": {
      "dropped": true,
      "asset": {
        "assetId": "uuid",
        "name": "Baby Fox",
        "category": "pet",
        "rarity": "rare",
        "imageKey": "assets/pets/baby-fox.png"
      }
    },
    "cooldownEndsAt": "2026-03-07T08:35:00.000Z"
  }
}

// Response 200 (lose)
{
  "success": true,
  "data": {
    "result": "lose",
    "xpEarned": 0,
    "locationLocked": true,
    "chestDrop": { "dropped": false }
  }
}
```

**Validation:**
1. Session exists and belongs to this player
2. Session not already completed
3. `completionHash` = HMAC-SHA256(`sessionId:userId:result`, serverSecret)
4. Time elapsed since `startedAt` is ≤ timeLimit + 5s grace period
5. Time elapsed is ≥ minimum plausible time (e.g., 5 seconds — instant solves are suspicious)
6. Rate limit check: last completion was ≥ 4 minutes ago

**On win:**
1. Award 25 XP to player (`todayXp`, `seasonXp`, `totalWins`)
2. Atomically increment clan `todayXp` by 25, update `todayXpTimestamp`
3. Roll chest drop: `Math.random() < 0.15 * location.chestDropModifier`
4. If chest drops, select asset by weighted random from catalog
5. Create player asset record with midnight expiry
6. Update streak: if `lastActiveDate !== today`, increment `currentStreak`, update `lastActiveDate`
7. If co-op, repeat XP/streak updates for partner (but only one chest roll per session)
8. Set cooldown

**On lose:**
1. Create lock record for this player + location + today
2. No XP, no chest roll

#### `GET /game/cooldown`

```json
// Response 200
{
  "success": true,
  "data": {
    "onCooldown": true,
    "cooldownEndsAt": "2026-03-07T08:35:00.000Z",
    "remainingSeconds": 187
  }
}
```

### 2.5 Scores Endpoints

#### `GET /scores/clans`

```json
// Response 200
{
  "success": true,
  "data": {
    "clans": [
      { "clanId": "ember", "todayXp": 1250, "seasonXp": 8750, "spacesCaptured": 5 },
      { "clanId": "tide", "todayXp": 1100, "seasonXp": 9200, "spacesCaptured": 6 },
      { "clanId": "bloom", "todayXp": 950, "seasonXp": 7800, "spacesCaptured": 2 },
      { "clanId": "gale", "todayXp": 875, "seasonXp": 8100, "spacesCaptured": 1 }
    ]
  }
}
```

**Also available via WebSocket** at `wss://ws.grovewars.{domain}/scores`. On any XP change, server broadcasts updated clan scores to all connected clients.

#### `GET /scores/history`

```json
// Response 200
{
  "success": true,
  "data": {
    "captures": [
      { "date": "2026-03-01", "spaceName": "North Courtyard", "clan": "ember", "mapOverlayId": "overlay-nc" },
      { "date": "2026-03-02", "spaceName": "Library Garden", "clan": "tide", "mapOverlayId": "overlay-lg" }
    ]
  }
}
```

### 2.6 Spaces & Decoration Endpoints

#### `GET /spaces/captured`

Returns all captured spaces for map overlay rendering.

```json
// Response 200
{
  "success": true,
  "data": {
    "spaces": [
      { "spaceId": "uuid", "spaceName": "North Courtyard", "clan": "ember", "dateCaptured": "2026-03-01", "mapOverlayId": "overlay-nc" }
    ]
  }
}
```

#### `GET /spaces/{spaceId}/decoration`

```json
// Response 200
{
  "success": true,
  "data": {
    "layout": {
      "placedAssets": [
        { "assetId": "uuid", "x": 120, "y": 80, "rotation": 0 },
        { "assetId": "uuid", "x": 200, "y": 150, "rotation": 90 }
      ]
    }
  }
}
```

#### `PUT /spaces/{spaceId}/decoration`

```json
// Request
{
  "layout": {
    "placedAssets": [
      { "assetId": "uuid", "x": 120, "y": 80, "rotation": 0 }
    ]
  }
}

// Response 200
{
  "success": true,
  "data": { "saved": true }
}
```

**Validation:** All referenced `assetId`s must exist in player's inventory, must be non-expired, and player's clan must own this space.

### 2.7 Admin Endpoints

All admin endpoints require `admin` group in JWT claims.

#### `POST /admin/daily/config`

```json
// Request
{
  "date": "2026-03-08",
  "activeLocationIds": ["uuid1", "uuid2", "uuid3"],
  "targetSpace": {
    "name": "South Garden",
    "description": "The rose garden near the cafeteria",
    "mapOverlayId": "overlay-sg"
  },
  "difficulty": "medium"
}

// Response 200
{
  "success": true,
  "data": {
    "date": "2026-03-08",
    "qrSecret": "generated-daily-secret",
    "status": "active"
  }
}
```

**Logic:** Generate a fresh `qrSecret` using `crypto.randomBytes(32).toString('hex')`. Store in daily config.

#### `POST /admin/qr/generate`

```json
// Request
{
  "date": "2026-03-08"
}

// Response 200
{
  "success": true,
  "data": {
    "qrCodes": [
      {
        "locationId": "uuid1",
        "locationName": "North Garden",
        "qrPayload": "{\"v\":1,\"l\":\"uuid1\",\"d\":\"2026-03-08\",\"h\":\"hmac...\"}",
        "qrImageBase64": "data:image/png;base64,..."
      }
    ],
    "printablePdfKey": "qr-sheets/2026-03-08.pdf"
  }
}
```

**Logic:** For each active location, generate QR payload with HMAC. Render QR images. Compose a printable PDF (one QR per quarter-page with location name label). Upload PDF to S3.

#### `POST /admin/notifications/send`

```json
// Request
{
  "message": "Special chest drop rates at the Garden for the next hour!",
  "target": "all",
  "notificationType": "event"
}

// Response 200
{
  "success": true,
  "data": {
    "notificationId": "uuid",
    "deliveryCount": 342
  }
}
```

**Logic:** Validate message ≤ 140 chars. Query FCM tokens by target audience. Send via FCM batch API. Record in notifications table.

#### `POST /admin/roster/import`

```json
// Request (multipart/form-data)
// File: roster.csv
// CSV format: email,house
// student1@college.edu,ember
// student2@college.edu,tide

// Response 200
{
  "success": true,
  "data": {
    "imported": 487,
    "skipped": 3,
    "errors": ["row 45: invalid email format"]
  }
}
```

#### `POST /admin/season/reset`

```json
// Request
{
  "resetTerritories": true,
  "newSeasonNumber": 2
}

// Response 200
{
  "success": true,
  "data": {
    "message": "Season 2 started. All XP reset. Territories cleared."
  }
}
```

**Logic:** Reset all users' `seasonXp`, `todayXp`, `currentStreak`, `bestStreak` to 0. Reset all clans' counters. If `resetTerritories`, mark all captured spaces as previous season. Archive Hall of Fame data.

---

## 3. Scheduled Lambda Jobs

### 3.1 Daily Reset (8:00 AM IST)

**Trigger:** EventBridge rule: `cron(30 2 * * ? *)` (2:30 UTC = 8:00 IST)

**Steps:**
1. Set yesterday's daily config `status` = `"complete"` (if not already)
2. Batch update all users: set `todayXp` = 0
3. Batch update all clans: set `todayXp` = 0, clear `todayXpTimestamp`
4. Delete all entries from `player-locks` table for yesterday's date (or rely on TTL)
5. Generate player location assignments for today:
   - Read today's `activeLocationIds` from daily config
   - For each registered player, randomly select 3–5 locations
   - Write to `player-assignments` table
6. Send day-start push notification: "A new day dawns! Today's prize: {spaceName}"

### 3.2 Daily Scoring (6:00 PM IST)

**Trigger:** EventBridge rule: `cron(30 12 * * ? *)` (12:30 UTC = 6:00 IST)

**Steps:**
1. Set today's daily config `status` = `"scoring"`
2. Read all 4 clan records
3. Determine winner: highest `todayXp`. Tiebreaker: earliest `todayXpTimestamp`
4. Create captured space record
5. Update winning clan's `spacesCaptured` counter
6. Set daily config `winnerClan` and `status` = `"complete"`
7. Send push notification to all: "{WinningClan} has captured {SpaceName}!"
8. Broadcast via WebSocket to trigger celebration screen on connected clients

### 3.3 Asset Expiry (12:00 AM IST)

**Trigger:** EventBridge rule: `cron(30 18 * * ? *)` (18:30 UTC = 12:00 AM IST)

**Steps:**
1. Query `player-assets` where `placed` = false AND `expiresAt` ≤ now AND `expired` = false
2. Batch update all matching: set `expired` = true
3. Log count for analytics

### 3.4 Asset Expiry Warning (9:00 PM IST)

**Trigger:** EventBridge rule: `cron(30 15 * * ? *)` (15:30 UTC = 9:00 PM IST)

**Steps:**
1. Query all players who have unplaced, non-expired assets
2. Send push notification: "You have X unplaced items — place them before midnight or they'll fade away!"

---

## 4. Minigame Puzzle Generation & Validation

Each minigame needs server-side puzzle generation (or seed-based) and a way to validate the client's claimed result.

### 4.1 Grove Words (Wordle-style)

**Puzzle generation:**
- Server picks a random 5-letter word from the curated cottagecore word list (200+ words)
- Returns: `{ wordLength: 5, maxGuesses: 6 }` (does NOT reveal the answer)

**Client gameplay:** Standard Wordle mechanics. Client sends guesses to server one at a time OR plays fully offline and submits final state.

**Completion validation:**
- `solutionData: { guesses: ["BLOOM", "CREEK", "GROVE"], finalGuess: "GROVE", solved: true }`
- Server checks: final guess matches the word selected for this session
- Plausibility: number of guesses ≤ 6

**Word list (sample):** BLOOM, GROVE, CREEK, STONE, FERNS, BROOK, PETAL, CEDAR, CLOVER, MARSH, THORN, WOVEN, ROOST, FUNGI, DWELL, FLORA, BOWER, HONEY, WHEAT, ACORN, BIRCH, MAPLE, PLUME, THYME, BASIL, BRIAR, FROND, LICHEN, SEDGE, WREN...

### 4.2 Kindred (Connections-style)

**Puzzle generation:**
- Server selects 4 groups of 4 words from a curated set of group packs
- Each group has a category label and 4 words
- Words are shuffled into a flat 16-word array
- Returns: `{ words: [...16 shuffled words] }` (does NOT reveal groups)

**Completion validation:**
- `solutionData: { groups: [["word1","word2","word3","word4"], ...], mistakes: 2, solved: true }`
- Server checks: submitted groups match the correct groupings
- Plausibility: mistakes ≤ 4

### 4.3 Pips (Tile-filling)

**Puzzle generation:**
- Server generates a target shape on a grid (5×5 to 8×8)
- Defines tap patterns (each tap fills the tapped tile + specific neighbors)
- Calculates a valid solution path and sets move limit to solution length + 1
- Returns: `{ grid: [[0,1,1,0,...]], tapPattern: "cross", moveLimit: 8 }`

**Completion validation:**
- `solutionData: { moves: [{x:2,y:3}, {x:4,y:1},...], finalGrid: [[1,1,1,...]] }`
- Server replays moves, verifies final grid matches target, moves ≤ limit

### 4.4 Stone Pairs (Memory match)

**Puzzle generation:**
- Server generates 8 pairs (16 cards) on a 4×4 grid
- Each pair is a cottagecore icon (mushroom, acorn, leaf, etc.)
- Returns: `{ gridSize: 4, cardBackImage: "stone-tablet", pairs: 8 }` (card positions are randomized client-side from a seed)
- Also returns: `{ seed: 12345 }` so server can reconstruct the layout

**Completion validation:**
- `solutionData: { flips: [{pos:0, pos:5}, {pos:2, pos:9},...], totalFlips: 24, solved: true }`
- Server reconstructs grid from seed, verifies all pairs found, flip count is plausible

### 4.5–4.12 (Remaining minigames)

Follow the same pattern: server sends puzzle config (without answer), client plays, client submits solution data, server validates. See the GDD Section 6 for game rules. Each minigame's `*Logic.ts` file should export:

```typescript
interface MinigamePuzzle {
  type: string;           // "grove-words" | "kindred" | etc.
  config: object;         // Game-specific config sent to client
  solution: object;       // Kept server-side for validation
  timeLimit: number;      // Seconds
}

function generatePuzzle(difficulty: "easy" | "medium" | "hard"): MinigamePuzzle;
function validateSolution(puzzle: MinigamePuzzle, submission: object): boolean;
```

---

## 5. Real-Time Score System

### WebSocket Architecture

**API Gateway WebSocket API** at `wss://ws.grovewars.{domain}/scores`

**Connection flow:**
1. Client connects with JWT in query param: `wss://...?token=jwt`
2. `$connect` Lambda validates JWT, stores `connectionId` + `userId` + `clan` in a DynamoDB connections table
3. Client receives live score updates as JSON messages
4. `$disconnect` Lambda removes connection record

**Broadcasting:**
When any player earns XP (in `completeMinigame` Lambda):
1. After updating clan XP, read all 4 clan scores
2. Query connections table for all active connections
3. Broadcast to all via API Gateway `postToConnection`:

```json
{
  "type": "SCORE_UPDATE",
  "data": {
    "clans": [
      { "clanId": "ember", "todayXp": 1275 },
      { "clanId": "tide", "todayXp": 1100 },
      { "clanId": "bloom", "todayXp": 950 },
      { "clanId": "gale", "todayXp": 900 }
    ],
    "timestamp": "2026-03-07T10:15:00.000Z"
  }
}
```

**Capture announcement broadcast:**

```json
{
  "type": "CAPTURE",
  "data": {
    "winnerClan": "ember",
    "spaceName": "North Courtyard",
    "mapOverlayId": "overlay-nc"
  }
}
```

---

## 6. Authentication Flow

### Cognito Configuration

- **User pool:** `grovewars-{stage}-users`
- **Custom auth flow:** Passwordless email OTP
  - `DefineAuthChallenge` Lambda: always issue custom challenge
  - `CreateAuthChallenge` Lambda: generate 6-digit code, send via SES
  - `VerifyAuthChallenge` Lambda: compare submitted code
- **Allowed email domains:** Configurable list (e.g., `["college.edu"]`)
- **Admin group:** `admin` group in Cognito for dashboard access
- **Token expiry:** Access token = 1 hour. Refresh token = 30 days.

### Client Auth Flow

1. User enters college email → `POST /auth/signup`
2. Cognito sends 6-digit code via SES
3. User enters code → `POST /auth/verify`
4. Client receives JWT + refresh token → stores in secure storage (react-native-keychain)
5. All subsequent API calls include `Authorization: Bearer <accessToken>`
6. On 401, client uses refresh token to get new access token
7. On refresh failure, redirect to login

---

## 7. GPS & Geofencing

### Android Configuration

```typescript
// react-native-geolocation-service config
Geolocation.watchPosition(
  (position) => { /* update map marker */ },
  (error) => { /* handle error */ },
  {
    enableHighAccuracy: true,        // Use GPS hardware
    distanceFilter: 2,               // Minimum 2m movement to trigger update
    interval: 3000,                  // Check every 3 seconds
    fastestInterval: 1000,           // Accept updates as fast as 1/sec
    showLocationDialog: true,        // Prompt user to enable GPS
    forceRequestLocation: true,      // Force fresh fix
  }
);
```

### Geofence Check (Server-side)

```typescript
function isWithinGeofence(
  playerLat: number,
  playerLng: number,
  locationLat: number,
  locationLng: number,
  radiusMeters: number
): boolean {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(locationLat - playerLat);
  const dLng = toRadians(locationLng - playerLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(playerLat)) *
    Math.cos(toRadians(locationLat)) *
    Math.sin(dLng / 2) ** 2;
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distance <= radiusMeters;
}
```

---

## 8. Affine Transform Implementation

### Computing the Transform

```typescript
interface CalibrationPoint {
  gpsLat: number;
  gpsLng: number;
  pixelX: number;
  pixelY: number;
}

interface AffineMatrix {
  a: number; b: number; tx: number;
  c: number; d: number; ty: number;
}

function computeAffineTransform(points: CalibrationPoint[]): AffineMatrix {
  // Least-squares solution for 4+ points
  // Build system: pixel_x = a*lng + b*lat + tx
  //               pixel_y = c*lng + d*lat + ty
  // A matrix (2n × 6):
  //   [lng_i, lat_i, 1, 0, 0, 0]  for each pixel_x equation
  //   [0, 0, 0, lng_i, lat_i, 1]  for each pixel_y equation
  // B vector: [px_1, py_1, px_2, py_2, ...]
  // Solve via normal equations: params = (A^T A)^-1 A^T B

  const n = points.length;
  const A: number[][] = [];
  const B: number[] = [];

  for (const p of points) {
    A.push([p.gpsLng, p.gpsLat, 1, 0, 0, 0]);
    A.push([0, 0, 0, p.gpsLng, p.gpsLat, 1]);
    B.push(p.pixelX);
    B.push(p.pixelY);
  }

  // Solve least squares (use a matrix library or manual 6x6 inverse)
  const params = leastSquaresSolve(A, B); // returns [a, b, tx, c, d, ty]

  return {
    a: params[0], b: params[1], tx: params[2],
    c: params[3], d: params[4], ty: params[5]
  };
}

function gpsToPixel(lat: number, lng: number, m: AffineMatrix): { x: number; y: number } {
  return {
    x: m.a * lng + m.b * lat + m.tx,
    y: m.c * lng + m.d * lat + m.ty,
  };
}

function pixelToGps(px: number, py: number, m: AffineMatrix): { lat: number; lng: number } {
  const det = m.a * m.d - m.b * m.c;
  return {
    lng: (m.d * (px - m.tx) - m.b * (py - m.ty)) / det,
    lat: (-m.c * (px - m.tx) + m.a * (py - m.ty)) / det,
  };
}
```

---

## 9. Push Notification Payloads

### FCM Message Formats

```typescript
// Day start (8 AM)
{
  notification: {
    title: "A new day dawns!",
    body: "Today's prize: North Courtyard. Go claim it for Ember!"
  },
  data: {
    type: "DAY_START",
    targetSpace: "North Courtyard",
    date: "2026-03-07"
  }
}

// Event window
{
  notification: {
    title: "Break time!",
    body: "Lunch break — perfect time to earn XP for Ember!"
  },
  data: {
    type: "EVENT_WINDOW",
    window: "lunch"
  }
}

// Final push (5 PM)
{
  notification: {
    title: "Last hour!",
    body: "Ember is 150 XP behind Tide. Every win counts!"
  },
  data: {
    type: "FINAL_PUSH",
    leadingClan: "tide",
    deficit: 150
  }
}

// Capture result (6 PM)
{
  notification: {
    title: "Ember wins!",
    body: "Ember has captured North Courtyard! See the updated map."
  },
  data: {
    type: "CAPTURE_RESULT",
    winnerClan: "ember",
    spaceName: "North Courtyard"
  }
}

// Asset expiry warning (9 PM)
{
  notification: {
    title: "Items fading...",
    body: "You have 3 unplaced items — place them before midnight!"
  },
  data: {
    type: "ASSET_EXPIRY_WARNING",
    count: 3
  }
}

// Admin custom
{
  notification: {
    title: "Special Event!",
    body: "Special chest drop rates at the Garden for the next hour!"
  },
  data: {
    type: "ADMIN_CUSTOM",
    notificationType: "event",
    notificationId: "uuid"
  }
}
```

---

## 10. S3 Bucket Structure

**Bucket:** `grovewars-{stage}-assets`

```
grovewars-{stage}-assets/
├── maps/
│   └── campus-v1.png                    # Campus pixel art map (2000×1125 px, 32px tile grid)
├── sprites/
│   ├── characters/
│   │   ├── hair/                        # hair_style_01.png ... hair_style_08.png
│   │   ├── skin/                        # skin_tone_01.png ... skin_tone_08.png
│   │   ├── outfits/                     # outfit_01.png ... outfit_08.png
│   │   └── accessories/                 # accessory_01.png ... accessory_05.png
│   ├── pins/
│   │   ├── pin_active.png
│   │   ├── pin_locked.png
│   │   ├── pin_event.png
│   │   └── pin_mushroom.png, pin_flower.png, pin_lantern.png
│   ├── clans/
│   │   ├── ember_banner.png
│   │   ├── tide_banner.png
│   │   ├── bloom_banner.png
│   │   └── gale_banner.png
│   └── minigames/
│       ├── grove-words/                 # Letter tiles, keyboard
│       ├── kindred/                     # Word cards
│       ├── stone-pairs/                 # Card backs, icons
│       └── ... (per minigame)
├── assets/                              # Collectible decoration assets
│   ├── banners/
│   ├── statues/
│   ├── furniture/
│   ├── murals/
│   ├── pets/
│   └── special/
├── ui/
│   ├── frames/                          # Wooden frames, parchment borders
│   ├── buttons/                         # Cottagecore-styled buttons
│   ├── backgrounds/                     # Screen backgrounds
│   └── icons/                           # UI icons (XP, timer, streak)
├── tutorial/
│   ├── elder_moss_portrait.png
│   ├── scene_bg_01.png ... scene_bg_05.png
│   └── clan_vignettes/
│       ├── ember_vignette.png
│       ├── tide_vignette.png
│       ├── bloom_vignette.png
│       └── gale_vignette.png
└── qr-sheets/
    └── 2026-03-07.pdf                   # Generated daily QR printable PDFs
```

---

## 11. Error Codes Reference

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_DOMAIN` | 400 | Email not from allowed college domain |
| `NOT_IN_ROSTER` | 400 | Email not found in clan roster |
| `INVALID_CODE` | 400 | Wrong verification code |
| `QR_EXPIRED` | 400 | QR code date doesn't match today |
| `QR_INVALID` | 400 | HMAC signature verification failed |
| `GPS_OUT_OF_RANGE` | 400 | Player GPS outside location geofence |
| `NOT_ASSIGNED` | 400 | Location not in player's assigned set today |
| `LOCATION_LOCKED` | 403 | Player lost at this location today |
| `DAILY_CAP_REACHED` | 403 | Player already earned 100 XP today |
| `ON_COOLDOWN` | 429 | Cooldown period not elapsed |
| `SESSION_NOT_FOUND` | 404 | Game session doesn't exist |
| `SESSION_COMPLETED` | 400 | Session already submitted |
| `INVALID_HASH` | 400 | Completion HMAC doesn't match |
| `SUSPICIOUS_TIME` | 400 | Completion time too fast or too slow |
| `RATE_LIMITED` | 429 | Too many requests |
| `UNAUTHORIZED` | 401 | Invalid or expired JWT |
| `FORBIDDEN` | 403 | Not an admin / insufficient permissions |
| `GAME_INACTIVE` | 403 | Outside 8 AM – 6 PM window |
| `SEASON_ENDED` | 403 | No active season |

---

*End of Technical Specification — GroveWars v1.0*
