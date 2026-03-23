# CLAUDE.md - GroveWars Session Context

This is the repo-local quick context file for future coding sessions.

Source priority when details conflict:
1. `DESIGN_DOCUMENT.md` (source of truth, v2.0, last updated 2026-03-22)
2. This file
3. Older docs under `docs/` (some are stale)

## Product Summary

- GroveWars is a campus-based territory capture game and research instrument.
- Players physically visit real campus spaces, scan QR codes, play short puzzle minigames, and earn XP for their clan.
- At 6:00 PM IST each day, the clan with the highest `todayXp` captures the day's target space on the campus map.
- The visual direction is cottagecore / whimsical campus fantasy.

## Current Platforms and Stack

- Mobile: React Native for Android, landscape-locked
- Backend: AWS Lambda + API Gateway + DynamoDB, deployed via SAM
- Admin: React + Vite + Tailwind + Zustand + TanStack Query
- Real-time: API Gateway WebSocket
- Push: FCM via raw HTTPS

## Core Game Identity

- There are five clans: `ember`, `tide`, `bloom`, `gale`, `hearth`.
- Players authenticate through Google Sign-In / Firebase-backed verification and must exist in a pre-imported roster.
- Players choose their clan during onboarding; clan choice is permanent for the season.
- Players customize a pixel avatar and receive a unique `GRV`-prefixed player code for co-op matching.

## Daily Rhythm

- 8:00 AM IST: daily reset clears daily XP, clears player locks, generates fresh assignments, reverts boosted bonuses, and broadcasts `DAILY_RESET`.
- 8:00 AM to 6:00 PM IST: normal game hours.
- 6:00 PM IST: daily scoring picks the winning clan by `todayXp`; ties are broken by the earlier `todayXpTimestamp`.
- Around 11:59 PM IST: players with expiring unplaced assets receive expiry warnings.
- `quietMode` disables active gameplay for a day while preserving the daily config flow.

## Assignment and QR Rules

- Each player gets 3 to 5 assigned locations per day.
- Assignment is cluster-aware and weighted by location classification, rotation history, adjacency constraints, and co-op chances.
- QR validation flow is: HMAC/authenticity -> active location -> today's active list -> geofence -> assignment membership -> lock check -> daily cap -> session cleanup/minigame roll.
- Default geofence radius is 15 meters.
- Losing a minigame creates a location lock for that player until the next 8:00 AM IST reset.
- Players can keep playing after hitting the daily cap, but capped sessions are practice-only and award no XP.

## Minigames and Co-op

- Current design target is 15 solo minigames and 6 co-op variants.
- Server-generated puzzle data is required for `mosaic`, `path-weaver`, `grove-equations`, `bloom-sequence`, `shift-slide`, and `pips`.
- `start-minigame` creates the session, salt, and puzzle payload; `complete-minigame` verifies timing, completion hash, and puzzle correctness.
- Co-op is triggered by `coopOnly` locations or `coopLocationIds` in a player's assignment.
- Partner lookup uses display name or `GRV` player code.
- Cross-clan co-op is allowed; both players receive rewards independently and both clans receive the resulting XP.

## Economy and Territory Rules

- Base XP per win is 25.
- Bonus XP can also come from location modifiers or admin boosts.
- Daily XP cap is 100 per player.
- XP updates to clans must be atomic.
- XP-earning wins always drop a chest.
- Co-op chest odds are better than solo chest odds.
- Non-permanent unplaced assets expire at midnight IST; placed assets are safe.
- Clan members can decorate captured territories by placing earned assets on a grid.

## Research and Analytics

- Free-roam check-ins collect activity type, duration, satisfaction, sentiment, time, and location data.
- After a minigame, players answer whether they would return to the space without the game.
- Game sessions also track dwell time and leave reason.
- Player clustering feeds back into assignment weights as part of the research loop.
- Key analytics outputs include location analytics, free-roam analytics, cluster analytics, session exports, capture history, and assignment audit trails.

## Data and Security Notes

- The current design references 19 DynamoDB tables, including `users`, `clans`, `locations`, `daily-config`, `player-assignments`, `game-sessions`, `player-locks`, `captured-spaces`, `asset-catalog`, `player-assets`, `space-decorations`, `checkins`, `location-master-config`, `cluster-weight-config`, and `clustering-runs`.
- Security model relies on QR HMAC validation, geofencing, server-side timing, completion hashes, atomic XP updates, JWT-protected APIs, and admin claim checks.

## Tutorial System

- Tutorial is an 8-slide image-backed onboarding flow with character creation and a practice minigame map scene.
- Implemented as 9 scenes (index 0–8): 6 TutorialSlide scenes, 1 character creation, 1 map+minigame, 1 map outro.
- Tutorial images: `mobile/src/assets/tutorial/tutorialAssets.ts` — s1–s8 PNG files placed by developer.
- Scene 4 (s5) is clan-specific: `s5_red/blue/yellow/green/purple.png` keyed by `ember/tide/bloom/gale/hearth`.
- Skip button on slides 0–5 jumps to character creation (scene 6) then calls `setTutorialDone()` on completion.
- `tutorialDone` is persisted to AsyncStorage and backed by backend endpoint `PUT /player/tutorialDone` (TODO: wire backend).
- Replayable from Settings → Game → "Replay Tutorial" which calls `useAuthStore.getState().resetTutorial()`.
- Scene-level components: `TutorialSlide`, `TutorialCharacterScene`, `TutorialMapScene`, `TutorialMapOutroScene`.
- Legacy components kept (NarratorCard, SceneBackground, MossPortrait, MossDialogueBox, etc.) for future use.

## Implementation Cautions

- Older docs under `docs/` are not fully current. Re-check `DESIGN_DOCUMENT.md` before enforcing business rules from older summaries.
- Known drift in legacy docs includes auth details, orientation notes, chest drop rules, co-op rules, and some older clan/content assumptions.
