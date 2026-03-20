export type Phase1Cluster = 'nomad' | 'seeker' | 'drifter' | 'forced' | 'disengaged';

export type LocationClassification =
  | 'Social Hub'
  | 'Transit / Forced Stay'
  | 'Hidden Gem'
  | 'Dead Zone'
  | 'Unvisited'
  | 'TBD';

export enum ClanId {
  Ember = 'ember',
  Tide = 'tide',
  Bloom = 'bloom',
  Gale = 'gale',
  Hearth = 'hearth',
}

export enum GameResult {
  Win = 'win',
  Lose = 'lose',
  Timeout = 'timeout',
  Abandoned = 'abandoned',
}

export enum AssetCategory {
  Banner = 'banner',
  Statue = 'statue',
  Furniture = 'furniture',
  Mural = 'mural',
  Pet = 'pet',
  Special = 'special',
}

export enum Rarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Legendary = 'legendary',
}

export enum NotificationType {
  Event = 'event',
  Alert = 'alert',
  Hype = 'hype',
  Info = 'info',
}

export enum LocationCategory {
  Courtyard = 'courtyard',
  Corridor = 'corridor',
  Garden = 'garden',
  Classroom = 'classroom',
  Other = 'other',
}

export enum DailyConfigStatus {
  Active = 'active',
  Scoring = 'scoring',
  Complete = 'complete',
}

export enum AssetObtainedFrom {
  Chest = 'chest',
  Reward = 'reward',
  Event = 'event',
}

export interface AvatarConfig {
  hairStyle: number;
  hairColor: number;
  skinTone: number;
  outfit: number;
  accessory: number;
  characterPreset?: number;
}

export interface User {
  userId: string;
  email: string;
  displayName: string;
  clan: ClanId;
  avatarConfig: AvatarConfig;
  todayXp: number;
  seasonXp: number;
  totalWins: number;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string;
  tutorialDone: boolean;
  fcmToken: string;
  playerCode: string;
  createdAt: string;
  phase1Cluster?: Phase1Cluster | null;
  computedCluster?: Phase1Cluster | null;
  clusterComputedAt?: string;
  clusterFeatureWindow?: string;
}

export interface Clan {
  clanId: ClanId;
  todayXp: number;
  todayXpTimestamp: string;
  seasonXp: number;
  spacesCaptured: number;
  todayParticipants: number;
  rosterSize: number;
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
  notes: string;
  coopOnly?: boolean;
}

export const COOP_MINIGAME_IDS: readonly string[] = [
  'kindred-coop',
  'cipher-stones-coop',
  'pips-coop',
  'stone-pairs-coop',
  'potion-logic-coop',
  'vine-trail-coop',
];

export const SOLO_CHEST_WEIGHTS = [
  { rarity: 'common',    weight: 60 },
  { rarity: 'uncommon',  weight: 25 },
  { rarity: 'rare',      weight: 12 },
  { rarity: 'legendary', weight: 3  },
] as const;

export const COOP_CHEST_WEIGHTS = [
  { rarity: 'common',    weight: 15 },
  { rarity: 'uncommon',  weight: 20 },
  { rarity: 'rare',      weight: 40 },
  { rarity: 'legendary', weight: 25 },
] as const;

export interface LocationModifiers {
  coopOnly: boolean;
  spaceFact: string | null;
  firstVisitBonus: boolean;
  bonusXP: boolean;
  minigameAffinity: string[] | null;
}

export interface TargetSpace {
  name: string;
  description: string;
  mapOverlayId: string;
  polygonPoints?: Array<{ x: number; y: number }>;
  gridCells?: Array<{ x: number; y: number }>;
}

export interface DailyConfig {
  date: string;
  activeLocationIds: string[];
  targetSpace: TargetSpace;
  qrSecret: string;
  winnerClan: ClanId | null;
  status: DailyConfigStatus;
  resetSeq?: number;
  quietMode?: boolean;
}

export interface LocationMinigameSet {
  minigameIds: string[];
}

export interface PlayerAssignment {
  dateUserId: string;
  assignedLocationIds: string[];
  coopLocationIds?: string[];
  locationMinigames?: Record<string, LocationMinigameSet>;
  weightsUsed?: Record<string, number>;
}

export interface GameSession {
  sessionId: string;
  userId: string;
  locationId: string;
  minigameId: string;
  date: string;
  startedAt: string;
  completedAt: string | null;
  result: GameResult;
  xpEarned: number;
  chestDropped: boolean;
  chestAssetId: string | null;
  completionHash: string;
  coopPartnerId: string | null;
  partnerIsGuest?: boolean;
  _salt?: string;
  puzzleData?: MinigamePuzzle;
  timeLimit?: number;
  spaceSentiment?: SpaceSentiment | null;
  practiceSession?: boolean;
  leftAt?: string | null;
  dwellTime?: number | null;
  leaveReason?: LeaveReason | null;
}

export interface PlayerLock {
  dateUserLocation: string;
  lockedAt: string;
  ttl: number;
}

export interface CapturedSpace {
  spaceId: string;
  dateCaptured: string;
  clan: ClanId;
  spaceName: string;
  season: string;
  mapOverlayId: string;
  polygonPoints?: Array<{ x: number; y: number }>;
  gridCells?: Array<{ x: number; y: number }>;
  clanXpSnapshot?: Record<string, number>;
  totalDayXp?: number;
}

export interface AssetCatalog {
  assetId: string;
  name: string;
  category: AssetCategory;
  rarity: Rarity;
  imageKey: string;
  dropWeight: number;
}

export interface PlayerAsset {
  userAssetId: string;
  userId: string;
  assetId: string;
  obtainedAt: string;
  obtainedFrom: AssetObtainedFrom;
  locationId: string | null;
  placed: boolean;
  expiresAt: string | null;
  expired: boolean;
}

export interface PlacedAssetLayout {
  assetId: string;
  x: number;
  y: number;
  rotation: number;
}

export interface SpaceDecoration {
  userSpaceId: string;
  layout: {
    placedAssets: PlacedAssetLayout[];
  };
  updatedAt: string;
}

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

export interface AdminNotification {
  notificationId: string;
  message: string;
  target: 'all' | ClanId;
  notificationType: NotificationType;
  sentAt: string;
  sentBy: string;
  deliveryCount: number;
}

export interface WsConnection {
  connectionId: string;
  userId: string;
  clan: ClanId;
  connectedAt: string;
  ttl: number;
}

export interface QrPayload {
  v: number;
  l: string;
  d: string;
  h: string;
}

export interface PermanentQrPayload {
  v: 2;
  l: string;
  d: 'permanent';
  h: string;
}

export interface MinigamePuzzle {
  type: string;
  config: Record<string, unknown>;
  solution: Record<string, unknown>;
  timeLimit: number;
}

export interface MinigameResult {
  sessionId: string;
  result: GameResult;
  completionHash: string;
  solutionData: Record<string, unknown>;
}

export interface EventWindow {
  label: string;
  startTime: string;
  endTime: string;
}

// API Request/Response types

export interface SignupRequest {
  email: string;
}

export interface VerifyRequest {
  email: string;
  code: string;
}

export interface LoginRequest {
  email: string;
  code: string;
}

export interface UpdateAvatarRequest {
  displayName: string;
  avatarConfig: AvatarConfig;
}

export interface ScanQrRequest {
  qrData: QrPayload;
  gpsLat: number;
  gpsLng: number;
}

export interface CoopPartnerRequiredResponse {
  partnerRequired: true;
  locationId: string;
  locationName: string;
}

export interface PlayerSearchResult {
  userId: string;
  displayName: string;
  playerCode: string;
  clan: string;
}

export interface StartMinigameRequest {
  locationId: string;
  minigameId: string;
  coopPartnerId: string | null;
}

export interface CompleteMinigameRequest {
  sessionId: string;
  result: GameResult;
  completionHash: string;
  solutionData: Record<string, unknown>;
}

export interface SetDailyConfigRequest {
  date: string;
  activeLocationIds: string[];
  targetSpace: TargetSpace;
}

export interface GenerateQrRequest {
  date: string;
}

export interface SendNotificationRequest {
  message: string;
  target: 'all' | ClanId;
  notificationType: NotificationType;
}

export interface ImportRosterRequest {
  csvData: string;
}

export interface SeasonResetRequest {
  resetTerritories: boolean;
  newSeasonNumber: number;
}

export interface SaveDecorationRequest {
  layout: {
    placedAssets: PlacedAssetLayout[];
  };
}

export interface GetPlayerStatsResponse {
  todayXp: number;
  seasonXp: number;
  totalWins: number;
  currentStreak: number;
  bestStreak: number;
  clan: ClanId;
  clanTodayXp: number;
  clanSeasonXp: number;
}

export interface AvailableMinigame {
  minigameId: string;
  name: string;
  timeLimit: number;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  completed: boolean;
}

export interface ClanScore {
  clanId: ClanId;
  todayXp: number;
  seasonXp: number;
  spacesCaptured: number;
  todayParticipants: number;
  rosterSize: number;
}

export interface ChestDrop {
  dropped: boolean;
  asset?: {
    assetId: string;
    name: string;
    category: AssetCategory;
    rarity: Rarity;
    imageKey: string;
  };
}

export interface JwtPayload {
  uid: string;
  email?: string;
}

// ── Mosaic minigame types ──────────────────────────────────────────

export interface MosaicCell { col: number; row: number; }

export interface MosaicTile {
  tileId: string;
  shape: 'SQUARE' | 'BAR_3' | 'BAR_4' | 'L' | 'L_MIRROR' | 'T' | 'S' | 'PLUS';
  assetKey: 'mo_tile_leaf' | 'mo_tile_mushroom' | 'mo_tile_stone' | 'mo_tile_acorn';
}

export interface MosaicTilePlacement {
  tileId: string;
  originCol: number;
  originRow: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface MosaicPuzzle {
  id: string;
  gridCols: number;
  gridRows: number;
  targetCells: MosaicCell[];
  tiles: MosaicTile[];
  solution: MosaicTilePlacement[];
}

export interface MosaicPuzzleClient extends Omit<MosaicPuzzle, 'solution'> {}

// ── Free-Roam Check-In types ────────────────────────────────────────

export type ActivityCategory =
  | 'high_effort_personal'
  | 'low_effort_personal'
  | 'high_effort_social'
  | 'low_effort_social';

export type Satisfaction = 0 | 0.25 | 0.5 | 0.75 | 1;

export type Sentiment = 'yes' | 'maybe' | 'no';

export type SpaceSentiment = 'yes' | 'maybe' | 'no';

export type LeaveReason =
  | 'navigated_away'
  | 'new_scan'
  | 'app_backgrounded'
  | 'fallback_next_session'
  | 'fallback_end_of_day';

export interface SubmitLeaveRequest {
  sessionId: string;
  leftAt: string;
  reason: LeaveReason;
}

export type Floor = 'ground' | 'first';

export interface CheckIn {
  checkInId: string;
  userId: string;
  clanId: string;
  gpsLat: number;
  gpsLng: number;
  pixelX: number | null;
  pixelY: number | null;
  pixelAvailable: boolean;
  activityCategory: ActivityCategory;
  satisfaction: Satisfaction;
  sentiment: Sentiment;
  floor: Floor;
  durationMinutes: number;
  activityTime: string;
  timestamp: string;
  date: string;
}

export interface CheckinRecord {
  userId: string;
  locationId: string;
  locationName: string;
  timestamp: string;
  date: string;
}

export interface SubmitCheckInRequest {
  gpsLat: number;
  gpsLng: number;
  pixelX: number;
  pixelY: number;
  pixelAvailable: boolean;
  activityCategory: ActivityCategory;
  satisfaction: Satisfaction;
  sentiment: Sentiment;
  floor: Floor;
}

// ── Location Master & Cluster Config types ─────────────────────────

export interface LocationMasterConfig {
  locationId: string;
  qrNumber: number;
  name: string;

  // GPS + Map
  gpsLat: number;
  gpsLng: number;
  geofenceRadius: number;
  mapPixelX: number;
  mapPixelY: number;
  normalizedX: number;
  normalizedY: number;
  floor: string;

  // Phase 1 metadata (read-only after import)
  classification: LocationClassification;
  sdtDeficit: number;
  priorityTier: 'P1-Critical' | 'P1-Seed' | 'P2-High' | 'P3-Medium' | null;
  phase1Visits: number;
  phase1Satisfaction: number | null;
  phase1DominantCluster: string | null;
  isNewSpace: boolean;

  // Game config
  active: boolean;
  chestDropModifier: number;

  // Mechanic modifiers
  firstVisitBonus: boolean;
  coopOnly: boolean;
  bonusXP: boolean;
  spaceFact: string | null;
  minigameAffinity: string[] | null;
  linkedTo: string | null;

  // Admin notes
  notes: string;

  // Runtime (auto-updated)
  lastActiveDate: string | null;
  totalPhase2GameSessions: number;
  totalPhase2FreeRoamCheckins: number;
  avgPhase2Satisfaction: number | null;

  // Rolling 3-day visit window (updated by daily reset)
  // Index 0 = yesterday, 1 = two days ago, 2 = three days ago
  last3DaysVisits: [number, number, number];

  // Persistent QR — per-location HMAC secret
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

export interface ClusterWeightConfig {
  configId: 'current';
  weights: Record<Phase1Cluster | 'null', ClusterWeights>;
  badPairings: Record<Phase1Cluster, string[]>;
  assignmentCounts: Record<Phase1Cluster | 'null', number>;
  coopChances?: Record<string, number>;
  /** @deprecated Use coopChances (per-cluster). Kept for DynamoDB migration compatibility. */
  coopChance?: number;
  updatedAt: string;
  updatedBy: string;
}

// ── Season Summary types ──────────────────────────────────────────

export interface SeasonSummaryData {
  winnerClan: ClanId | null;
  clans: Array<{
    clanId: ClanId;
    seasonXp: number;
    spacesCaptured: number;
  }>;
  topPlayersByXp: Array<{
    userId: string;
    displayName: string;
    clan: ClanId;
    seasonXp: number;
  }>;
  topPlayersByStreak: Array<{
    userId: string;
    displayName: string;
    clan: ClanId;
    bestStreak: number;
  }>;
  mostDecoratedSpaces: Array<{
    spaceId: string;
    spaceName: string;
    decoratorCount: number;
  }>;
  playerStats: {
    seasonXp: number;
    totalWins: number;
    bestStreak: number;
    spacesDiscovered: number;
  };
}

// ── Player Clustering types ──────────────────────────────────────────

export interface PlayerFeatureVector {
  userId: string;
  visits: number;
  avg_duration: number;
  avg_satisfaction: number;
  unique_spaces: number;
  space_diversity: number;
  pct_morning: number;
  pct_he_social: number;
  pct_he_personal: number;
  pct_le_social: number;
  pct_le_personal: number;
  pct_social_hub: number;
  pct_transit: number;
  pct_hidden_gem: number;
  pct_dead_zone: number;
}

export interface ClusteringResult {
  assignments: Record<string, Phase1Cluster>;
  centroids: number[][];
  labelMapping: Record<number, Phase1Cluster>;
  withinClusterVariance: number;
}

export interface DailyClusteringRun {
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

export interface DailyLocationPool {
  date: string;
  activeLocationIds: string[];
  captureSpaceId: string | null;
  algorithmScores: Record<string, number>;
  amPool: string[] | null;
  pmPool: string[] | null;
}
