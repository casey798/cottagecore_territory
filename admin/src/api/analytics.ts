import { apiClient } from './client';
import type {
  AnalyticsOverviewData,
  AnalyticsEngagementData,
  AnalyticsClansData,
  AnalyticsLocationsData,
  AnalyticsMinigamesData,
  AnalyticsFreeRoamData,
  AnalyticsClustersData,
  AnalyticsDecayData,
} from '@/types';

function buildQuery(startDate?: string, endDate?: string): string {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getAnalyticsOverview(startDate?: string, endDate?: string) {
  const res = await apiClient.get<AnalyticsOverviewData>(
    `/admin/analytics/overview${buildQuery(startDate, endDate)}`
  );
  return res.data;
}

export async function getAnalyticsEngagement(startDate?: string, endDate?: string) {
  const res = await apiClient.get<AnalyticsEngagementData>(
    `/admin/analytics/engagement${buildQuery(startDate, endDate)}`
  );
  return res.data;
}

export async function getAnalyticsClans(startDate?: string, endDate?: string) {
  const res = await apiClient.get<AnalyticsClansData>(
    `/admin/analytics/clans${buildQuery(startDate, endDate)}`
  );
  return res.data;
}

export async function getAnalyticsLocations(startDate?: string, endDate?: string) {
  const res = await apiClient.get<AnalyticsLocationsData>(
    `/admin/analytics/locations${buildQuery(startDate, endDate)}`
  );
  return res.data;
}

export async function getAnalyticsMinigames(startDate?: string, endDate?: string) {
  const res = await apiClient.get<AnalyticsMinigamesData>(
    `/admin/analytics/minigames${buildQuery(startDate, endDate)}`
  );
  return res.data;
}

export async function getAnalyticsFreeRoam(startDate?: string, endDate?: string) {
  const res = await apiClient.get<AnalyticsFreeRoamData>(
    `/admin/analytics/free-roam${buildQuery(startDate, endDate)}`
  );
  return res.data;
}

export async function getAnalyticsClusters(startDate?: string, endDate?: string) {
  const res = await apiClient.get<AnalyticsClustersData>(
    `/admin/analytics/clusters${buildQuery(startDate, endDate)}`
  );
  return res.data;
}

export async function getAnalyticsDecay() {
  const res = await apiClient.get<AnalyticsDecayData>('/admin/analytics/decay');
  return res.data;
}

export interface ClusterMigrationRow {
  total: number;
  [key: string]: number;
}

export interface ClusterMigrationData {
  migrations: Record<string, ClusterMigrationRow>;
  newUsers: Record<string, number>;
  computedAt: string;
}

export async function getClusterMigration() {
  const res = await apiClient.get<ClusterMigrationData>('/admin/analytics/cluster-migration');
  return res.data;
}
