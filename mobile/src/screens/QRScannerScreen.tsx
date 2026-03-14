import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';
import { MainModalParamList } from '@/navigation/MainStack';

import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useGameStore } from '@/store/useGameStore';
import { useMapStore } from '@/store/useMapStore';
import { useGPS } from '@/hooks/useGPS';
import { parseQrPayload } from '@/utils/qrValidation';
import { getTodayISTString } from '@/utils/time';
import * as gameApi from '@/api/game';
import { ErrorCode } from '@/types';

type Nav = NativeStackNavigationProp<MainModalParamList>;
type Route = RouteProp<MainModalParamList, 'QRScanner'>;

const ERROR_MESSAGES: Record<string, string> = {
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

  const device = useCameraDevice('back');

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
        if (result.success && result.data) {
          setScanResult(result.data);
          navigation.replace('MinigameSelect', {
            locationId: result.data.locationId,
            locationName: result.data.locationName,
          });
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
    [setScanResult, navigation, showErrorAndResume, todayLocations, gps.latitude, gps.longitude],
  );

  const handleQRDetected = useCallback(
    async (rawData: string) => {
      if (processing || errorMsg) return;
      setProcessing(true);

      const qrData = parseQrPayload(rawData);
      if (!qrData) {
        showErrorAndResume('This is not a valid GroveWars QR code.');
        return;
      }

      await handleScanResult(qrData);
    },
    [processing, errorMsg, showErrorAndResume, handleScanResult],
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
        isActive={!processing}
        codeScanner={codeScanner}
      />
    );
  };

  return (
    <View style={styles.container}>
      {locationName && (
        <View style={styles.locationHeader}>
          <Text style={styles.locationHeaderText}>{locationName}</Text>
        </View>
      )}
      {renderCamera()}
      <View style={styles.overlay}>
        <View style={styles.frameCorner} />
      </View>
      {processing && (
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
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
      {/* DEV: Simulate QR scan */}
      {__DEV__ && (
        <TouchableOpacity
          style={styles.devButton}
          onPress={() => {
            if (processing) return;

            const todayLocations = useGameStore.getState().todayLocations;
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
  locationHeader: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(61, 43, 31, 0.85)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 10,
  },
  locationHeaderText: {
    color: PALETTE.cream,
    fontSize: 16,
    fontFamily: FONTS.headerBold,
    textAlign: 'center',
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
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: UI.overlay,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: {
    color: PALETTE.cream,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
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
