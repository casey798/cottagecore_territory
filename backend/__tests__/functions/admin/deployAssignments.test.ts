import { scoreLocationForUser } from '../../../shared/weightedAssignment';
import type { User, LocationMasterConfig, ClusterWeightConfig, Phase1Cluster } from '../../../shared/types';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'test-user',
    email: 'test@test.com',
    displayName: 'Test',
    clan: 'ember' as any,
    avatarConfig: { hairStyle: 0, hairColor: 0, skinTone: 0, outfit: 0, accessory: 0 },
    todayXp: 0,
    seasonXp: 0,
    totalWins: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastActiveDate: '',
    tutorialDone: true,
    fcmToken: '',
    playerCode: '',
    createdAt: '',
    ...overrides,
  };
}

function makeLocation(overrides: Partial<LocationMasterConfig> = {}): LocationMasterConfig {
  return {
    locationId: 'loc-1',
    qrNumber: 1,
    name: 'Test Location',
    gpsLat: 10,
    gpsLng: 78,
    geofenceRadius: 15,
    mapPixelX: 100,
    mapPixelY: 100,
    normalizedX: 0.1,
    normalizedY: 0.1,
    floor: 'ground',
    classification: 'Social Hub',
    sdtDeficit: 5,
    priorityTier: null,
    phase1Visits: 10,
    phase1Satisfaction: 0.7,
    phase1DominantCluster: null,
    isNewSpace: false,
    active: true,
    chestDropModifier: 1.0,
    firstVisitBonus: false,
    coopOnly: false,
    bonusXP: false,
    spaceFact: null,
    minigameAffinity: null,
    linkedTo: null,
    notes: '',
    lastActiveDate: null,
    totalPhase2GameSessions: 0,
    totalPhase2FreeRoamCheckins: 0,
    avgPhase2Satisfaction: null,
    last3DaysVisits: [0, 0, 0],
    ...overrides,
  } as LocationMasterConfig;
}

const clusterConfig: ClusterWeightConfig = {
  configId: 'current',
  weights: {
    nomad:      { 'Social Hub': 0.5, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 3.0, 'Dead Zone': 3.0, 'Unvisited': 5.0 },
    seeker:     { 'Social Hub': 1.0, 'Transit / Forced Stay': 0.5, 'Hidden Gem': 5.0, 'Dead Zone': 1.0, 'Unvisited': 2.0 },
    drifter:    { 'Social Hub': 3.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.0, 'Dead Zone': 0.5, 'Unvisited': 0.5 },
    forced:     { 'Social Hub': 1.5, 'Transit / Forced Stay': 3.0, 'Hidden Gem': 1.5, 'Dead Zone': 0.5, 'Unvisited': 0.3 },
    disengaged: { 'Social Hub': 2.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 0.5, 'Dead Zone': 0.3, 'Unvisited': 0.3 },
    null:       { 'Social Hub': 1.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.0, 'Dead Zone': 1.0, 'Unvisited': 1.0 },
  },
  badPairings: {
    nomad: [], seeker: [], drifter: [], forced: [], disengaged: [],
  },
  assignmentCounts: {
    nomad: 5, seeker: 5, drifter: 4, forced: 4, disengaged: 3, null: 4,
  },
  updatedAt: '',
  updatedBy: '',
};

const emptyBadPairings = new Map<Phase1Cluster, Set<string>>();

describe('Weighted Assignment - cluster priority', () => {
  it('computedCluster takes priority over phase1Cluster', () => {
    const user = makeUser({
      phase1Cluster: 'drifter',
      computedCluster: 'nomad',
    });
    const loc = makeLocation({ classification: 'Social Hub' });

    const score = scoreLocationForUser(user, loc, 0, false, clusterConfig, emptyBadPairings);
    // nomad weight for Social Hub = 0.5, rotation 2.5 (never assigned in window)
    expect(score).toBeCloseTo(0.5 * 2.5, 5);
  });

  it('null computedCluster with valid phase1Cluster uses phase1Cluster', () => {
    const user = makeUser({
      phase1Cluster: 'seeker',
      computedCluster: null,
    });
    const loc = makeLocation({ classification: 'Hidden Gem' });

    const score = scoreLocationForUser(user, loc, 0, false, clusterConfig, emptyBadPairings);
    // seeker weight for Hidden Gem = 5.0, rotation 2.5
    expect(score).toBeCloseTo(5.0 * 2.5, 5);
  });

  it('both null uses flat weights', () => {
    const user = makeUser({
      phase1Cluster: null,
      computedCluster: undefined,
    });
    const loc = makeLocation({ classification: 'Dead Zone' });

    const score = scoreLocationForUser(user, loc, 0, false, clusterConfig, emptyBadPairings);
    // null weight for Dead Zone = 1.0, rotation 2.5
    expect(score).toBeCloseTo(1.0 * 2.5, 5);
  });

  it('rotation modifier works correctly with new stepped values', () => {
    const user = makeUser({ computedCluster: 'drifter' });
    const loc = makeLocation({ classification: 'Social Hub' });

    // drifter weight for Social Hub = 3.0
    // count 0 → 2.5x, count 1 → 1.2x, count 2 → 0.8x, count 3+ → 0.5x
    expect(scoreLocationForUser(user, loc, 0, false, clusterConfig, emptyBadPairings)).toBeCloseTo(3.0 * 2.5, 5);
    expect(scoreLocationForUser(user, loc, 1, false, clusterConfig, emptyBadPairings)).toBeCloseTo(3.0 * 1.2, 5);
    expect(scoreLocationForUser(user, loc, 2, false, clusterConfig, emptyBadPairings)).toBeCloseTo(3.0 * 0.8, 5);
    expect(scoreLocationForUser(user, loc, 5, false, clusterConfig, emptyBadPairings)).toBeCloseTo(3.0 * 0.5, 5);
  });

  it('visit-response modifier penalizes assigned-but-never-played', () => {
    const user = makeUser({ computedCluster: 'drifter' });
    const loc = makeLocation({ classification: 'Social Hub' });

    const normalScore = scoreLocationForUser(user, loc, 1, false, clusterConfig, emptyBadPairings);
    const penalizedScore = scoreLocationForUser(user, loc, 1, true, clusterConfig, emptyBadPairings);

    expect(penalizedScore).toBeCloseTo(normalScore * 0.5, 5);
  });
});
