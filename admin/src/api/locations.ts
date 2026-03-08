import { apiClient } from './client';
import type { Location } from '@/types';

export async function getLocations(): Promise<Location[]> {
  const res = await apiClient.get<{ locations: Location[] }>('/admin/locations');
  return res.data?.locations ?? [];
}

export async function createLocation(
  location: Omit<Location, 'locationId'>,
): Promise<Location> {
  const res = await apiClient.post<Location>('/admin/locations', location);
  return res.data;
}

export async function updateLocation(
  locationId: string,
  updates: Partial<Location>,
): Promise<Location> {
  const res = await apiClient.put<Location>(
    `/admin/locations/${locationId}`,
    updates,
  );
  return res.data;
}

export async function deleteLocation(locationId: string): Promise<void> {
  await apiClient.delete(`/admin/locations/${locationId}`);
}

export async function toggleLocationActive(
  locationId: string,
  active: boolean,
): Promise<Location> {
  const res = await apiClient.put<Location>(
    `/admin/locations/${locationId}`,
    { active },
  );
  return res.data;
}
