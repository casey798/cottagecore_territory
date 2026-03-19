import { useState, useEffect, useRef, useCallback } from 'react';
import { useGPS } from '@/hooks/useGPS';
import { useGameStore } from '@/store/useGameStore';
import * as gameApi from '@/api/game';

export type CheckinStatus = 'idle' | 'in_range' | 'checking_in' | 'done' | 'error';

const POLL_INTERVAL = 15000;
const DONE_DISPLAY_MS = 4000;

export function useCheckin() {
  const gps = useGPS();
  const quietMode = useGameStore((s) => s.quietMode);
  const [checkinStatus, setCheckinStatus] = useState<CheckinStatus>('idle');
  const [nearbyLocationName, setNearbyLocationName] = useState<string | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkedLocationIds = useRef<Set<string>>(new Set());

  const doCheckin = useCallback(async (lat: number, lng: number) => {
    if (checkinStatus === 'checking_in' || checkinStatus === 'done') return;
    setCheckinStatus('checking_in');
    try {
      const result = await gameApi.submitCheckin(lat, lng);
      if (result.success && result.data?.checkedIn) {
        setNearbyLocationName(result.data.locationName);
        checkedLocationIds.current.add(result.data.locationId);
        setCheckinStatus('done');
        doneTimerRef.current = setTimeout(() => {
          setCheckinStatus('idle');
          setNearbyLocationName(null);
        }, DONE_DISPLAY_MS);
      } else if (result.error?.code === 'NOT_IN_RANGE') {
        setCheckinStatus('idle');
        setNearbyLocationName(null);
      } else if (result.error?.code === 'ALREADY_CHECKED_IN') {
        setCheckinStatus('done');
        doneTimerRef.current = setTimeout(() => {
          setCheckinStatus('idle');
          setNearbyLocationName(null);
        }, DONE_DISPLAY_MS);
      } else {
        setCheckinStatus('error');
      }
    } catch {
      setCheckinStatus('error');
      setTimeout(() => setCheckinStatus('idle'), 3000);
    }
  }, [checkinStatus]);

  const triggerCheckin = useCallback(() => {
    if (gps.latitude !== null && gps.longitude !== null) {
      doCheckin(gps.latitude, gps.longitude);
    }
  }, [gps.latitude, gps.longitude, doCheckin]);

  // Auto-poll every 15s in quiet mode
  useEffect(() => {
    if (!quietMode) return;

    const interval = setInterval(() => {
      if (
        gps.latitude !== null &&
        gps.longitude !== null &&
        checkinStatus === 'idle'
      ) {
        doCheckin(gps.latitude, gps.longitude);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [quietMode, gps.latitude, gps.longitude, checkinStatus, doCheckin]);

  // Cleanup done timer
  useEffect(() => {
    return () => {
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
      }
    };
  }, []);

  if (!quietMode) {
    return {
      checkinStatus: 'idle' as CheckinStatus,
      nearbyLocationName: null,
      triggerCheckin: () => {},
    };
  }

  return { checkinStatus, nearbyLocationName, triggerCheckin };
}
