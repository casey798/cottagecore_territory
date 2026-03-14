import { apiClient } from './client';
import type { ClanScore } from '@/types';

export interface CaptureHistoryEntry {
  spaceId: string;
  date: string;
  spaceName: string;
  clan: string;
  mapOverlayId: string;
}

export async function getClanScores(): Promise<ClanScore[]> {
  const res = await apiClient.get<ClanScore[]>('/scores/clans');
  return res.data ?? [];
}

export async function getCaptureHistory(season = 1): Promise<CaptureHistoryEntry[]> {
  const res = await apiClient.get<{ captures: CaptureHistoryEntry[] }>(
    `/scores/history?season=${season}`,
  );
  return res.data?.captures ?? [];
}

export async function deleteOverlays(spaceIds: string[]): Promise<{ deleted: number }> {
  const res = await apiClient.post<{ deleted: number }>('/admin/overlays/delete', { spaceIds });
  return res.data ?? { deleted: 0 };
}
