import { apiClient } from './client';
import type { Phase1Cluster } from '@/types';

export interface AdminUser {
  userId: string;
  email: string;
  displayName: string;
  clan: string;
  phase1Cluster?: Phase1Cluster | null;
  avatarConfig?: {
    hairStyle: number;
    hairColor: number;
    skinTone: number;
    outfit: number;
    accessory: number;
    characterPreset?: number;
  };
  todayXp: number;
  seasonXp: number;
  totalWins: number;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string;
  tutorialDone: boolean;
  createdAt: string;
  banned?: boolean;
  banReason?: string;
  bannedAt?: string;
}

export interface AdminGameSession {
  sessionId: string;
  userId: string;
  locationId: string;
  minigameId: string;
  date: string;
  startedAt: string;
  completedAt: string | null;
  result: string;
  xpEarned: number;
  chestDropped: boolean;
  chestAssetId: string | null;
  coopPartnerId: string | null;
}

export interface SpaceTypeDistribution {
  'Social Hub': number;
  'Transit / Forced Stay': number;
  'Hidden Gem': number;
  'Dead Zone': number;
  'Unvisited': number;
}

export interface AssignmentHistoryEntry {
  date: string;
  assignedLocations: Array<{ locationId: string; name: string }>;
  visitedLocationIds: string[];
}

export interface UserDetailResponse {
  user: AdminUser;
  computed: {
    totalGamesPlayed: number;
    totalLosses: number;
    uniqueLocationsVisited: number;
    totalLocations: number;
    favoriteMinigame: string | null;
    avgSessionTimeSeconds: number | null;
    coopGamesPlayed: number;
    totalCheckins: number;
  };
  phase1Comparison: {
    cluster: Phase1Cluster;
    baseline: SpaceTypeDistribution | null;
    phase2Distribution: SpaceTypeDistribution | null;
    significantShift: boolean;
  } | null;
  assignmentHistory: AssignmentHistoryEntry[];
}

export async function getAllUsers(): Promise<AdminUser[]> {
  const res = await apiClient.get<{ users: AdminUser[] }>('/admin/users');
  return res.data.users;
}

export async function getUserSessions(
  userId: string,
  cursor?: string,
  limit = 50,
): Promise<{ sessions: AdminGameSession[]; nextCursor?: string }> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  const res = await apiClient.get<{ sessions: AdminGameSession[]; nextCursor?: string }>(
    `/admin/users/${userId}/sessions?${params.toString()}`,
  );
  return res.data;
}

export async function updateUserStatus(
  userId: string,
  status: 'banned' | 'active',
  reason?: string,
): Promise<{ updated: boolean }> {
  const res = await apiClient.put<{ updated: boolean }>(
    `/admin/users/${userId}/status`,
    { status, reason },
  );
  return res.data;
}

export async function adjustUserXp(
  userId: string,
  amount: number,
  reason: string,
): Promise<{ newSeasonXp: number }> {
  const res = await apiClient.post<{ newSeasonXp: number }>(
    `/admin/users/${userId}/xp-adjust`,
    { amount, reason },
  );
  return res.data;
}

export async function getUserDetail(userId: string): Promise<UserDetailResponse> {
  const res = await apiClient.get<UserDetailResponse>(
    `/admin/users/${userId}/detail`,
  );
  return res.data;
}

export async function updateUserCluster(
  userId: string,
  cluster: string | null,
): Promise<{ updated: boolean; newCluster: string | null }> {
  const res = await apiClient.put<{ updated: boolean; newCluster: string | null }>(
    `/admin/users/${userId}/cluster`,
    { cluster },
  );
  return res.data;
}
