import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  AppState,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';
import { MainModalParamList } from '@/navigation/MainStack';

import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useGameStore } from '@/store/useGameStore';
import { useMapStore } from '@/store/useMapStore';
import { useGPS } from '@/hooks/useGPS';
import { parseQrPayload } from '@/utils/qrValidation';
import { getTodayISTString } from '@/utils/time';
import * as gameApi from '@/api/game';
import { ErrorCode, PlayerSearchResult, ScanQRMinigameResponse } from '@/types';
import PartnerSearchModal from '@/components/common/PartnerSearchModal';

type Nav = NativeStackNavigationProp<MainModalParamList>;
type Route = RouteProp<MainModalParamList, 'QRScanner'>;

export const ERROR_MESSAGES: Record<string, string> = {
  [ErrorCode.QrExpired]:
    "This QR code is from a previous day. Ask admin for today's code.",
  [ErrorCode.QrInvalid]:
    "Invalid QR code. Make sure you're scanning the official GroveWars code.",
  [ErrorCode.GpsOutOfRange]:
    "You must be at the location to scan. Move closer and try again.",
  [ErrorCode.NotAssigned]:
    "This location isn't in your assignment today. Check your map for your locations.",
  [ErrorCode.LocationLocked]:
    "You've already lost at this location today. Try a different spot!",
  [ErrorCode.DailyCapReached]:
    "You've earned all 100 XP for today! Come back tomorrow.",
  [ErrorCode.LocationExhausted]:
    "You've mastered all challenges here today — try another location!",
  [ErrorCode.AllMinigamesPlayed]:
    "You've played all available challenges for today. Come back tomorrow!",
  [ErrorCode.GameInactive]:
    "The grove is resting right now. Come back during game hours.",
  [ErrorCode.SeasonEnded]:
    "This season has ended. Watch for the next season announcement!",
  [ErrorCode.RateLimited]:
    "Too many attempts. Wait a moment and try again.",
  [ErrorCode.PartnerCapReached]:
    "Your partner has already earned full XP today. Find another partner.",
  [ErrorCode.PartnerLocationLocked]:
    "Your partner has already lost at this location today.",
  [ErrorCode.PartnerAlreadyWon]:
    "Your partner has already won here today.",
};

const ERROR_RESUME_MS = 3000;

export default function QRScannerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const locationName = route.params?.locationName;
  const prefilledLocationId = route.params?.locationId;
  const setScanResult = useGameStore((s) => s.setScanResult);
  const todayLocations = useMapStore((s) => s.todayLocations);
  const gps = useGPS();
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Co-op partner modal state
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [coopLocationName, setCoopLocationName] = useState('');
  const pendingQrRef = useRef<{ v: number; l: string; d: string; h: string } | null>(null);

  const [gpsTimedOut, setGpsTimedOut] = useState(false);
  const mountedRef = useRef(true);

  const device = useCameraDevice('back');

  // Track mounted state for async safety
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // GPS timeout — show persistent guidance after 15 seconds with no fix
  useEffect(() => {
    if (gps.latitude !== null) {
      setGpsTimedOut(false);
      return;
    }
    const t = setTimeout(() => {
      if (gps.latitude === null) setGpsTimedOut(true);
    }, 15000);
    return () => clearTimeout(t);
  }, [gps.latitude]);

  // Re-check camera permission when returning from Settings
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && cameraPermission !== 'granted') {
        const status = await Camera.getCameraPermissionStatus();
        setCameraPermission(status);
      }
    });
    return () => sub.remove();
  }, [cameraPermission]);

  // Check if location is locked — redirect back immediately
  useEffect(() => {
    if (prefilledLocationId) {
      const loc = todayLocations.find((l) => l.locationId === prefilledLocationId);
      if (loc?.locked) {
        Alert.alert(
          'Location Locked',
          'The grove has closed this path for today...',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
    }
  }, [prefilledLocationId, todayLocations, navigation]);

  // Request camera permission on mount
  useEffect(() => {
    async function requestCamera() {
      const status = await Camera.requestCameraPermission();
      setCameraPermission(status);
    }
    requestCamera();
  }, []);

  // Cleanup error timer on unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const showErrorAndResume = useCallback((message: string) => {
    setErrorMsg(message);
    setProcessing(false);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setErrorMsg(null);
    }, ERROR_RESUME_MS);
  }, []);

  const navigateToMinigameSelect = useCallback(
    (data: ScanQRMinigameResponse, coopPartner?: { userId: string; displayName: string }) => {
      setScanResult(data);
      navigation.replace('MinigameSelect', {
        locationId: data.locationId,
        locationName: data.locationName,
        ...(coopPartner ? {
          isCoopSession: true,
          coopPartnerId: coopPartner.userId,
          coopPartnerDisplayName: coopPartner.displayName,
        } : {}),
      });
    },
    [setScanResult, navigation],
  );

  const handleScanResult = useCallback(
    async (qrData: { v: number; l: string; d: string; h: string }) => {
      // Client-side lock guard
      const scannedLoc = todayLocations.find((l) => l.locationId === qrData.l);
      if (scannedLoc?.locked) {
        showErrorAndResume('The grove has closed this path for today...');
        return;
      }

      if (gps.latitude === null || gps.longitude === null) {
        showErrorAndResume('Waiting for GPS signal. Please try again in a moment.');
        return;
      }

      try {
        const result = await gameApi.scanQR(qrData, gps.latitude, gps.longitude);
        if (!mountedRef.current) return;
        if (result.success && result.data) {
          // Check if co-op partner is required
          if ('partnerRequired' in result.data && result.data.partnerRequired) {
            pendingQrRef.current = qrData;
            setCoopLocationName(result.data.locationName);
            setShowPartnerModal(true);
            setProcessing(false);
            return;
          }

          // Normal flow — navigate to minigame select
          const data = result.data as ScanQRMinigameResponse;
          setProcessing(false);
          navigateToMinigameSelect(data);
        } else {
          const code = result.error?.code || '';
          const message =
            ERROR_MESSAGES[code] ||
            result.error?.message ||
            'Something went wrong. Please try again.';
          showErrorAndResume(message);
        }
      } catch {
        showErrorAndResume('Something went wrong. Please try again.');
      }
    },
    [navigateToMinigameSelect, showErrorAndResume, todayLocations, gps.latitude, gps.longitude],
  );

  const handlePartnerConfirm = useCallback(
    async (partner: PlayerSearchResult) => {
      setShowPartnerModal(false);
      setProcessing(true);

      const qrData = pendingQrRef.current;
      if (!qrData || gps.latitude === null || gps.longitude === null) {
        showErrorAndResume('Something went wrong. Please scan again.');
        return;
      }

      try {
        const result = await gameApi.scanQR(qrData, gps.latitude, gps.longitude, partner.userId);
        if (!mountedRef.current) return;
        if (result.success && result.data && !('partnerRequired' in result.data)) {
          const data = result.data as ScanQRMinigameResponse;
          setProcessing(false);
          navigateToMinigameSelect(data, {
            userId: partner.userId,
            displayName: partner.displayName,
          });
        } else {
          const message = result.error?.message || 'Failed to start co-op session.';
          showErrorAndResume(message);
          setShowPartnerModal(true);
        }
      } catch {
        showErrorAndResume('Something went wrong. Please try again.');
        setShowPartnerModal(true);
      }
    },
    [gps.latitude, gps.longitude, navigateToMinigameSelect, showErrorAndResume],
  );

  const handlePartnerCancel = useCallback(() => {
    setShowPartnerModal(false);
    pendingQrRef.current = null;
    setProcessing(false);
  }, []);

  const handleQRDetected = useCallback(
    async (rawData: string) => {
      if (processing || errorMsg || showPartnerModal) return;
      setProcessing(true);

      const qrData = parseQrPayload(rawData);
      if (!qrData) {
        showErrorAndResume('This is not a valid GroveWars QR code.');
        return;
      }

      await handleScanResult(qrData);
    },
    [processing, errorMsg, showPartnerModal, showErrorAndResume, handleScanResult],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0].value) {
        handleQRDetected(codes[0].value);
      }
    },
  });

  const renderCamera = () => {
    // Still checking permission
    if (cameraPermission === null) {
      return (
        <View style={styles.cameraFallback}>
          <ActivityIndicator size="large" color={PALETTE.cream} />
          <Text style={styles.fallbackText}>Requesting camera access...</Text>
        </View>
      );
    }

    // Permission denied
    if (cameraPermission !== 'granted') {
      return (
        <View style={styles.cameraFallback}>
          <Text style={styles.fallbackText}>
            Camera permission is needed to scan QR codes
          </Text>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.settingsBtnText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // No camera device available
    if (!device) {
      return (
        <View style={styles.cameraFallback}>
          <Text style={styles.fallbackText}>Camera not available</Text>
        </View>
      );
    }

    // Camera ready
    return (
      <Camera
        style={styles.camera}
        device={device}
        isActive={!processing && !showPartnerModal}
        codeScanner={codeScanner}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderCamera()}
      <View style={styles.overlay}>
        <View style={styles.frameCorner} />
      </View>
      {processing && !showPartnerModal && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={PALETTE.honeyGold} />
          <Text style={styles.processingText}>Verifying...</Text>
        </View>
      )}
      {errorMsg && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
      {gpsTimedOut && (
        <View style={styles.gpsTimeoutBanner}>
          <Text style={styles.gpsTimeoutText}>
            GPS signal not found. Move to an open area or check that location
            permission is set to "Allow all the time" in Settings.
          </Text>
        </View>
      )}
      <View style={styles.scanHeader}>
        <TouchableOpacity style={styles.scanBackBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.scanBackText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.scanLocationName} numberOfLines={1} ellipsizeMode="tail">
          {locationName ?? 'Scan QR Code'}
        </Text>
        <View style={styles.scanHeaderSpacer} />
      </View>

      {/* Partner search modal for co-op locations */}
      <PartnerSearchModal
        visible={showPartnerModal}
        locationName={coopLocationName}
        onConfirm={handlePartnerConfirm}
        onCancel={handlePartnerCancel}
      />

      {/* DEV: Simulate QR scan */}
      {__DEV__ && (
        <TouchableOpacity
          style={styles.devButton}
          onPress={() => {
            if (processing) return;

            const todayLocations = useMapStore.getState().todayLocations;
            if (!todayLocations || todayLocations.length === 0) {
              Alert.alert('No locations', 'No locations assigned today');
              return;
            }

            const doScan = (loc: { locationId: string; name: string }) => {
              console.log('[DEV Scan] Target location:', loc.locationId, loc.name);
              const today = getTodayISTString();
              setProcessing(true);
              handleScanResult({ v: 1, l: loc.locationId, d: today, h: 'dev-bypass' });
            };

            // If locationId was pre-filled from the bottom sheet, use it directly
            if (prefilledLocationId) {
              const matched = todayLocations.find((l) => l.locationId === prefilledLocationId);
              if (matched) {
                doScan(matched);
                return;
              }
            }

            // Otherwise show picker
            const buttons = todayLocations.map((loc) => ({
              text: loc.name,
              onPress: () => doScan(loc),
            }));
            buttons.push({ text: 'Cancel', onPress: () => {} });

            Alert.alert('Select Location', 'Pick a location to simulate scan:', buttons);
          }}
        >
          <Text style={styles.devButtonText}>DEV: Simulate Scan</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.darkBrown,
  },
  scanHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 10,
  },
  scanBackBtn: {
    width: 64,
  },
  scanBackText: {
    fontFamily: FONTS.pixel,
    fontSize: 14,
    color: PALETTE.cream,
  },
  scanLocationName: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: PALETTE.cream,
  },
  scanHeaderSpacer: {
    width: 64,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: PALETTE.cream,
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  settingsBtn: {
    marginTop: 16,
    backgroundColor: PALETTE.honeyGold,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  settingsBtnText: {
    color: PALETTE.darkBrown,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameCorner: {
    width: 200,
    height: 200,
    borderWidth: 3,
    borderColor: PALETTE.honeyGold,
    borderRadius: 12,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: PALETTE.cream,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    marginTop: 12,
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(192, 57, 43, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    textAlign: 'center',
  },
  gpsTimeoutBanner: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(61, 43, 31, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    zIndex: 9,
  },
  gpsTimeoutText: {
    fontFamily: FONTS.pixel,
    fontSize: 13,
    color: PALETTE.cream,
    textAlign: 'center',
  },
  devButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: PALETTE.mutedRose,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  devButtonText: {
    color: PALETTE.cream,
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
  },
});
