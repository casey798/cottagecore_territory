import { apiRequest } from './client';
import { ENDPOINTS } from '@/constants/api';
import { CapturedSpace, SpaceDecoration, PlacedAsset } from '@/types';

export function getCapturedSpaces() {
  return apiRequest<{ spaces: CapturedSpace[] }>(ENDPOINTS.SPACES_CAPTURED);
}

export function getDecoration(spaceId: string) {
  return apiRequest<SpaceDecoration>(
    `${ENDPOINTS.SPACES_DECORATION}/${spaceId}/decoration`,
  );
}

export function saveDecoration(spaceId: string, placedAssets: PlacedAsset[]) {
  return apiRequest<{ saved: boolean }>(
    `${ENDPOINTS.SPACES_DECORATION}/${spaceId}/decoration`,
    {
      method: 'PUT',
      body: JSON.stringify({ layout: { placedAssets } }),
    },
  );
}
