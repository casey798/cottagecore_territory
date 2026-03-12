import { useState, useEffect, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation, {
  GeoPosition,
} from 'react-native-geolocation-service';
import { isWithinGameHours } from '@/utils/time';
import { useDebugStore } from '@/store/useDebugStore';

const GPS_ACCURACY_OK = 25;
const GPS_ACCURACY_WEAK = 50;

export interface GPSState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  isTracking: boolean;
  permissionDenied: boolean;
  error: string | null;
  weakSignal: boolean;
}

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'GroveWars Location Permission',
      message:
        'GroveWars needs your location to show you ' +
        'nearby challenges on the campus map.',
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Cancel',
      buttonPositive: 'OK',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

// Module-level cache so new hook instances start with the last known position
let cachedPosition: { latitude: number; longitude: number; accuracy: number } | null = null;

export function useGPS(): GPSState {
  const debugLocation = useDebugStore((s) => s.debugLocation);
  const isDebugMode = useDebugStore((s) => s.isDebugMode);

  const [state, setState] = useState<GPSState>({
    latitude: cachedPosition?.latitude ?? null,
    longitude: cachedPosition?.longitude ?? null,
    accuracy: cachedPosition?.accuracy ?? null,
    isTracking: false,
    permissionDenied: false,
    error: null,
    weakSignal: false,
  });
  const watchIdRef = useRef<number | null>(null);
  const permissionCheckedRef = useRef(false);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setState((prev) => ({ ...prev, isTracking: false }));
    }
  }, []);

  const startTracking = useCallback(() => {
    if (watchIdRef.current !== null) return;

    const watchId = Geolocation.watchPosition(
      (position: GeoPosition) => {
        const acc = position.coords.accuracy;
        const weak = acc > GPS_ACCURACY_WEAK;

        if (acc > GPS_ACCURACY_OK && acc <= GPS_ACCURACY_WEAK) {
          console.warn(
            `[GPS] Accuracy ${acc.toFixed(1)}m is between ${GPS_ACCURACY_OK}-${GPS_ACCURACY_WEAK}m — proceeding with warning`,
          );
        }

        cachedPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: acc,
        };

        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: acc,
          isTracking: true,
          permissionDenied: false,
          error: null,
          weakSignal: weak,
        });
      },
      (err) => {
        setState((prev) => ({
          ...prev,
          error: err.message,
          isTracking: false,
        }));
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 2,
        interval: 3000,
        fastestInterval: 1000,
        showLocationDialog: true,
        forceRequestLocation: true,
      },
    );
    watchIdRef.current = watchId;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (permissionCheckedRef.current) return;
      permissionCheckedRef.current = true;

      const hasPermission = await requestLocationPermission();

      if (!mounted) return;

      if (!hasPermission) {
        setState((prev) => ({
          ...prev,
          permissionDenied: true,
          error: 'PERMISSION_DENIED',
          isTracking: false,
        }));
        return;
      }

      if (isWithinGameHours()) {
        startTracking();
      } else {
        setState((prev) => ({
          ...prev,
          isTracking: false,
          error: null,
        }));
      }
    }

    init();

    return () => {
      mounted = false;
      stopTracking();
    };
  }, [startTracking, stopTracking]);

  // Re-check game hours periodically
  useEffect(() => {
    if (state.permissionDenied) return;

    const interval = setInterval(() => {
      if (isWithinGameHours()) {
        if (watchIdRef.current === null) {
          startTracking();
        }
      } else {
        stopTracking();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [state.permissionDenied, startTracking, stopTracking]);

  // In dev debug mode, override with debug location
  if (__DEV__ && isDebugMode && debugLocation) {
    return {
      latitude: debugLocation.latitude,
      longitude: debugLocation.longitude,
      accuracy: 5,
      isTracking: true,
      permissionDenied: false,
      error: null,
      weakSignal: false,
    };
  }

  return state;
}
