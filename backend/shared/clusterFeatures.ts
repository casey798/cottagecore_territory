import type {
  PlayerFeatureVector,
  GameSession,
  PlayerAssignment,
  LocationMasterConfig,
  GameResult,
  LocationClassification,
} from './types';
import { toZonedTime } from 'date-fns-tz';

/**
 * Build feature vectors for clustering from game session and assignment data.
 *
 * Engagement type derivation (no engagementType field on LocationMasterConfig):
 *   HE (High Effort) = chestDropModifier >= 1.3
 *   LE (Low Effort)   = chestDropModifier <= 0.8
 *   Mid-range (0.8 < x < 1.3) is split evenly as 0.5 HE + 0.5 LE contribution
 *
 *   Social   = category in (courtyard, garden) — inferred from classification:
 *              'Social Hub' → Social, 'Hidden Gem' → Personal,
 *              'Transit / Forced Stay' → Personal, 'Dead Zone' → Personal,
 *              'Unvisited' → Personal, 'TBD' → Personal
 *   Personal = everything else
 *
 * Users with zero completed sessions in the window return null.
 */
export function buildFeatureVectors(
  userIds: string[],
  sessionsByUser: Map<string, GameSession[]>,
  assignmentsByUser: Map<string, PlayerAssignment[]>,
  locationConfigs: Map<string, LocationMasterConfig>,
  _windowDays: number,
): (PlayerFeatureVector | null)[] {
  return userIds.map((userId) => {
    const sessions = sessionsByUser.get(userId) ?? [];

    // Only count completed sessions (have a completedAt)
    const completed = sessions.filter((s) => s.completedAt != null);
    if (completed.length === 0) return null;

    const visits = completed.length;

    // avg_duration in minutes
    let totalDuration = 0;
    for (const s of completed) {
      const start = new Date(s.startedAt).getTime();
      const end = new Date(s.completedAt!).getTime();
      totalDuration += (end - start) / 60000; // ms → minutes
    }
    const avg_duration = totalDuration / visits;

    // avg_satisfaction: use spaceSentiment if available, else proxy from result
    let totalSat = 0;
    for (const s of completed) {
      if (s.spaceSentiment != null) {
        // spaceSentiment: 'yes'=1.0, 'maybe'=0.5, 'no'=0.0
        totalSat += s.spaceSentiment === 'yes' ? 1.0 : s.spaceSentiment === 'maybe' ? 0.5 : 0.0;
      } else {
        // Proxy from game result
        switch (s.result) {
          case 'win' as GameResult: totalSat += 1.0; break;
          case 'lose' as GameResult: totalSat += 0.4; break;
          case 'timeout' as GameResult: totalSat += 0.2; break;
          default: totalSat += 0.0;
        }
      }
    }
    const avg_satisfaction = totalSat / visits;

    // unique_spaces
    const locationIds = new Set<string>();
    for (const s of completed) locationIds.add(s.locationId);
    const unique_spaces = locationIds.size;

    // space_diversity — count of distinct location classifications
    const classifications = new Set<string>();
    for (const locId of locationIds) {
      const loc = locationConfigs.get(locId);
      if (loc && loc.classification !== 'TBD') {
        classifications.add(loc.classification);
      }
    }
    const space_diversity = classifications.size;

    // pct_morning: sessions where startedAt hour (IST) is 06:00–12:00
    let morningCount = 0;
    for (const s of completed) {
      const istDate = toZonedTime(new Date(s.startedAt), 'Asia/Kolkata');
      const hour = istDate.getHours();
      if (hour >= 6 && hour < 12) morningCount++;
    }
    const pct_morning = morningCount / visits;

    // Engagement type counts
    let he_social = 0;
    let he_personal = 0;
    let le_social = 0;
    let le_personal = 0;

    // Classification counts
    const classCount: Record<string, number> = {};

    for (const s of completed) {
      const loc = locationConfigs.get(s.locationId);
      if (!loc) continue;

      // Count classification
      const cls = loc.classification;
      classCount[cls] = (classCount[cls] || 0) + 1;

      // Determine effort level
      const isHE = loc.chestDropModifier >= 1.3;
      const isLE = loc.chestDropModifier <= 0.8;

      // Determine social/personal from classification
      const isSocial = cls === 'Social Hub';

      if (isHE && isSocial) he_social++;
      else if (isHE && !isSocial) he_personal++;
      else if (isLE && isSocial) le_social++;
      else if (isLE && !isSocial) le_personal++;
      else {
        // Mid-range: split 0.5 each way
        if (isSocial) {
          he_social += 0.5;
          le_social += 0.5;
        } else {
          he_personal += 0.5;
          le_personal += 0.5;
        }
      }
    }

    const pct_he_social = he_social / visits;
    const pct_he_personal = he_personal / visits;
    const pct_le_social = le_social / visits;
    const pct_le_personal = le_personal / visits;

    const pct_social_hub = (classCount['Social Hub'] || 0) / visits;
    const pct_transit = (classCount['Transit / Forced Stay'] || 0) / visits;
    const pct_hidden_gem = (classCount['Hidden Gem'] || 0) / visits;
    const pct_dead_zone = (classCount['Dead Zone'] || 0) / visits;

    return {
      userId,
      visits,
      avg_duration,
      avg_satisfaction,
      unique_spaces,
      space_diversity,
      pct_morning,
      pct_he_social,
      pct_he_personal,
      pct_le_social,
      pct_le_personal,
      pct_social_hub,
      pct_transit,
      pct_hidden_gem,
      pct_dead_zone,
    };
  });
}
