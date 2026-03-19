import { apiClient } from './client';
import type { DailyConfig } from '@/types';

export async function getDailyConfig(date?: string): Promise<DailyConfig | null> {
  try {
    const query = date ? `?date=${date}` : '';
    const res = await apiClient.get<DailyConfig>(`/admin/daily/config${query}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function setDailyConfig(
  config: Omit<DailyConfig, 'status' | 'winnerClan' | 'qrSecret'> & {
    activeLocationIds?: string[];
    targetSpace?: DailyConfig['targetSpace'];
  },
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

export async function sendTestNotification(
  window: string,
  targetUserId?: string,
): Promise<{ window: string; deliveryCount: number; message: string }> {
  const body: Record<string, string> = { window };
  if (targetUserId) body.targetUserId = targetUserId;
  const res = await apiClient.post<{ window: string; deliveryCount: number; message: string }>(
    '/admin/test-notification',
    body,
  );
  return res.data;
}

export async function triggerScheduledJob(
  job: string,
): Promise<{ job: string; summary: string; executedAt: string }> {
  const res = await apiClient.post<{ job: string; summary: string; executedAt: string }>(
    '/admin/debug/trigger-scheduled',
    { job },
  );
  return res.data;
}

export async function getUserByEmail(
  email: string,
): Promise<{ userId: string; email: string; displayName: string; clan: string } | null> {
  const res = await apiClient.get<{
    users: { userId: string; email: string; displayName: string; clan: string }[];
  }>(`/admin/users?email=${encodeURIComponent(email)}`);
  return res.data.users[0] ?? null;
}

export async function resetPlayerState(
  userId: string,
): Promise<{ reset: boolean; sessionsDeleted: number; locksCleared: number; assignmentCleared: boolean }> {
  const res = await apiClient.post<{
    reset: boolean;
    sessionsDeleted: number;
    locksCleared: number;
    assignmentCleared: boolean;
  }>('/debug/reset-player-state', { userId });
  return res.data;
}

export async function resetQR(date: string): Promise<{ date: string; message: string }> {
  const res = await apiClient.post<{ date: string; message: string }>(
    '/admin/qr/reset',
    { date },
  );
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
