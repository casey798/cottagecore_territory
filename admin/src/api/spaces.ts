import { apiClient } from './client';
import type { Space, SpaceDecorationSubmission } from '@/types';

// ── Spaces CRUD ──────────────────────────────────────────

export async function getSpaces(): Promise<Space[]> {
  const res = await apiClient.get<{ spaces: Space[] }>('/admin/spaces');
  return res.data?.spaces ?? [];
}

export interface CreateSpaceBody {
  name: string;
  polygonPoints: Array<{ x: number; y: number }>;
  gridCells: Array<{ col: number; row: number }>;
  gridColumns: number;
  gridRows: number;
  gpsLat: number;
  gpsLng: number;
  geofenceRadius: number;
  mapPixelX: number;
  mapPixelY: number;
  notes?: string;
}

export async function createSpace(body: CreateSpaceBody): Promise<Space> {
  const res = await apiClient.post<Space>('/admin/spaces', body);
  return res.data;
}

export async function updateSpace(
  spaceId: string,
  body: Partial<CreateSpaceBody & { active: boolean }>,
): Promise<Space> {
  const res = await apiClient.put<Space>(`/admin/spaces/${spaceId}`, body);
  return res.data;
}

export async function deleteSpace(spaceId: string): Promise<void> {
  await apiClient.delete(`/admin/spaces/${spaceId}`);
}

// ── Space QR codes ──────────────────────────────────────

export interface SpaceQRCode {
  spaceId: string;
  spaceName: string;
  qrNumber: number;
  qrPayload: string;
  qrImageBase64: string;
  qrGeneratedAt: string;
  alreadyExisted: boolean;
}

export async function getSpaceQRCodes(): Promise<SpaceQRCode[]> {
  const res = await apiClient.get<{ spaces: SpaceQRCode[] }>('/admin/spaces/qr-codes');
  return res.data?.spaces ?? [];
}

// ── Decoration submissions ───────────────────────────────

export async function getSpaceDecorations(
  spaceId: string,
  filters?: { date?: string; clan?: string },
): Promise<SpaceDecorationSubmission[]> {
  const params = new URLSearchParams();
  if (filters?.date) params.set('date', filters.date);
  if (filters?.clan) params.set('clan', filters.clan);
  const qs = params.toString();
  const path = `/admin/spaces/${spaceId}/decorations${qs ? `?${qs}` : ''}`;
  const res = await apiClient.get<{ decorations: SpaceDecorationSubmission[] }>(path);
  return res.data?.decorations ?? [];
}

export async function getAllDecorations(
  filters?: { startDate?: string; endDate?: string; clan?: string },
): Promise<SpaceDecorationSubmission[]> {
  const params = new URLSearchParams();
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.clan) params.set('clan', filters.clan);
  const qs = params.toString();
  const path = `/admin/decorations/all${qs ? `?${qs}` : ''}`;
  const res = await apiClient.get<{ decorations: SpaceDecorationSubmission[] }>(path);
  return res.data?.decorations ?? [];
}

// ── Image manifest ───────────────────────────────────────

export interface DecorationImageManifestItem {
  url: string;
  filename: string;
  spaceId: string;
  spaceName: string;
  userId: string;
  displayName: string;
  clan: string;
  date: string;
  submittedAt: string;
  wouldVisitMore: string;
  wantSpaceToBe: string;
  whyChoseItems: string;
  furnitureCount: number;
  aestheticsCount: number;
  natureCount: number;
}

export async function getDecorationImageManifest(
  filters?: { spaceId?: string; date?: string; clan?: string; startDate?: string; endDate?: string },
): Promise<{ images: DecorationImageManifestItem[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.spaceId) params.set('spaceId', filters.spaceId);
  if (filters?.date) params.set('date', filters.date);
  if (filters?.clan) params.set('clan', filters.clan);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  const qs = params.toString();
  const path = `/admin/decorations/image-manifest${qs ? `?${qs}` : ''}`;
  const res = await apiClient.get<{ images: DecorationImageManifestItem[]; total: number }>(path);
  return res.data ?? { images: [], total: 0 };
}

// ── CSV export ───────────────────────────────────────────

export async function exportDecorations(
  startDate?: string,
  endDate?: string,
): Promise<string> {
  const { useAuthStore } = await import('@/store/useAuthStore');
  const { BASE_URL } = await import('@/constants/api');
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const qs = params.toString();
  const response = await fetch(`${BASE_URL}/admin/spaces/export${qs ? `?${qs}` : ''}`, { headers });
  if (!response.ok) throw new Error('Export request failed');
  return response.text();
}
