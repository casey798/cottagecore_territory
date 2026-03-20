import { apiRequest } from './client';
import { ENDPOINTS } from '@/constants/api';
import type {
  ActivityCategory,
  Satisfaction,
  Sentiment,
  Floor,
} from '@/types';

interface SubmitCheckInPayload {
  gpsLat: number;
  gpsLng: number;
  pixelX: number;
  pixelY: number;
  pixelAvailable: boolean;
  activityCategory: ActivityCategory;
  satisfaction: Satisfaction;
  sentiment: Sentiment;
  floor: Floor;
  durationMinutes: number;
  activityTime: string;
}

interface SubmitCheckInData {
  checkInId: string;
}

export type CheckInErrorCode =
  | 'ALREADY_CHECKED_IN'
  | 'RATE_LIMITED'
  | 'DURATION_CAP_EXCEEDED'
  | 'AUTH_ERROR'
  | 'UNKNOWN';

export interface SubmitCheckInResult {
  success: boolean;
  checkInId?: string;
  error?: string;
  errorCode?: CheckInErrorCode;
}

export async function submitCheckIn(
  payload: SubmitCheckInPayload,
): Promise<SubmitCheckInResult> {
  try {
    const result = await apiRequest<SubmitCheckInData>(ENDPOINTS.CHECKIN_SUBMIT, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (result.success && result.data) {
      return { success: true, checkInId: result.data.checkInId };
    }

    const code = result.error?.code;
    const message = result.error?.message ?? 'Unknown error';

    if (code === 'ALREADY_CHECKED_IN') {
      return { success: false, errorCode: 'ALREADY_CHECKED_IN', error: message };
    }

    if (code === 'DURATION_CAP_EXCEEDED') {
      return { success: false, errorCode: 'DURATION_CAP_EXCEEDED', error: message };
    }

    if (code === 'RATE_LIMITED') {
      return { success: false, errorCode: 'RATE_LIMITED', error: message };
    }

    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
      return { success: false, errorCode: 'AUTH_ERROR', error: message };
    }

    return { success: false, errorCode: 'UNKNOWN', error: message };
  } catch (err) {
    return {
      success: false,
      errorCode: 'UNKNOWN',
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
