import { apiClient } from './client';
import type { DailyConfig } from '@/types';

export async function getDailyConfig(date?: string): Promise<DailyConfig | null> {
  try {
    const query = date ? `?date=${date}` : '';
    const res = await apiClient.get<DailyConfig>(`/admin/daily/config${query}`);
    return res.data;
  } catch (err: unknown) {
    // 404 = no config for this date — valid not-found state
    if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
      return null;
    }
    // Any other error (500, network failure, 401) — surface to caller
    throw err;
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

export async function generatePermanentQRs(): Promise<{
  qrCodes: {
    locationId: string;
    locationName: string;
    qrPayload: string;
    qrImageBase64: string;
    qrGeneratedAt: string;
    alreadyExisted: boolean;
    active: boolean;
  }[];
}> {
  const res = await apiClient.post<{
    qrCodes: {
      locationId: string;
      locationName: string;
      qrPayload: string;
      qrImageBase64: string;
      qrGeneratedAt: string;
      alreadyExisted: boolean;
      active: boolean;
    }[];
  }>('/admin/qr/generate', { mode: 'permanent' });
  return res.data;
}

export interface PlayerAssignmentDebug {
  dateUserId: string;
  assignedLocations: Array<{
    locationId: string;
    name: string;
    isCoop: boolean;
  }>;
  coopCount: number;
  totalCount: number;
}

export async function getPlayerAssignment(
  userId: string,
  date?: string,
): Promise<PlayerAssignmentDebug> {
  const params = new URLSearchParams({ userId });
  if (date) params.set('date', date);
  const res = await apiClient.get<PlayerAssignmentDebug>(
    `/admin/debug/assignment?${params.toString()}`,
  );
  return res.data;
}

export async function regenerateLocationQR(locationId: string): Promise<{ locationId: string; message: string }> {
  const res = await apiClient.post<{ locationId: string; message: string }>(
    '/admin/qr/reset',
    { locationId },
  );
  return res.data;
}
