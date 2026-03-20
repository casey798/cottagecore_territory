export type ClanId = 'ember' | 'tide' | 'bloom' | 'gale' | 'hearth';

export type LocationCategory = 'courtyard' | 'corridor' | 'garden' | 'classroom' | 'other';

export type DailyStatus = 'active' | 'scoring' | 'complete';

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
  playerCode: string | null;
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
  bonusXP?: boolean;
  isCoop?: boolean;
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
  eventWindows: EventWindow[];
  resetSeq?: number;
  winnerClan?: string | null;
  quietMode?: boolean;
}

export interface CheckinResponse {
  locationId: string;
  locationName: string;
  checkedIn: boolean;
}

export interface MinigameInfo {
  minigameId: string;
  name: string;
  timeLimit: number;
  description: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  completed: boolean;
}

export interface QrData {
  v: number;
  l: string;
  d: string;
  h: string;
}

export interface LocationModifiers {
  spaceFact: string | null;
  coopOnly: boolean;
  firstVisitBonus: boolean;
  bonusXP: boolean;
  minigameAffinity: string[] | null;
  linkedTo: string | null;
}

export interface ScanQRMinigameResponse {
  locationId: string;
  locationName: string;
  availableMinigames: MinigameInfo[];
  xpAvailable?: boolean;
  capReached?: boolean;
  locationModifiers?: LocationModifiers;
  isCoopSession?: boolean;
  partnerDisplayName?: string;
}

export interface CoopPartnerRequiredResponse {
  partnerRequired: true;
  locationId: string;
  locationName: string;
}

export type ScanQRResponse = ScanQRMinigameResponse | CoopPartnerRequiredResponse;

export interface PlayerSearchResult {
  userId: string;
  displayName: string;
  playerCode: string;
  clan: string;
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
  partnerIsGuest: boolean;
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
  bonusXpTriggered?: boolean;
  linkedLocation?: { locationId: string; name: string } | null;
}

export interface ClanScore {
  clanId: ClanId;
  todayXp: number;
  seasonXp: number;
  spacesCaptured: number;
  todayParticipants: number;
  rosterSize: number;
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
  polygonPoints?: Array<{ x: number; y: number }>;
  gridCells?: Array<{ x: number; y: number }>;
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
  email?: string;
  displayName: string;
  clan: ClanId;
  avatarConfig: AvatarConfig;
  todayXp: number;
  seasonXp: number;
  totalWins: number;
  currentStreak: number;
  bestStreak: number;
  tutorialDone: boolean;
  playerCode?: string | null;
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
    clans: Array<{ clanId: ClanId; todayXp: number; todayParticipants: number; rosterSize: number }>;
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

export interface WsDailyReset {
  type: 'DAILY_RESET';
  data: {
    date: string;
    resetSeq: number;
  };
}

export interface WsScoringComplete {
  type: 'SCORING_COMPLETE';
  data: {
    winnerClan: ClanId;
    spaceName: string;
    mapOverlayId: string;
  };
}

export interface WsScoresChanged {
  type: 'SCORES_CHANGED';
  data?: Record<string, unknown>;
}

export type WsMessage = WsScoreUpdate | WsCaptureMessage | WsDailyReset | WsScoringComplete | WsScoresChanged;

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

export type Floor = 'ground' | 'first';

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
  PartnerCapReached = 'PARTNER_CAP_REACHED',
  PartnerLocationLocked = 'PARTNER_LOCATION_LOCKED',
  PartnerAlreadyWon = 'PARTNER_ALREADY_WON',
}
