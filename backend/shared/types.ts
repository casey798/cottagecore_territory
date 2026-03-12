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

export enum Difficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
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
  createdAt: string;
}

export interface Clan {
  clanId: ClanId;
  todayXp: number;
  todayXpTimestamp: string;
  seasonXp: number;
  spacesCaptured: number;
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
}

export interface TargetSpace {
  name: string;
  description: string;
  mapOverlayId: string;
}

export interface DailyConfig {
  date: string;
  activeLocationIds: string[];
  targetSpace: TargetSpace;
  qrSecret: string;
  winnerClan: ClanId | null;
  status: DailyConfigStatus;
  difficulty: Difficulty;
}

export interface LocationMinigameSet {
  minigameIds: string[];
}

export interface PlayerAssignment {
  dateUserId: string;
  assignedLocationIds: string[];
  locationMinigames?: Record<string, LocationMinigameSet>;
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
  _salt?: string;
  puzzleData?: MinigamePuzzle;
  timeLimit?: number;
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
  difficulty: Difficulty;
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
  completed: boolean;
}

export interface ClanScore {
  clanId: ClanId;
  todayXp: number;
  seasonXp: number;
  spacesCaptured: number;
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
