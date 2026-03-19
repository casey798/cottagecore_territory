import { apiRequest } from './client';
import { ENDPOINTS } from '@/constants/api';
import { ClanScore, CaptureHistoryEntry, SeasonSummaryData } from '@/types';

export function getClanScores() {
  return apiRequest<{ clans: ClanScore[] }>(ENDPOINTS.SCORES_CLANS);
}

export function getCaptureHistory() {
  return apiRequest<{ captures: CaptureHistoryEntry[] }>(
    ENDPOINTS.SCORES_HISTORY,
  );
}

export function getSeasonSummary() {
  return apiRequest<SeasonSummaryData>(ENDPOINTS.SEASON_SUMMARY);
}
