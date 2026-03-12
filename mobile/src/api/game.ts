import { apiRequest } from './client';
import { ENDPOINTS } from '@/constants/api';
import {
  QrData,
  ScanQRResponse,
  StartGameResponse,
  CompleteGameResponse,
  GameResult,
} from '@/types';

export function scanQR(qrData: QrData, gpsLat: number, gpsLng: number) {
  return apiRequest<ScanQRResponse>(ENDPOINTS.GAME_SCAN, {
    method: 'POST',
    body: JSON.stringify({ qrData, gpsLat, gpsLng }),
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