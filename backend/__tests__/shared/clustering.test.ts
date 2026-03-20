import {
  computePlayerClusters,
  kMeansPlusPlusInit,
  lloyds,
  mapCentroidsToLabels,
  toFeatureArray,
  normalize,
  computeNormParams,
} from '../../shared/clustering';
import type { PlayerFeatureVector, Phase1Cluster } from '../../shared/types';

function makePlayer(
  userId: string,
  overrides: Partial<Omit<PlayerFeatureVector, 'userId'>> = {},
): PlayerFeatureVector {
  return {
    userId,
    visits: 5,
    avg_duration: 30,
    avg_satisfaction: 0.65,
    unique_spaces: 3,
    space_diversity: 2,
    pct_morning: 0.4,
    pct_he_social: 0.1,
    pct_he_personal: 0.2,
    pct_le_social: 0.3,
    pct_le_personal: 0.1,
    pct_social_hub: 0.3,
    pct_transit: 0.2,
    pct_hidden_gem: 0.2,
    pct_dead_zone: 0.1,
    ...overrides,
  };
}

// Create a synthetic dataset with 5 well-separated clusters
function makeSyntheticDataset(): PlayerFeatureVector[] {
  const players: PlayerFeatureVector[] = [];

  // Nomads: high visits, high unique_spaces, high satisfaction
  for (let i = 0; i < 10; i++) {
    players.push(makePlayer(`nomad-${i}`, {
      visits: 20 + Math.random() * 5,
      unique_spaces: 15 + Math.random() * 3,
      avg_satisfaction: 0.75 + Math.random() * 0.15,
      space_diversity: 4 + Math.random(),
      pct_social_hub: 0.15,
      pct_transit: 0.15,
      pct_hidden_gem: 0.3,
      pct_dead_zone: 0.1,
    }));
  }

  // Seekers: high pct_hidden_gem
  for (let i = 0; i < 10; i++) {
    players.push(makePlayer(`seeker-${i}`, {
      visits: 8 + Math.random() * 4,
      pct_hidden_gem: 0.75 + Math.random() * 0.15,
      pct_social_hub: 0.05,
      pct_transit: 0.05,
      pct_dead_zone: 0.05,
      pct_le_personal: 0.35,
    }));
  }

  // Drifters: high pct_social_hub
  for (let i = 0; i < 10; i++) {
    players.push(makePlayer(`drifter-${i}`, {
      visits: 6 + Math.random() * 3,
      pct_social_hub: 0.6 + Math.random() * 0.15,
      pct_transit: 0.1,
      pct_hidden_gem: 0.1,
      pct_dead_zone: 0.05,
    }));
  }

  // Forced: high pct_transit, high avg_duration
  for (let i = 0; i < 10; i++) {
    players.push(makePlayer(`forced-${i}`, {
      visits: 5 + Math.random() * 2,
      avg_duration: 90 + Math.random() * 30,
      pct_transit: 0.85 + Math.random() * 0.1,
      pct_social_hub: 0.03,
      pct_hidden_gem: 0.02,
      pct_dead_zone: 0.02,
    }));
  }

  // Disengaged: high pct_dead_zone, low satisfaction
  for (let i = 0; i < 10; i++) {
    players.push(makePlayer(`disengaged-${i}`, {
      visits: 2 + Math.random() * 2,
      avg_satisfaction: 0.3 + Math.random() * 0.15,
      pct_dead_zone: 0.7 + Math.random() * 0.15,
      pct_social_hub: 0.05,
      pct_transit: 0.05,
      pct_hidden_gem: 0.05,
    }));
  }

  return players;
}

describe('K-Means Clustering', () => {
  describe('kMeansPlusPlusInit', () => {
    it('produces exactly k=5 distinct initial centroids', () => {
      const data = makeSyntheticDataset().map(toFeatureArray);
      const normParams = computeNormParams(data);
      const normalized = data.map((row) => normalize(row, normParams));

      const centroids = kMeansPlusPlusInit(normalized);
      expect(centroids).toHaveLength(5);

      // Verify centroids are distinct
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          const same = centroids[i].every((v, idx) => v === centroids[j][idx]);
          expect(same).toBe(false);
        }
      }
    });
  });

  describe('computePlayerClusters', () => {
    it('converges on a synthetic 50-player dataset with clear cluster separation', () => {
      const players = makeSyntheticDataset();
      const result = computePlayerClusters(players);

      expect(Object.keys(result.assignments)).toHaveLength(50);
      expect(result.centroids).toHaveLength(5);
      expect(result.withinClusterVariance).toBeGreaterThanOrEqual(0);

      // All 5 labels should be assigned
      const labels = new Set(Object.values(result.assignments));
      expect(labels.size).toBe(5);
    });

    it('assigns all players when fewer than k players exist', () => {
      const players = [
        makePlayer('a'),
        makePlayer('b'),
        makePlayer('c'),
      ];
      const result = computePlayerClusters(players);

      expect(Object.keys(result.assignments)).toHaveLength(3);
      // All get drifter when < k
      expect(result.assignments['a']).toBe('drifter');
    });

    it('runs without error with only 1 day of data (small dataset)', () => {
      const players = [
        makePlayer('u1', { visits: 1, unique_spaces: 1 }),
        makePlayer('u2', { visits: 2, unique_spaces: 1 }),
        makePlayer('u3', { visits: 1, unique_spaces: 1 }),
        makePlayer('u4', { visits: 3, unique_spaces: 2 }),
        makePlayer('u5', { visits: 1, unique_spaces: 1 }),
      ];
      const result = computePlayerClusters(players);
      expect(Object.keys(result.assignments)).toHaveLength(5);
    });
  });

  describe('centroid-to-label mapping', () => {
    it('assigns forced to centroid with pct_transit=0.90', () => {
      // Build 5 raw centroids where centroid 2 has high transit
      const rawCentroids = [
        // [visits, avg_dur, avg_sat, unique, diversity, pct_morn, he_soc, he_per, le_soc, le_per, soc_hub, transit, hid_gem, dead_zone]
        [10, 30, 0.7, 8, 3, 0.3, 0.1, 0.2, 0.1, 0.1, 0.3, 0.1, 0.1, 0.1],  // generic
        [5, 25, 0.5, 3, 2, 0.3, 0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],   // generic
        [4, 85, 0.5, 3, 1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.02, 0.90, 0.02, 0.02], // forced
        [3, 20, 0.4, 2, 1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.5],   // disengaged-ish
        [6, 30, 0.6, 4, 2, 0.3, 0.1, 0.1, 0.1, 0.1, 0.5, 0.1, 0.1, 0.1],   // drifter-ish
      ];
      // Normalized centroids (for comparison) — same structure for simplicity
      const normCentroids = rawCentroids.map((r) => [...r]);
      // Normalize visits and unique_spaces to [0,1] range
      const maxV = 10; const maxU = 8;
      for (const row of normCentroids) {
        row[0] /= maxV; row[1] = Math.min(row[1], 180) / 180; row[3] /= maxU; row[4] /= 5;
      }

      const mapping = mapCentroidsToLabels(normCentroids, rawCentroids);
      expect(mapping[2]).toBe('forced');
    });

    it('assigns seeker to centroid with pct_hidden_gem=0.75', () => {
      const rawCentroids = [
        [10, 30, 0.7, 8, 3, 0.3, 0.1, 0.2, 0.1, 0.1, 0.3, 0.1, 0.1, 0.1],
        [5, 25, 0.6, 5, 2, 0.3, 0.1, 0.2, 0.1, 0.3, 0.05, 0.05, 0.75, 0.05], // seeker
        [4, 85, 0.5, 3, 1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.02, 0.9, 0.02, 0.02],
        [3, 20, 0.4, 2, 1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.5],
        [6, 30, 0.6, 4, 2, 0.3, 0.1, 0.1, 0.1, 0.1, 0.5, 0.1, 0.1, 0.1],
      ];
      const normCentroids = rawCentroids.map((r) => [...r]);
      const maxV = 10; const maxU = 8;
      for (const row of normCentroids) {
        row[0] /= maxV; row[1] = Math.min(row[1], 180) / 180; row[3] /= maxU; row[4] /= 5;
      }

      const mapping = mapCentroidsToLabels(normCentroids, rawCentroids);
      expect(mapping[1]).toBe('seeker');
    });

    it('resolves collision: two centroids both match seeker, stronger wins', () => {
      const rawCentroids = [
        [10, 30, 0.7, 10, 4, 0.3, 0.1, 0.2, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1],
        [5, 25, 0.6, 5, 2, 0.3, 0.1, 0.2, 0.1, 0.3, 0.05, 0.05, 0.80, 0.05], // stronger seeker
        [4, 30, 0.6, 4, 2, 0.2, 0.1, 0.1, 0.1, 0.3, 0.05, 0.05, 0.72, 0.05], // weaker seeker
        [3, 20, 0.4, 2, 1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.5],
        [6, 30, 0.6, 4, 2, 0.3, 0.1, 0.1, 0.1, 0.1, 0.5, 0.1, 0.1, 0.1],
      ];
      const normCentroids = rawCentroids.map((r) => [...r]);
      const maxV = 10; const maxU = 10;
      for (const row of normCentroids) {
        row[0] /= maxV; row[1] = Math.min(row[1], 180) / 180; row[3] /= maxU; row[4] /= 5;
      }

      const mapping = mapCentroidsToLabels(normCentroids, rawCentroids);
      expect(mapping[1]).toBe('seeker');
      // Centroid 2 should NOT be seeker — it falls to a later label
      expect(mapping[2]).not.toBe('seeker');
    });

    it('disengaged fallback: if no centroid passes disengaged rule, assigns to lowest sat + highest dead zone', () => {
      // No centroid has pct_dead_zone > 0.65 AND avg_satisfaction < 0.55
      const rawCentroids = [
        [15, 30, 0.75, 12, 4, 0.3, 0.1, 0.2, 0.1, 0.1, 0.2, 0.1, 0.2, 0.1],
        [5, 25, 0.6, 5, 2, 0.3, 0.1, 0.2, 0.1, 0.3, 0.05, 0.05, 0.72, 0.05],
        [4, 85, 0.5, 3, 1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.02, 0.85, 0.02, 0.02],
        [3, 20, 0.55, 2, 1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.4],  // candidate for disengaged fallback
        [6, 30, 0.7, 4, 2, 0.3, 0.1, 0.1, 0.1, 0.1, 0.5, 0.1, 0.1, 0.05],
      ];
      const normCentroids = rawCentroids.map((r) => [...r]);
      const maxV = 15; const maxU = 12;
      for (const row of normCentroids) {
        row[0] /= maxV; row[1] = Math.min(row[1], 180) / 180; row[3] /= maxU; row[4] /= 5;
      }

      const mapping = mapCentroidsToLabels(normCentroids, rawCentroids);

      // Verify disengaged is assigned
      const labels = Object.values(mapping);
      expect(labels).toContain('disengaged');
    });
  });
});
