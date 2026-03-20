import { apiClient } from './client';
import type {
  Location,
  LocationMasterConfig,
  SuggestedPoolResponse,
  DeployResult,
  ClusterWeightConfig,
  ClusterWeightUpdatePayload,
  ScheduleEntry,
  ClusteringRunResult,
} from '@/types';

// Legacy locations API (old locations table)
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

// Master locations API (new location-master-config table)
export async function getMasterLocations(): Promise<LocationMasterConfig[]> {
  const res = await apiClient.get<{ locations: LocationMasterConfig[] }>(
    '/admin/locations/master',
  );
  return res.data?.locations ?? [];
}

export async function createMasterLocation(
  data: Partial<LocationMasterConfig>,
): Promise<LocationMasterConfig> {
  const res = await apiClient.post<LocationMasterConfig>(
    '/admin/locations/master',
    data,
  );
  return res.data;
}

export async function updateMasterLocation(
  locationId: string,
  data: Partial<LocationMasterConfig>,
): Promise<LocationMasterConfig> {
  const res = await apiClient.put<{ location: LocationMasterConfig }>(
    `/admin/locations/master/${locationId}`,
    data,
  );
  return res.data.location;
}

export async function deleteMasterLocation(locationId: string): Promise<void> {
  await apiClient.delete(`/admin/locations/master/${locationId}`);
}

export async function importPhase1Data(
  data: { locations: Array<{ locationId: string; sdtDeficit?: number; priorityTier?: string | null; phase1Visits?: number; phase1Satisfaction?: number | null; phase1DominantCluster?: string | null; isNewSpace?: boolean }> },
): Promise<{ updated: number; skipped: number }> {
  const res = await apiClient.post<{ updated: number; skipped: number }>(
    '/admin/locations/phase1-import',
    data,
  );
  return res.data;
}

export async function suggestDailyPool(): Promise<SuggestedPoolResponse> {
  const res = await apiClient.post<SuggestedPoolResponse>(
    '/admin/daily/suggest',
  );
  return res.data;
}

export async function deployAssignments(): Promise<DeployResult> {
  const res = await apiClient.post<DeployResult>('/admin/daily/deploy');
  return res.data;
}

export async function getClusteringRun(): Promise<ClusteringRunResult | null> {
  const res = await apiClient.get<ClusteringRunResult | null>('/admin/clustering/run');
  return res.data;
}

export async function runClustering(force?: boolean): Promise<ClusteringRunResult> {
  const res = await apiClient.post<ClusteringRunResult>(
    '/admin/clustering/run',
    force ? { force: true } : {},
  );
  return res.data;
}

export async function getClusterWeights(): Promise<ClusterWeightConfig> {
  const res = await apiClient.get<{ config: ClusterWeightConfig }>(
    '/admin/clusters/weights',
  );
  return res.data.config;
}

export async function updateClusterWeights(
  data: ClusterWeightUpdatePayload,
): Promise<ClusterWeightConfig> {
  const res = await apiClient.put<{ config: ClusterWeightConfig }>(
    '/admin/clusters/weights',
    data,
  );
  return res.data.config;
}

export async function getSeasonSchedule(): Promise<ScheduleEntry[]> {
  const res = await apiClient.get<{ schedule: ScheduleEntry[] }>(
    '/admin/season/schedule',
  );
  return res.data.schedule ?? [];
}

export async function saveSeasonSchedule(
  schedule: ScheduleEntry[],
): Promise<void> {
  await apiClient.put('/admin/season/schedule', { schedule });
}
