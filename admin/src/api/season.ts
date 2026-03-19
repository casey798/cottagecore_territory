import { apiClient } from './client';
import { BASE_URL } from '@/constants/api';
import { useAuthStore } from '@/store/useAuthStore';

export interface SeasonResetRequest {
  resetTerritories: boolean;
  newSeasonNumber: number;
}

export interface SeasonResetResponse {
  message: string;
  usersReset: number;
  clansReset: number;
  territoriesReset: number;
  newSeasonNumber: number;
}

export interface HallOfFamePlayer {
  rank: number;
  displayName: string;
  clan: string;
  seasonXp: number;
  totalWins: number;
  bestStreak: number;
}

export interface HallOfFameData {
  winningClan: { clanId: string; spacesCaptured: number } | null;
  territoriesPerClan: Record<string, number>;
  topPlayers: HallOfFamePlayer[];
  longestStreakHolders: Array<{ displayName: string; clan: string; bestStreak: number }>;
  seasonStats: {
    totalUniquePlayers: number;
    totalGameSessions: number;
  };
}

export async function resetSeason(data: SeasonResetRequest): Promise<SeasonResetResponse> {
  const res = await apiClient.post<SeasonResetResponse>('/admin/season/reset', data);
  return res.data;
}

export async function getHallOfFame(): Promise<HallOfFameData> {
  const res = await apiClient.get<HallOfFameData>('/admin/season/halloffame');
  return res.data;
}

export interface SeasonStatus {
  seasonNumber: number;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  seasonStatus: 'active' | 'complete';
  totalPlayers: number;
}

export async function getSeasonStatus(): Promise<SeasonStatus> {
  const res = await apiClient.get<SeasonStatus>('/admin/season/status');
  return res.data;
}

export interface ImportResult {
  matched?: number;
  updated?: number;
  notInRoster?: number;
  notFound?: number;
  invalid: number;
  errors: string[];
}

export async function importClusters(rows: Array<{ email: string; cluster: string }>): Promise<ImportResult> {
  const res = await apiClient.post<ImportResult>('/admin/import/clusters', { rows });
  return res.data;
}

export async function importSpaceMetadata(mappings: Array<Record<string, unknown>>): Promise<ImportResult> {
  const res = await apiClient.post<ImportResult>('/admin/import/space-metadata', { mappings });
  return res.data;
}

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export type ExportType =
  | 'game-sessions'
  | 'player-profiles'
  | 'daily-configs'
  | 'player-assignments'
  | 'capture-history'
  | 'locations'
  | 'notification-history';

export async function fetchExportCsv(
  type: ExportType,
  startDate?: string,
  endDate?: string,
): Promise<string> {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const qs = params.toString();
  const url = `${BASE_URL}/admin/export/${type}${qs ? `?${qs}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (response.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    let msg = 'Export failed';
    try {
      const err = await response.json();
      msg = err.error?.message || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  return response.text();
}
