export interface CalibrationPoint {
  gpsLat: number;
  gpsLng: number;
  pixelX: number;
  pixelY: number;
}

export interface AffineMatrix {
  a: number;
  b: number;
  tx: number;
  c: number;
  d: number;
  ty: number;
}

export interface Location {
  locationId: string;
  name: string;
  gpsLat: number;
  gpsLng: number;
  geofenceRadius: number;
  category: LocationCategory;
  active: boolean;
  chestDropModifier: number;
  notes?: string;
  coopOnly?: boolean;
}

export type LocationCategory =
  | 'courtyard'
  | 'corridor'
  | 'garden'
  | 'classroom'
  | 'other';

export interface ClanScore {
  clanId: ClanId;
  todayXp: number;
  seasonXp: number;
  spacesCaptured: number;
}

export type ClanId = 'ember' | 'tide' | 'bloom' | 'gale' | 'hearth';

export interface DailyConfig {
  date: string;
  activeLocationIds: string[];
  targetSpace: {
    name: string;
    description: string;
    mapOverlayId: string;
    polygonPoints?: Array<{ x: number; y: number }>;
    gridCells?: Array<{ x: number; y: number }>;
  };
  status: 'active' | 'scoring' | 'complete';
  winnerClan?: string;
  qrSecret?: string;
  quietMode?: boolean;
}

export interface MapConfig {
  mapImageUrl: string;
  mapImageKey?: string;
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  transformMatrix: AffineMatrix;
}

export interface MapCalibration {
  calibrationId: string;
  mapImageKey: string;
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  points: CalibrationPoint[];
  transformMatrix: AffineMatrix;
  active: boolean;
  createdAt: string;
}

export interface RosterImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface Notification {
  notificationId: string;
  message: string;
  target: 'all' | ClanId;
  notificationType: 'event' | 'alert' | 'hype' | 'info';
  sentAt: string;
  sentBy: string;
  deliveryCount: number;
  status?: 'sent' | 'scheduled' | 'failed' | 'cancelled';
  scheduledFor?: string;
}

export type LocationClassification =
  | 'Social Hub'
  | 'Transit / Forced Stay'
  | 'Hidden Gem'
  | 'Dead Zone'
  | 'Unvisited'
  | 'TBD';

export interface LocationMasterConfig {
  locationId: string;
  qrNumber: number;
  name: string;
  gpsLat: number;
  gpsLng: number;
  geofenceRadius: number;
  mapPixelX: number;
  mapPixelY: number;
  normalizedX: number;
  normalizedY: number;
  floor: string;
  classification: LocationClassification;
  sdtDeficit: number;
  priorityTier: 'P1-Critical' | 'P1-Seed' | 'P2-High' | 'P3-Medium' | null;
  phase1Visits: number;
  phase1Satisfaction: number | null;
  phase1DominantCluster: string | null;
  isNewSpace: boolean;
  active: boolean;
  chestDropModifier: number;
  firstVisitBonus: boolean;
  coopOnly: boolean;
  bonusXP: boolean;
  spaceFact: string | null;
  minigameAffinity: string[] | null;
  linkedTo: string | null;
  notes: string;
  lastActiveDate: string | null;
  totalPhase2GameSessions: number;
  totalPhase2FreeRoamCheckins: number;
  avgPhase2Satisfaction: number | null;
  last3DaysVisits: [number, number, number];
  qrSecret?: string;
  qrGeneratedAt?: string;
  qrImageBase64?: string;
  qrPayload?: string;
}

export interface ClusterWeights {
  'Social Hub': number;
  'Transit / Forced Stay': number;
  'Hidden Gem': number;
  'Dead Zone': number;
  'Unvisited': number;
}

export type Phase1Cluster = 'nomad' | 'seeker' | 'drifter' | 'forced' | 'disengaged';

export interface ClusterWeightConfig {
  configId: 'current';
  weights: Record<Phase1Cluster | 'null', ClusterWeights>;
  badPairings: Record<Phase1Cluster, string[]>;
  assignmentCounts: Record<Phase1Cluster | 'null', number>;
  coopChances?: Record<string, number>;
  updatedAt: string;
  updatedBy: string;
}

export interface ClusterWeightUpdatePayload {
  weights: Record<string, Record<string, number>>;
  badPairings: Record<string, number[]>;
  assignmentCounts: Record<string, number>;
  coopChances?: Record<string, number>;
}

export interface ClusteringRunResult {
  date: string;
  totalPlayers: number;
  clusterCounts: Record<Phase1Cluster, number>;
  noDataPlayers: number;
  withinClusterVariance: number;
  featureWindowActual: number;
  labelMapping: Record<number, Phase1Cluster>;
  computedAt: string;
  expiresAt: number;
}

export interface SuggestedLocation {
  locationId: string;
  qrNumber: number;
  name: string;
  classification: LocationClassification;
  score: number;
  included: boolean;
  warning?: string;
  recentDailyAverage?: number;
  last3DaysVisits?: [number, number, number];
  clusterDemand?: Record<string, number>;
}

export interface SuggestedPoolResponse {
  date: string;
  suggestions: SuggestedLocation[];
}

export interface DeployResult {
  totalUsers: number;
  assigned: number;
  failed: number;
  date: string;
  quietModeWarning?: boolean;
  message?: string;
}

export interface ScheduleEntry {
  date: string;
  captureSpaceId: string;
  locationName?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// ── Analytics Types ──────────────────────────────────────────────────

export interface AnalyticsOverviewData {
  today: {
    date: string;
    dau: number;
    dauPercent: number;
    sessionsToday: number;
    checkinsToday: number;
    avgSessionsPerPlayer: number;
    uniqueLocationsVisited: number;
    totalActiveLocations: number;
    totalRoster: number;
  };
  yesterday: {
    date: string;
    dau: number;
    sessionsToday: number;
    checkinsToday: number;
    uniqueLocationsVisited: number;
  };
  deltas: {
    dau: number;
    sessions: number;
    checkins: number;
    locations: number;
  };
}

export interface EngagementDay {
  date: string;
  dau: number;
  totalSessions: number;
  totalCheckins: number;
  perClanDau: Record<ClanId, number>;
}

export interface AnalyticsEngagementData {
  days: EngagementDay[];
}

export interface AnalyticsClansData {
  clanXpOverTime: { days: Array<{ date: string } & Record<ClanId, number>> };
  clanParticipation: { days: Array<{ date: string } & Record<ClanId, number>> };
  territoriesCaptured: { clans: Record<ClanId, { count: number; days: string[] }> };
  streakStats: { clans: Record<ClanId, { avgStreak: number; longestStreak: number; streakCount3Plus: number }> };
  rosterCounts: Record<ClanId, number>;
}

export type LocationStatus = 'Thriving' | 'Activated' | 'Below Baseline' | 'Unactivated' | 'New';

export interface AnalyticsLocationEntry {
  locationId: string;
  qrNumber: number;
  name: string;
  classification: LocationClassification;
  gameSessions: number;
  freeRoamCheckins: number;
  total: number;
  avgSatisfaction: number | null;
  sentimentBreakdown: { yes: number; maybe: number; no: number };
  phase1Visits: number;
  phase1Satisfaction: number | null;
  change: number;
  status: LocationStatus;
  active: boolean;
  mapPixelX: number;
  mapPixelY: number;
}

export interface AnalyticsLocationsData {
  locations: AnalyticsLocationEntry[];
}

export interface AnalyticsMinigameEntry {
  minigameId: string;
  totalPlays: number;
  wins: number;
  winRate: number;
  avgTimeSeconds: number | null;
  abandonmentRate: number;
  coopPercent: number;
}

export interface AnalyticsMinigamesData {
  minigames: AnalyticsMinigameEntry[];
}

export interface AnalyticsFreeRoamData {
  totalCheckins: number;
  uniqueUsers: number;
  avgSentiment: { yes: number; maybe: number; no: number };
  dailyCheckins: Array<{ date: string; count: number }>;
  controlSignal: {
    assigned: number;
    nonAssigned: number;
    assignedPercent: number;
    nonAssignedPercent: number;
    daily: Array<{ date: string; assigned: number; nonAssigned: number; nonAssignedPercent: number }>;
  };
  sentimentByLocation: Array<{ locationId: string; name: string; yes: number; maybe: number; no: number; total: number }>;
  sentimentByCluster: Array<{ cluster: string; yes: number; maybe: number; no: number; total: number }>;
  activityCategoryBreakdown: Record<string, number>;
}

// ── Cluster Analytics Types ──────────────────────────────────────────

export type ClusterKey = 'nomad' | 'seeker' | 'drifter' | 'forced' | 'disengaged' | 'null';

export interface ClusterOverviewEntry {
  rosterCount: number;
  dau: number;
  participationRate: number;
  avgSessionsPerDay: number;
  avgStreak: number;
  totalGameSessions: number;
  totalCheckins: number;
  avgSatisfaction: number | null;
  sentimentBreakdown: { yes: number; maybe: number; no: number };
}

export interface AnalyticsClustersData {
  clusterOverview: Record<ClusterKey, ClusterOverviewEntry>;
  clusterSpaceTypeMatrix: { clusters: Record<ClusterKey, Record<string, number>> };
  clusterSatisfactionOverTime: { days: Array<{ date: string } & Record<ClusterKey, number | null>> };
  clusterEngagement: { days: Array<{ date: string } & Record<ClusterKey, number>> };
}

// ── Decay Alerts Types ───────────────────────────────────────────────

export interface DecayAlertDauDecline {
  triggered: boolean;
  peakDau: number;
  peakDate: string;
  todayDau: number;
  dropPercent: number;
}

export interface DecayAlertClanDisengagement {
  triggered: boolean;
  clans: Array<{ clanId: string; participationLast3Days: number[] }>;
}

export interface DecayAlertMinigameAbandonment {
  triggered: boolean;
  minigames: Array<{ minigameId: string; abandonmentRate: number }>;
}

export interface DecayAlertSessionsLow {
  triggered: boolean;
  value: number;
}

export interface DecayAlertUnactivatedSpaces {
  triggered: boolean;
  locations: Array<{ locationId: string; name: string; priorityTier: string }>;
}

export interface AnalyticsDecayData {
  alerts: {
    dauDecline: DecayAlertDauDecline;
    clanDisengagement: DecayAlertClanDisengagement;
    minigameAbandonment: DecayAlertMinigameAbandonment;
    sessionsPerPlayerLow: DecayAlertSessionsLow;
    unactivatedSpaces: DecayAlertUnactivatedSpaces;
  };
  computedAt: string;
}
