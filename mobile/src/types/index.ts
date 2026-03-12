export type ClanId = 'ember' | 'tide' | 'bloom' | 'gale' | 'hearth';

export type LocationCategory = 'courtyard' | 'corridor' | 'garden' | 'classroom' | 'other';

export type DailyStatus = 'active' | 'scoring' | 'complete';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type GameResult = 'win' | 'lose' | 'timeout' | 'abandoned';

export type AssetCategory = 'banner' | 'statue' | 'furniture' | 'mural' | 'pet' | 'special';

export type AssetRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type AssetSource = 'chest' | 'reward' | 'event';

export type NotificationType = 'event' | 'alert' | 'hype' | 'info';

export type NotificationTarget = 'all' | ClanId;

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
  locked: boolean;
}

export interface TargetSpace {
  name: string;
  description: string;
  mapOverlayId: string;
}

export interface EventWindow {
  label: string;
  startTime: string;
  endTime: string;
}

export interface DailyInfo {
  date: string;
  targetSpace: TargetSpace;
  status: DailyStatus;
  difficulty: Difficulty;
  eventWindows: EventWindow[];
}

export interface MinigameInfo {
  minigameId: string;
  name: string;
  timeLimit: number;
  description: string;
  completed: boolean;
}

export interface QrData {
  v: number;
  l: string;
  d: string;
  h: string;
}

export interface ScanQRResponse {
  locationId: string;
  locationName: string;
  availableMinigames: MinigameInfo[];
  xpAvailable?: boolean;
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
}

export interface StartGameResponse {
  sessionId: string;
  serverTimestamp: string;
  timeLimit: number;
  salt: string;
  puzzleData: Record<string, unknown>;
}

export interface ChestDrop {
  dropped: boolean;
  asset?: {
    assetId: string;
    name: string;
    category: AssetCategory;
    rarity: AssetRarity;
    imageKey: string;
  };
}

export interface CompleteGameResponse {
  result: GameResult;
  xpEarned: number;
  xpAwarded?: boolean;
  newTodayXp?: number;
  clanTodayXp?: number;
  chestDrop: ChestDrop;
  locationLocked?: boolean;
}

export interface ClanScore {
  clanId: ClanId;
  todayXp: number;
  seasonXp: number;
  spacesCaptured: number;
}

export interface CaptureHistoryEntry {
  date: string;
  spaceName: string;
  clan: ClanId;
  mapOverlayId: string;
}

export interface CapturedSpace {
  spaceId: string;
  spaceName: string;
  clan: ClanId;
  dateCaptured: string;
  mapOverlayId: string;
}

export interface PlacedAsset {
  assetId: string;
  x: number;
  y: number;
  rotation: number;
}

export interface SpaceDecoration {
  layout: {
    placedAssets: PlacedAsset[];
  };
}

export interface PlayerAsset {
  userAssetId: string;
  assetId: string;
  name: string;
  category: AssetCategory;
  rarity: AssetRarity;
  imageKey: string;
  placed: boolean;
  expiresAt: string | null;
  obtainedFrom: AssetSource;
}

export interface AssetCatalogItem {
  assetId: string;
  name: string;
  category: AssetCategory;
  rarity: AssetRarity;
  imageKey: string;
  dropWeight: number;
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

export interface MapConfig {
  mapImageUrl: string;
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  transformMatrix: AffineMatrix;
}

export interface PlayerProfile {
  userId: string;
  displayName: string;
  clan: ClanId;
  avatarConfig: AvatarConfig;
  todayXp: number;
  seasonXp: number;
  totalWins: number;
  currentStreak: number;
  bestStreak: number;
  tutorialDone: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface WsScoreUpdate {
  type: 'SCORE_UPDATE';
  data: {
    clans: Array<{ clanId: ClanId; todayXp: number }>;
    timestamp: string;
  };
}

export interface WsCaptureMessage {
  type: 'CAPTURE';
  data: {
    winnerClan: ClanId;
    spaceName: string;
    mapOverlayId: string;
  };
}

export type WsMessage = WsScoreUpdate | WsCaptureMessage;

export enum ErrorCode {
  InvalidDomain = 'INVALID_DOMAIN',
  NotInRoster = 'NOT_IN_ROSTER',
  InvalidCode = 'INVALID_CODE',
  QrExpired = 'QR_EXPIRED',
  QrInvalid = 'QR_INVALID',
  GpsOutOfRange = 'GPS_OUT_OF_RANGE',
  NotAssigned = 'NOT_ASSIGNED',
  LocationLocked = 'LOCATION_LOCKED',
  DailyCapReached = 'DAILY_CAP_REACHED',
  MinigameAlreadyPlayed = 'MINIGAME_ALREADY_PLAYED',
  LocationExhausted = 'LOCATION_EXHAUSTED',
  SessionNotFound = 'SESSION_NOT_FOUND',
  SessionCompleted = 'SESSION_COMPLETED',
  InvalidHash = 'INVALID_HASH',
  SuspiciousTime = 'SUSPICIOUS_TIME',
  RateLimited = 'RATE_LIMITED',
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  GameInactive = 'GAME_INACTIVE',
  SeasonEnded = 'SEASON_ENDED',
  AllMinigamesPlayed = 'ALL_MINIGAMES_PLAYED',
}
