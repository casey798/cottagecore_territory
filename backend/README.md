# GroveWars Backend

## First-time setup

Run `npm run seed:assets` once after deploying to a new stage to populate the asset catalog. Safe to re-run — skips existing assets.

```bash
# Dev (default)
npm run seed:assets

# Production
STAGE=prod npm run seed:assets
```
