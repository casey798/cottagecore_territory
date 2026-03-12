import { apiClient } from './client';
import type { DailyConfig } from '@/types';

export async function setDailyConfig(
  config: Omit<DailyConfig, 'status' | 'winnerClan' | 'qrSecret'>,
): Promise<DailyConfig> {
  const res = await apiClient.post<DailyConfig>(
    '/admin/daily/config',
    config,
  );
  return res.data;
}

export async function applyDailyConfig(): Promise<{
  date: string;
  assignedPlayerCount: number;
  activeLocationCount: number;
}> {
  const res = await apiClient.post<{
    date: string;
    assignedPlayerCount: number;
    activeLocationCount: number;
  }>('/admin/daily/apply');
  return res.data;
}

export async function generateQR(
  date: string,
): Promise<{
  qrCodes: {
    locationId: string;
    locationName: string;
    qrPayload: string;
    qrImageBase64: string;
  }[];
  printablePdfKey: string;
}> {
  const res = await apiClient.post<{
    qrCodes: {
      locationId: string;
      locationName: string;
      qrPayload: string;
      qrImageBase64: string;
    }[];
    printablePdfKey: string;
  }>('/admin/qr/generate', { date });
  return res.data;
}
