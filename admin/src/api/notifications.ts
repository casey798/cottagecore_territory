import { apiClient } from './client';
import type { Notification, ClanId } from '@/types';

export async function sendNotification(data: {
  message: string;
  target: 'all' | ClanId;
  notificationType: 'event' | 'alert' | 'hype' | 'info';
  scheduledFor?: string;
}): Promise<{ notificationId: string; deliveryCount: number; status?: string; scheduledFor?: string }> {
  const res = await apiClient.post<{
    notificationId: string;
    deliveryCount: number;
    status?: string;
    scheduledFor?: string;
  }>('/admin/notifications/send', data);
  return res.data;
}

export async function getNotificationHistory(): Promise<Notification[]> {
  const res = await apiClient.get<{ notifications: Notification[] }>(
    '/admin/notifications/history',
  );
  return res.data.notifications;
}

export async function cancelNotification(notificationId: string): Promise<void> {
  await apiClient.delete(`/admin/notifications/${notificationId}`);
}
