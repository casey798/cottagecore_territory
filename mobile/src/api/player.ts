import { apiRequest } from './client';
import { ENDPOINTS } from '@/constants/api';
import {
  PlayerProfile,
  AvatarConfig,
  PlayerAsset,
  PlayerSearchResult,
  DayJournal,
} from '@/types';

export function getProfile() {
  return apiRequest<PlayerProfile>(ENDPOINTS.PLAYER_PROFILE);
}

export function updateAvatar(displayName: string, avatarConfig: AvatarConfig) {
  return apiRequest<{ updated: boolean }>(ENDPOINTS.PLAYER_AVATAR, {
    method: 'PUT',
    body: JSON.stringify({ displayName, avatarConfig }),
  });
}

export function getAssets() {
  return apiRequest<{ assets: PlayerAsset[] }>(ENDPOINTS.PLAYER_ASSETS);
}

export function getStats() {
  return apiRequest<PlayerProfile>(ENDPOINTS.PLAYER_STATS);
}

export function updateFcmToken(fcmToken: string) {
  return apiRequest<{ updated: boolean }>(ENDPOINTS.PLAYER_FCM_TOKEN, {
    method: 'PUT',
    body: JSON.stringify({ fcmToken }),
  });
}

export function searchPlayer(query: string) {
  return apiRequest<{ players: PlayerSearchResult[] }>(
    `${ENDPOINTS.PLAYER_SEARCH}?q=${encodeURIComponent(query)}`,
  );
}

/** Persists tutorialDone=true to the backend user record. */
export function updateTutorialDone(): Promise<void> {
  return apiRequest<{ updated: boolean }>(ENDPOINTS.PLAYER_TUTORIAL_DONE, {
    method: 'PUT',
    body: JSON.stringify({}),
  }).then(() => undefined);
}

export async function getJournal(date?: string): Promise<DayJournal> {
  const endpoint = date
    ? `${ENDPOINTS.PLAYER_JOURNAL}?date=${date}`
    : ENDPOINTS.PLAYER_JOURNAL;
  const response = await apiRequest<DayJournal>(endpoint);
  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? 'Failed to load journal');
  }
  return response.data;
}
