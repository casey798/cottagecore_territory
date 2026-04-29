# GroveWars

A campus-based territory capture game and research instrument. Players physically visit real campus spaces, scan QR codes, play short puzzle minigames, and earn XP for their clan. At 6:00 PM IST each day, the clan with the highest daily XP captures the day's target space on the campus map.

Visual direction: **cottagecore / whimsical campus fantasy**.

---

## Platforms & Stack

| Layer | Tech |
|-------|------|
| Mobile | React Native (Android, landscape-locked) |
| Backend | AWS Lambda + API Gateway + DynamoDB (SAM) |
| Admin | React + Vite + Tailwind CSS + Zustand + TanStack Query |
| Real-time | API Gateway WebSocket |
| Push | FCM via raw HTTPS |

---

## Project Structure

```
cottagecore_territory/
├── mobile/          # React Native Android app
├── backend/         # AWS SAM serverless backend
└── admin/           # React web admin dashboard
```

### Mobile (`mobile/`)
React Native app for Android. Handles authentication, map exploration, QR scanning, minigame play, territory decoration, and the tutorial flow.

### Backend (`backend/`)
AWS SAM project with Lambda functions organized by domain:

- `functions/auth/` — Sign-up, login, Cognito custom auth
- `functions/game/` — QR scan, start/complete minigame, space QR, decoration submission
- `functions/admin/` — Location CRUD, roster import, daily config, analytics, space management, exports
- `functions/scheduled/` — Daily reset (8 AM IST), daily scoring (6 PM IST), asset expiry, nudge notifications
- `functions/spaces/` — Player decoration queries
- `shared/` — Types, DynamoDB helpers, auth, HMAC, geo, time utilities
- `scripts/` — Operational one-off scripts (roster checks, quiet mode, session revocation, etc.)

### Admin (`admin/`)
Web dashboard for researchers and game operators. Covers location management, roster import, daily config, QR generation, analytics, spaces management, and decoration viewer.

---

## Core Game Rules

- **5 clans**: `ember`, `tide`, `bloom`, `gale`, `hearth`
- **XP per win**: 25 base
- **Daily XP cap**: 100 per player (4 wins)
- **Daily reset**: 8:00 AM IST — clears daily XP, player locks, generates assignments
- **Daily scoring**: 6:00 PM IST — clan with highest `todayXp` captures the target space; ties broken by earliest `todayXpTimestamp`
- **Location lock on loss** — locked until next 8 AM IST reset
- **Co-op**: Cross-clan allowed; both players and both clans receive rewards independently

---

## Getting Started

### Backend
```bash
cd backend
npm install
# Deploy (dev)
sam build && sam deploy --config-env dev
```

### Mobile
```bash
cd mobile
npm install
npx react-native run-android
```

### Admin
```bash
cd admin
npm install
npm run dev
```

---

## Environment

- AWS Region: `ap-south-1` (Mumbai)
- All timestamps: ISO 8601 UTC in DynamoDB
- Timezone logic: always `Asia/Kolkata` via `date-fns-tz`

---

## Documentation

- [`DESIGN_DOCUMENT.md`](./DESIGN_DOCUMENT.md) — Source of truth for game design and business rules (v2.0)
- [`PRESENTATION_REFERENCE.md`](./PRESENTATION_REFERENCE.md) — Presentation reference guide
- [`CLAUDE.md`](./CLAUDE.md) — Session context for AI-assisted development
