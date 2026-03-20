import { apiRequest } from './client';
import { ENDPOINTS } from '@/constants/api';
import {
  PlayerProfile,
  AvatarConfig,
  PlayerAsset,
  PlayerSearchResult,
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
