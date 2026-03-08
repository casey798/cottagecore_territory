import { apiClient } from './client';
import type { Notification, ClanId } from '@/types';

export async function sendNotification(data: {
  message: string;
  target: 'all' | ClanId;
  notificationType: 'event' | 'alert' | 'hype' | 'info';
}): Promise<{ notificationId: string; deliveryCount: number }> {
  const res = await apiClient.post<{
    notificationId: string;
    deliveryCount: number;
  }>('/admin/notifications/send', data);
  return res.data;
}

export async function getNotificationHistory(): Promise<Notification[]> {
  const res = await apiClient.get<{ notifications: Notification[] }>(
    '/admin/notifications/history',
  );
  return res.data.notifications;
}
