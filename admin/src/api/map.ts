import { apiClient } from './client';
import type { MapConfig, CalibrationPoint, AffineMatrix } from '@/types';

export async function getMapConfig(): Promise<MapConfig | null> {
  try {
    const res = await apiClient.get<MapConfig>('/map/config');
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function uploadCalibration(data: {
  mapImageKey: string;
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  points: CalibrationPoint[];
  transformMatrix: AffineMatrix;
}): Promise<{ calibrationId: string }> {
  const res = await apiClient.post<{ calibrationId: string }>(
    '/admin/map/calibration',
    data,
  );
  return res.data;
}

export async function getMapUploadUrl(
  filename: string,
): Promise<{ uploadUrl: string; key: string }> {
  const res = await apiClient.post<{ uploadUrl: string; key: string }>(
    '/admin/map/upload-url',
    { filename },
  );
  return res.data;
}
