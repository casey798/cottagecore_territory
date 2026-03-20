// ── Weighted Assignment Constants ────────────────────────────────────

/** Radius in meters for spatial adjacency exclusion between locations */
export const ADJACENCY_EXCLUSION_RADIUS_METERS = 15;

/** Number of IST calendar days to look back for rotation and visit-response history */
export const ROTATION_HISTORY_WINDOW_DAYS = 3;

/**
 * Rotation modifier step function — applied per location based on how many
 * times the player was assigned that location within the rolling window.
 *
 * With 27 active locations and 4-5 assigned per day, a 3-day window means
 * ~12-15 unique locations seen. Locations assigned 4+ days ago reset to
 * count=0 (fully fresh).
 */
export const ROTATION_MODIFIER_COUNT_0 = 2.5;       // never assigned recently — strongly prefer
export const ROTATION_MODIFIER_COUNT_1 = 1.2;       // assigned once — mild preference to vary
export const ROTATION_MODIFIER_COUNT_2 = 0.8;       // assigned 2 of last 3 days — mild penalty
export const ROTATION_MODIFIER_COUNT_3_PLUS = 0.5;  // assigned every day — strong penalty, not zero
