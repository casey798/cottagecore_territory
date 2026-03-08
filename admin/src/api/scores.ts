import { apiClient } from './client';
import type { ClanScore } from '@/types';

export async function getClanScores(): Promise<ClanScore[]> {
  const res = await apiClient.get<ClanScore[]>('/scores/clans');
  return res.data ?? [];
}
