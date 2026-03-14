# CLAUDE.md — GroveWars Project Instructions

## Project Overview

GroveWars is a clan-based territory capture game for Android (React Native) with an AWS serverless backend and a React web admin dashboard. Four college house clans compete daily to capture campus spaces by solving puzzle minigames at physical locations. Cottagecore/Stardew Valley aesthetic throughout.

**Reference:** See `GroveWars_GDD_v1_1.md` for full game design. See `GroveWars_TechSpec.md` for architecture details. See `GroveWars_AssetSpec.md` for all art assets and content lists.

---

## Repository Structure

```
grove-wars/
├── CLAUDE.md
├── docs/
│   ├── GroveWars_GDD_v1_1.md
│   ├── GroveWars_TechSpec.md
│   └── GroveWars_AssetSpec.md
├── mobile/                          # React Native app (Android)
│   ├── android/
│   ├── src/
│   │   ├── api/                     # API client, endpoints, auth helpers
│   │   ├── assets/                  # Static images, fonts, sprite sheets
│   │   │   ├── sprites/             # Character sprites, items, pins
│   │   │   ├── ui/                  # Frames, backgrounds, buttons
│   │   │   ├── maps/                # Campus PNG(s)
│   │   │   └── fonts/               # Pixel fonts
│   │   ├── components/              # Shared UI components
│   │   │   ├── common/              # Buttons, modals, badges, timers
│   │   │   ├── map/                 # MapView, MapPin, MapOverlay, PlayerMarker
│   │   │   ├── minigames/           # Shared minigame UI (timer bar, result overlay)
│   │   │   └── profile/             # AvatarBuilder, AvatarDisplay, StatCard
│   │   ├── screens/                 # One file per screen (see Screen List below)
│   │   │   ├── SplashScreen.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── TutorialScreen.tsx
│   │   │   ├── CharacterCreationScreen.tsx
│   │   │   ├── MainMapScreen.tsx
│   │   │   ├── QRScannerScreen.tsx
│   │   │   ├── MinigameSelectScreen.tsx
│   │   │   ├── MinigamePlayScreen.tsx
│   │   │   ├── ResultScreen.tsx
│   │   │   ├── ClanScoreboardScreen.tsx
│   │   │   ├── PlayerProfileScreen.tsx
│   │   │   ├── SpaceDecorationScreen.tsx
│   │   │   ├── AssetInventoryScreen.tsx
│   │   │   ├── CaptureCelebrationScreen.tsx
│   │   │   ├── SeasonSummaryScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── minigames/               # Each minigame = own folder
│   │   │   ├── grove-words/
│   │   │   │   ├── GroveWordsGame.tsx
│   │   │   │   ├── GroveWordsLogic.ts
│   │   │   │   ├── wordlist.ts
│   │   │   │   └── __tests__/
│   │   │   ├── kindred/
│   │   │   ├── pips/
│   │   │   ├── vine-trail/
│   │   │   ├── mosaic/
│   │   │   ├── crossvine/
│   │   │   ├── number-grove/
│   │   │   ├── stone-pairs/
│   │   │   ├── potion-logic/
│   │   │   ├── leaf-sort/
│   │   │   ├── cipher-stones/
│   │   │   └── path-weaver/
│   │   ├── navigation/              # React Navigation config
│   │   ├── store/                   # Zustand stores
│   │   │   ├── useAuthStore.ts
│   │   │   ├── useGameStore.ts
│   │   │   ├── useMapStore.ts
│   │   │   └── useClanStore.ts
│   │   ├── hooks/                   # Custom hooks
│   │   │   ├── useGPS.ts
│   │   │   ├── useCountdown.ts
│   │   │   └── useClanScores.ts
│   │   ├── utils/                   # Pure utility functions
│   │   │   ├── affineTransform.ts   # GPS ↔ pixel coordinate math
│   │   │   ├── qrValidation.ts
│   │   │   ├── hmac.ts
│   │   │   └── xpCalculations.ts
│   │   ├── types/                   # TypeScript type definitions
│   │   │   └── index.ts
│   │   └── constants/               # App-wide constants
│   │       ├── colors.ts            # Clan colors + cottagecore palette
│   │       ├── config.ts            # Timing, XP caps, geofence defaults
│   │       └── api.ts               # API base URL, endpoints
│   ├── package.json
│   └── tsconfig.json
├── backend/                         # AWS serverless (SAM or CDK)
│   ├── template.yaml               # SAM template (or cdk/ if using CDK)
│   ├── functions/                   # Lambda handlers — one folder per domain
│   │   ├── auth/
│   │   │   ├── signup.ts
│   │   │   ├── verify.ts
│   │   │   └── login.ts
│   │   ├── player/
│   │   │   ├── getProfile.ts
│   │   │   ├── updateAvatar.ts
│   │   │   ├── getAssets.ts
│   │   │   └── getStats.ts
│   │   ├── game/
│   │   │   ├── scanQR.ts
│   │   │   ├── startMinigame.ts
│   │   │   ├── completeMinigame.ts
│   │   │   └── getCooldown.ts
│   │   ├── scores/
│   │   │   ├── getClanScores.ts
│   │   │   └── getCaptureHistory.ts
│   │   ├── spaces/
│   │   │   ├── getCapturedSpaces.ts
│   │   │   ├── getDecoration.ts
│   │   │   └── saveDecoration.ts
│   │   ├── admin/
│   │   │   ├── setDailyConfig.ts
│   │   │   ├── generateQR.ts
│   │   │   ├── sendNotification.ts
│   │   │   ├── getNotificationHistory.ts
│   │   │   ├── importRoster.ts
│   │   │   ├── seasonReset.ts
│   │   │   └── analytics.ts
│   │   └── scheduled/
│   │       ├── dailyReset.ts        # 8 AM IST — reset XP, locks, assign locations
│   │       ├── dailyScoring.ts      # 6 PM IST — compare clans, capture space
│   │       └── assetExpiry.ts       # 12 AM IST — expire unplaced assets
│   ├── shared/                      # Shared backend utilities
│   │   ├── db.ts                    # DynamoDB client + helpers
│   │   ├── auth.ts                  # JWT verification middleware
│   │   ├── hmac.ts                  # QR HMAC generation/verification
│   │   ├── notifications.ts         # FCM push notification wrapper
│   │   └── types.ts                 # Shared backend types
│   ├── package.json
│   └── tsconfig.json
└── admin/                           # React web dashboard
    ├── src/
    │   ├── pages/
    │   │   ├── DailyConfigPage.tsx
    │   │   ├── LocationsPage.tsx
    │   │   ├── MapCalibrationPage.tsx
    │   │   ├── AnalyticsPage.tsx
    │   │   ├── SeasonPage.tsx
    │   │   ├── UsersPage.tsx
    │   │   ├── NotificationsPage.tsx
    │   │   └── QRGeneratorPage.tsx
    │   ├── components/
    │   ├── api/
    │   └── App.tsx
    ├── package.json
    └── tsconfig.json
```

---

## Tech Stack & Versions

| Tool | Version / Notes |
|------|----------------|
| React Native | 0.73+ (latest stable) |
| TypeScript | 5.x — strict mode ON |
| State management | Zustand (NOT Redux) |
| Navigation | @react-navigation/native v6 |
| Map rendering | react-native-skia for pixel art + overlays |
| QR scanning | react-native-vision-camera + ML Kit |
| GPS | react-native-geolocation-service |
| Push notifications | @react-native-firebase/messaging (FCM) |
| Backend | AWS SAM (TypeScript Lambdas) |
| Database | DynamoDB (single-table design where practical) |
| Auth | AWS Cognito (custom email domain restriction) |
| Real-time | API Gateway WebSocket for clan score subscriptions |
| Admin dashboard | React 18 + Vite + Tailwind CSS |
| Testing | Jest + React Native Testing Library (mobile), Vitest (admin) |

---

## Coding Conventions

### General
- **Language:** TypeScript everywhere. No `any` types — use proper generics or `unknown` + type guards.
- **Formatting:** Prettier with defaults (2-space indent, single quotes, trailing commas).
- **Linting:** ESLint with `@typescript-eslint/recommended`.
- **Naming:**
  - Files: `camelCase.ts` for utils/hooks, `PascalCase.tsx` for components/screens
  - Variables/functions: `camelCase`
  - Types/interfaces: `PascalCase` — prefix interfaces with `I` only when there's a naming collision
  - Constants: `SCREAMING_SNAKE_CASE`
  - Enums: `PascalCase` enum name, `PascalCase` members
- **Imports:** Use absolute imports via path aliases (`@/components/...`, `@/utils/...`). Configure in tsconfig.

### React Native (Mobile)
- Functional components only. No class components.
- Use Zustand stores for global state. Use `useState`/`useReducer` for local component state.
- Keep screens thin — extract logic into custom hooks (`useXxx`) and business logic into plain TS files.
- All screens are **landscape-locked**. Design every layout accordingly.
- Use `StyleSheet.create()` — no inline style objects in JSX.
- Wrap all API calls in try/catch. Show user-friendly error toasts, log full errors to console.
- Never hardcode colors — use `@/constants/colors.ts` (clan colors, cottagecore palette).
- Never hardcode timing/XP values — use `@/constants/config.ts`.

### Minigames
- Each minigame lives in its own folder under `src/minigames/<game-name>/`.
- Separate rendering (`*Game.tsx`) from pure logic (`*Logic.ts`).
- Logic files must be fully testable with no React dependencies.
- Puzzles must be **procedurally generated** — never hardcoded boards/solutions.
- All minigames share the same `MinigameResult` type and report results through the same interface.
- Time limits run client-side for UX, but server records start timestamp and validates completion time.

### Backend (Lambda)
- One handler function per file. Keep handlers thin — extract business logic into shared modules.
- All DynamoDB operations go through `shared/db.ts` helper (wraps DocumentClient).
- Validate all incoming request bodies. Return 400 with clear error messages for bad input.
- Use Cognito JWT authorizer on API Gateway for player endpoints.
- Admin endpoints require additional `admin` group check on the JWT claims.
- All timestamps in ISO 8601 UTC. Convert to IST only on the client.
- Lambda environment variables for secrets (daily HMAC key, FCM server key). Never hardcode.

### Admin Dashboard (Web)
- React 18 + Vite + Tailwind CSS.
- Use React Query (TanStack Query) for data fetching/caching.
- Reuse the same API client types from `backend/shared/types.ts` (shared type package or copy).
- Responsive layout but optimized for desktop (admins use laptops).

---

## Key Business Rules (Quick Reference)

These are the most critical game rules. Claude Code must enforce these in the relevant Lambda handlers. **If in doubt, refer to the GDD.**

- **XP per win:** exactly 25. No bonuses, no modifiers.
- **Daily XP cap:** 100 per player (4 wins max).
- **Cooldown:** 5 minutes between minigame completions per player.
- **Location lock:** On minigame loss, that location is locked for that player until daily reset.
- **Daily reset:** 8:00 AM IST — clear all XP, clear all locks, assign new location sets.
- **Scoring:** 6:00 PM IST — freeze scores, compare clan totals, announce winner.
- **Tiebreaker:** Clan that reached the tied score first (earlier timestamp).
- **Streaks:** Increment on any game day with ≥1 win. Reset to 0 on game day with 0 XP. Non-game days don't affect streaks. **Streaks grant zero gameplay advantages.**
- **Asset expiry:** Unplaced assets expire at midnight IST on the day obtained. Placed assets are permanent.
- **Chest drop rate:** ~15% per win (admin-tunable).
- **Geofence radius:** 15–20m per location. QR scan + GPS both required.
- **Co-op:** Both players get 25 XP each (counts toward their individual 100 cap). Same clan only.

---

## API Contract Rules

- All endpoints return JSON.
- Success responses: `{ "success": true, "data": { ... } }`
- Error responses: `{ "success": false, "error": { "code": "INVALID_QR", "message": "..." } }`
- HTTP status codes: 200 (success), 400 (bad input), 401 (unauthorized), 403 (forbidden), 404 (not found), 429 (rate limited), 500 (server error).
- Paginated list endpoints use cursor-based pagination: `{ "data": [...], "nextCursor": "..." }`
- All request bodies validated with Zod schemas. Define schemas in `backend/shared/schemas/`.

---

## Testing Requirements

- **Minigame logic:** 100% unit test coverage on all `*Logic.ts` files. Test puzzle generation, win/loss detection, edge cases.
- **Backend handlers:** Test every Lambda handler with mocked DynamoDB. Test both success and error paths.
- **Anti-cheat:** Test HMAC validation, time range checks, rate limiting, geofence boundary conditions.
- **Affine transform:** Test `gpsToPixel` and `pixelToGps` with known calibration points. Test inverse accuracy.
- **No snapshot tests.** Use behavioral assertions only.

---

## Git Conventions

- **Branch naming:** `feature/<short-description>`, `fix/<short-description>`, `chore/<short-description>`
- **Commit messages:** Conventional Commits format: `feat: add grove words minigame`, `fix: GPS drift on map marker`, `chore: update dependencies`
- **PR scope:** One feature or fix per PR. Keep PRs small and reviewable.

---

## Build Phases (What to Build When)

Follow the phased plan in the GDD (Section 15). In summary:

1. **Phase 1 (Foundation):** RN project setup, AWS infra, auth, map rendering, GPS tracking, basic admin CRUD.
2. **Phase 2 (Core Loop):** QR system, first 3 minigames (Grove Words, Kindred, Stone Pairs), XP/scoring, cooldowns, locks, real-time scoreboard.
3. **Phase 3 (Territory):** 6 PM scoring Lambda, map overlays, daily reset, push notifications, capture celebration.
4. **Phase 4 (Content):** Remaining 9 minigames, co-op, chests, assets, decoration, tutorial, character creation, streaks.
5. **Phase 5 (Admin):** Full dashboard, analytics, notifications, season management, QR PDF generation.
6. **Phase 6 (Launch):** Testing, GPS calibration verification, load testing, soft launch.

**Always build the current phase's features before moving to the next.**

---

## Common Pitfalls to Avoid

- **Don't use Redux.** Use Zustand. It's simpler and sufficient for this app's state needs.
- **Don't ignore the 16px tile grid.** The campus map is built on a 16×16 tile grid (1920×1080 px total). All elements rendered ON the map (pins, markers, banners, overlays) must be 16px-aligned. Character sprites at 48×48 are for off-map screens only (profile, creation, scoreboard) — never render them on the map.
- **Don't use WidthType.PERCENTAGE** in any docx generation — it breaks in some viewers.
- **Don't store GPS data outside active gameplay.** Privacy requirement.
- **Don't hardcode IST offsets.** Use a timezone library (date-fns-tz or luxon) for all IST conversions.
- **Don't forget the affine transform.** GPS coordinates and pixel coordinates are in different spaces. Always transform before rendering on map.
- **Don't skip HMAC validation** on QR codes or minigame completion packets. This is the core anti-cheat.
- **Don't use `setTimeout` for game timers.** Use `Date.now()` deltas for accurate elapsed time tracking.
- **Don't build minigame UIs in portrait.** Everything is landscape-locked.
