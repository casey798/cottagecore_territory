import { apiRequest } from './client';
import { ENDPOINTS, SUBMIT_SENTIMENT } from '@/constants/api';
import {
  QrData,
  ScanQRResponse,
  StartGameResponse,
  CompleteGameResponse,
  GameResult,
  SpaceSentiment,
  LeaveReason,
  CheckinResponse,
} from '@/types';

export function scanQR(qrData: QrData, gpsLat: number, gpsLng: number, coopPartnerId?: string | null) {
  return apiRequest<ScanQRResponse>(ENDPOINTS.GAME_SCAN, {
    method: 'POST',
    body: JSON.stringify({ qrData, gpsLat, gpsLng, ...(coopPartnerId ? { coopPartnerId } : {}) }),
  });
}

export function startMinigame(
  locationId: string,
  minigameId: string,
  coopPartnerId: string | null = null,
) {
  return apiRequest<StartGameResponse>(ENDPOINTS.GAME_START, {
    method: 'POST',
    body: JSON.stringify({ locationId, minigameId, coopPartnerId }),
  });
}

export function completeMinigame(
  sessionId: string,
  result: GameResult,
  completionHash: string,
  timeTaken: number,
  solutionData: Record<string, unknown>,
) {
  return apiRequest<CompleteGameResponse>(ENDPOINTS.GAME_COMPLETE, {
    method: 'POST',
    body: JSON.stringify({ sessionId, result, completionHash, timeTaken, solutionData }),
  });
}

export function startPractice(minigameId: string) {
  return apiRequest<StartGameResponse>(ENDPOINTS.GAME_START_PRACTICE, {
    method: 'POST',
    body: JSON.stringify({ minigameId }),
  });
}

export function submitCheckin(gpsLat: number, gpsLng: number) {
  return apiRequest<CheckinResponse>(ENDPOINTS.GAME_CHECKIN, {
    method: 'POST',
    body: JSON.stringify({ gpsLat, gpsLng }),
  });
}

export function submitLeave(
  sessionId: string,
  reason: LeaveReason,
): void {
  apiRequest(ENDPOINTS.SUBMIT_LEAVE, {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      leftAt: new Date().toISOString(),
      reason,
    }),
  }).catch((err) => {
    console.warn('[submitLeave] Failed (non-blocking):', err);
  });
}

export function submitSpaceSentiment(
  sessionId: string,
  sentiment: SpaceSentiment,
): void {
  apiRequest(SUBMIT_SENTIMENT(sessionId), {
    method: 'PATCH',
    body: JSON.stringify({ spaceSentiment: sentiment }),
  }).catch((err) => {
    console.warn('[submitSpaceSentiment] Failed (non-blocking):', err);
  });
}