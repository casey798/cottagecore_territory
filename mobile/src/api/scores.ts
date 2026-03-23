import { apiRequest } from './client';
import { ENDPOINTS } from '@/constants/api';
import { ClanScore, CaptureHistoryEntry, SeasonSummaryData } from '@/types';

export function getClanScores() {
  return apiRequest<{ clans: ClanScore[] }>(ENDPOINTS.SCORES_CLANS);
}

export function getCaptureHistory(cursor?: string) {
  const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest<{ captures: CaptureHistoryEntry[]; nextCursor: string | null }>(
    `${ENDPOINTS.SCORES_HISTORY}${params}`,
  );
}

export function getSeasonSummary() {
  return apiRequest<SeasonSummaryData>(ENDPOINTS.SEASON_SUMMARY);
}
