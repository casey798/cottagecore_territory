import { apiRequest } from './client';
import { ENDPOINTS } from '@/constants/api';

interface SubmitCheckInPayload {
  gpsLat: number;
  gpsLng: number;
  pixelX: number;
  pixelY: number;
  activityCategory: string;
  satisfaction: number;
  sentiment: string;
  floor: string;
}

interface SubmitCheckInData {
  checkInId: string;
}

export async function submitCheckIn(
  payload: SubmitCheckInPayload,
): Promise<{ success: boolean; checkInId?: string; error?: string }> {
  try {
    const result = await apiRequest<SubmitCheckInData>(ENDPOINTS.CHECKIN_SUBMIT, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (result.success && result.data) {
      return { success: true, checkInId: result.data.checkInId };
    }

    return {
      success: false,
      error: result.error?.message ?? 'Unknown error',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
