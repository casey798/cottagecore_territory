export const XP_PER_WIN = 25;
export const DAILY_XP_CAP = 100;
export const GEOFENCE_RADIUS_DEFAULT = 15;
export const GAME_START_HOUR = 8;
export const GAME_END_HOUR = 18;
export const CHEST_DROP_RATE = 0.15;
export const COMPLETION_SALT = 'grovewars-v1-completion-salt';
export const MAP_TILE_SIZE = 32;
export const MAP_WIDTH = 2000;
export const MAP_HEIGHT = 1125;
export const MIN_ASSIGNED_LOCATIONS = 3;
export const MAX_ASSIGNED_LOCATIONS = 5;

export const DEV_CONFIG = {
  enabled: __DEV__,
  forceClan: 'bloom' as const,   // set to null to disable override
  forceClanEmail: 'YOUR_TEST_EMAIL_HERE',  // only override this specific email
};
