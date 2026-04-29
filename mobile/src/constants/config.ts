export const XP_PER_WIN = 10;
export const GEOFENCE_RADIUS_DEFAULT = 15;
export const GAME_START_HOUR = 8;
export const GAME_END_HOUR = 18;
export const COMPLETION_SALT = 'grovewars-v1-completion-salt';
export const MAP_TILE_SIZE = 16;
export const MAP_WIDTH = 1920;
export const MAP_HEIGHT = 1080;
export const MIN_ASSIGNED_LOCATIONS = 3;
export const MAX_ASSIGNED_LOCATIONS = 5;

export const PLAYER_CODE_PREFIX = 'GRV';

// Pips (Snuff Out)
export const PIPS_GRID_SIZE = 5;
export const PIPS_TIME_LIMIT = 75;
export const PIPS_MOVE_BUFFER = 2;

// Number Grove (Mini Sudoku)
export const NUMBER_FILL_TIME_LIMIT = 90;

// Stone Pairs (Flip & Match)
export const STONE_PAIRS_TIME_LIMIT = 90;

// Firefly Flow (Connect the Dots)
export const FIREFLY_TIME_LIMIT = 90;

// Wordle
export const GROVE_WORDS_TIME_LIMIT = 120;

// Color Sort (Bead Sort)
export const COLOR_SORT_TIME_LIMIT = 90;

// Spot the Pattern (Bloom Sequence)
export const SPOT_THE_PATTERN_TIME_LIMIT = 60;

// Cipher Stones (Decode the Quote)
export const CIPHER_STONES_TIME_LIMIT = 150;

// Word Clusters
export const WORD_CLUSTERS_TIME_LIMIT = 180;

// Word Hunt (Vine Trail)
export const VINE_TRAIL_TIME_LIMIT = 180;

// Logic Grid (Potion Logic)
export const LOGIC_GRID_TIME_LIMIT = 150;

// Number Crunch (Grove Equations)
export const NUMBER_CRUNCH_TIME_LIMIT = 90;

/**
 * Tutorial practice location in campus-map pixel coordinates (2000×1125 reference).
 * Approximately the campus center. Admin can adjust the map layout around this point.
 */
export const TUTORIAL_LOCATION_PIXEL = { x: 980, y: 540 } as const;

export const TC_VERSION = '1.0.0';

export const DEV_CONFIG = {
  enabled: __DEV__,
  forceClan: 'bloom' as const,   // set to null to disable override
  forceClanEmail: 'YOUR_TEST_EMAIL_HERE',  // only override this specific email
};
