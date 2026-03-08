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

export type ClanId = 'ember' | 'tide' | 'bloom' | 'gale';

export interface DailyConfig {
  date: string;
  activeLocationIds: string[];
  targetSpace: {
    name: string;
    description: string;
    mapOverlayId: string;
  };
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'active' | 'scoring' | 'complete';
  winnerClan?: string;
  qrSecret?: string;
}

export interface MapConfig {
  mapImageUrl: string;
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
