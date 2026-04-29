import { apiRequest } from './client';
import { ENDPOINTS } from '@/constants/api';
import { CapturedSpace, SpaceDecoration, PlacedAsset } from '@/types';

// --- Existing API functions ---

export function getCapturedSpaces() {
  return apiRequest<{ spaces: CapturedSpace[] }>(ENDPOINTS.SPACES_CAPTURED);
}

export function getDecoration(spaceId: string) {
  return apiRequest<SpaceDecoration>(
    `${ENDPOINTS.SPACES_DECORATION}/${spaceId}/decoration`,
  );
}

export function saveDecoration(spaceId: string, placedAssets: PlacedAsset[]) {
  return apiRequest<{ saved: boolean }>(
    `${ENDPOINTS.SPACES_DECORATION}/${spaceId}/decoration`,
    {
      method: 'PUT',
      body: JSON.stringify({ layout: { placedAssets } }),
    },
  );
}

// --- New space assignment + decoration types ---

export interface SpaceAssignmentItem {
  spaceId: string;
  spaceName: string;
  completed: boolean;
  mapPixelX: number;
  mapPixelY: number;
  gpsLat: number;
  gpsLng: number;
  geofenceRadius: number;
  polygonPoints: Array<{ x: number; y: number }>;
}

export interface SpaceAssignmentsResponse {
  assignments: SpaceAssignmentItem[];
  spacesPerDay: number;
  completedCount: number;
}

export interface ScanSpaceQRResponse {
  spaceId: string;
  spaceName: string;
  polygonPoints: Array<{ x: number; y: number }>;
  gridCells: Array<{ col: number; row: number }>;
  gridColumns: number;
  gridRows: number;
  alreadyDecorated: boolean;
}

export interface PlacedDecorationAsset {
  assetId: string;
  packCategory: 'furniture' | 'aesthetics' | 'nature';
  x: number;
  y: number;
  rotation: number;
  gridW: number;
  gridH: number;
}

export interface DecorationSurveyAnswers {
  wantSpaceToBe: string;
  whyChoseItems: string;
  wouldVisitMore: 'yes' | 'maybe' | 'no';
}

export interface SubmitDecorationBody {
  spaceId: string;
  layout: { placedAssets: PlacedDecorationAsset[] };
  survey: DecorationSurveyAnswers;
  screenshotBase64: string;
}

export interface SubmitDecorationResponse {
  success: boolean;
  xpAwarded: number;
  spacesCompleted: number;
  spacesRemaining: number;
}

// --- New API functions ---

export function getSpaceAssignments() {
  return apiRequest<SpaceAssignmentsResponse>(ENDPOINTS.SPACE_ASSIGNMENTS_TODAY);
}

export function scanSpaceQR(body: { qrPayload: string; gpsLat: number; gpsLng: number }) {
  return apiRequest<ScanSpaceQRResponse>(ENDPOINTS.SCAN_SPACE_QR, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function submitSpaceDecoration(body: SubmitDecorationBody) {
  return apiRequest<SubmitDecorationResponse>(ENDPOINTS.SUBMIT_SPACE_DECORATION, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface MyDecorationItem {
  spaceId: string;
  spaceName: string;
  date: string;
  submittedAt: string;
  polygonPoints: Array<{ x: number; y: number }>;
  gridCells: Array<{ col: number; row: number }>;
  gridColumns: number;
  gridRows: number;
  placedAssets: Array<{
    assetId: string;
    packCategory: string;
    x: number;
    y: number;
    rotation: number;
    gridW: number;
    gridH: number;
  }>;
}

export interface MyDecorationsResponse {
  decorations: MyDecorationItem[];
}

export function getMyDecorations() {
  return apiRequest<MyDecorationsResponse>(ENDPOINTS.MY_DECORATIONS);
}
