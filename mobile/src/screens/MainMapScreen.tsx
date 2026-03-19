import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { GAME_START_HOUR, DAILY_XP_CAP } from '@/constants/config';
import { useAuthStore } from '@/store/useAuthStore';
import { useMapStore } from '@/store/useMapStore';
import { useGameStore } from '@/store/useGameStore';
import { useDebugStore } from '@/store/useDebugStore';
import { useClanScores } from '@/hooks/useClanScores';
import { useGPS } from '@/hooks/useGPS';
import { useCountdown } from '@/hooks/useCountdown';
import { getEndOfGameTimeToday, isWithinGameHours } from '@/utils/time';
import { gpsToPixel } from '@/utils/affineTransform';
import { haversineDistance, formatDistance } from '@/utils/distance';
import { ClanScoreBar } from '@/components/common/ClanScoreBar';
import { CountdownTimer } from '@/components/common/CountdownTimer';
import { MapCanvas, ViewportRect } from '@/components/map/MapCanvas';
import { MapMinimap } from '@/components/map/MapMinimap';
import { DebugPanel } from '@/components/common/DebugPanel';
import { useImage } from '@shopify/react-native-skia';
import * as mapApi from '@/api/map';
import * as playerApi from '@/api/player';
import { ClanId, CapturedSpace, Location } from '@/types';
import { useAssetStore } from '@/store/useAssetStore';
import { useCheckin } from '@/hooks/useCheckin';
import { useDwellTracking } from '@/hooks/useDwellTracking';
import { FreeRoamCheckInModal } from '@/components/common/FreeRoamCheckInModal';

type Nav = NativeStackNavigationProp<MainModalParamList>;

interface LocationProximity {
  locationId: string;
  distance: number;
  inRange: boolean;
}

export default function MainMapScreen() {

  const navigation = useNavigation<Nav>();
  useDwellTracking();
  const { clans: scores } = useClanScores();
  const gps = useGPS();
  const clan = useAuthStore((s) => s.clan);
  const isDebugMode = useDebugStore((s) => s.isDebugMode);
  const showAllMinigames = useDebugStore((s) => s.showAllMinigames);
  const loadMapConfig = useMapStore((s) => s.loadMapConfig);
  const loadTodayLocations = useMapStore((s) => s.loadTodayLocations);
  const loadCapturedSpaces = useMapStore((s) => s.loadCapturedSpaces);
  const updatePlayerPosition = useMapStore((s) => s.updatePlayerPosition);
  const todayLocations = useMapStore((s) => s.todayLocations ?? []);
  const mapConfig = useMapStore((s) => s.mapConfig);
  const setTodayLocations = useGameStore((s) => s.setTodayLocations);
  const setDailyInfo = useGameStore((s) => s.setDailyInfo);
  const setSelectedLocation = useGameStore((s) => s.setSelectedLocation);
  const xpEarnedAtLocations = useGameStore((s) => s.xpEarnedAtLocations);
  const todayXp = useGameStore((s) => s.todayXp);
  const captureResult = useGameStore((s) => s.captureResult);
  const quietMode = useGameStore((s) => s.quietMode);
  const setQuietMode = useGameStore((s) => s.setQuietMode);
  const { checkinStatus, nearbyLocationName, triggerCheckin } = useCheckin();

  const [selectedPin, setSelectedPin] = useState<Location | null>(null);
  const [checkInVisible, setCheckInVisible] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const capturedSpaces = useMapStore((s) => s.capturedSpaces);

  // Selected captured space for decoration flow
  const [selectedSpace, setSelectedSpace] = useState<CapturedSpace | null>(null);
  const [decorateBtnPos, setDecorateBtnPos] = useState<{ x: number; y: number } | null>(null);

  // Follow-player (re-centre) mode
  const [followPlayer, setFollowPlayer] = useState(true);

  const handleFollowChange = useCallback((following: boolean) => {
    setFollowPlayer(following);
  }, []);

  const handleReCenter = useCallback(() => {
    setFollowPlayer(true);
  }, []);

  // Minimap state
  const [viewport, setViewport] = useState<ViewportRect>({ x: 0, y: 0, width: 1920, height: 1080 });
  const navigateFnRef = useRef<((mapX: number, mapY: number) => void) | null>(null);
  const minimapImage = useImage(mapConfig?.mapImageUrl ?? null);
  const setSkiaMapImage = useMapStore((s) => s.setSkiaMapImage);

  // Cache the resolved Skia image in useMapStore so the minimap can reuse it
  useEffect(() => {
    if (minimapImage) {
      setSkiaMapImage(minimapImage);
    }
  }, [minimapImage, setSkiaMapImage]);

  const handleViewportChange = useCallback((vp: ViewportRect) => {
    setViewport(vp);
  }, []);

  const handleRegisterNavigate = useCallback((fn: (mapX: number, mapY: number) => void) => {
    navigateFnRef.current = fn;
  }, []);

  const handleMinimapNavigate = useCallback((mapX: number, mapY: number) => {
    navigateFnRef.current?.(mapX, mapY);
  }, []);

  const endOfGame = useMemo(() => getEndOfGameTimeToday(), []);
  const countdown = useCountdown(endOfGame);
  const gameActive = isWithinGameHours();
  const showPlayer = gameActive || (__DEV__ && isDebugMode);

  useEffect(() => {
    loadMapConfig();
    loadTodayLocations();
    loadCapturedSpaces();

    // Silent prefetch: warm the unplaced assets badge count
    playerApi.getAssets().then((result) => {
      if (result.success && result.data) {
        const now = Date.now();
        const active = result.data.assets.filter(
          (a) => !a.expiresAt || new Date(a.expiresAt).getTime() > now,
        );
        useAssetStore.getState().setUnplacedCount(
          active.filter((a) => !a.placed).length,
        );
      }
    }).catch(() => {});
  }, [loadMapConfig, loadTodayLocations, loadCapturedSpaces]);

  // Navigate to capture celebration when WebSocket CAPTURE event arrives
  useEffect(() => {
    if (captureResult) {
      navigation.navigate('CaptureCelebration', {
        clan: captureResult.winnerClan as ClanId,
        spaceName: captureResult.spaceName,
      });
    }
  }, [captureResult, navigation]);

  // Load daily info and sync today locations to game store
  useEffect(() => {
    async function loadDailyData() {
      try {
        const result = await mapApi.getDailyInfo();
        if (result.success && result.data) {
          setDailyInfo(result.data);
          setQuietMode(result.data.quietMode ?? false);
        }
      } catch (err) {
        console.warn('[daily/info] exception:', err);
      }
    }
    loadDailyData();
  }, [setDailyInfo, setQuietMode]);

  // Sync map store locations to game store
  useEffect(() => {
    if (todayLocations.length > 0) {
      setTodayLocations(todayLocations);
    }
  }, [todayLocations, setTodayLocations]);

  useEffect(() => {
    if (gps.latitude !== null && gps.longitude !== null && gps.accuracy !== null) {
      updatePlayerPosition({
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracy: gps.accuracy,
      });
    }
  }, [gps.latitude, gps.longitude, gps.accuracy, updatePlayerPosition]);

  // Compute proximity for each location
  const proximities = useMemo<LocationProximity[]>(() => {
    if (gps.latitude === null || gps.longitude === null) {
      return todayLocations.map((loc) => ({
        locationId: loc.locationId,
        distance: Infinity,
        inRange: false,
      }));
    }

    return todayLocations.map((loc) => {
      const dist = haversineDistance(
        gps.latitude!,
        gps.longitude!,
        loc.gpsLat,
        loc.gpsLng,
      );
      return {
        locationId: loc.locationId,
        distance: dist,
        inRange: dist <= loc.geofenceRadius,
      };
    });
  }, [gps.latitude, gps.longitude, todayLocations]);

  const inRangeIds = useMemo(
    () => new Set(proximities.filter((p) => p.inRange).map((p) => p.locationId)),
    [proximities],
  );

  const xpExhaustedIds = useMemo(
    () => new Set(Object.keys(xpEarnedAtLocations).filter((id) => xpEarnedAtLocations[id])),
    [xpEarnedAtLocations],
  );

  const playerPixel = useMemo(() => {
    if (
      gps.latitude === null ||
      gps.longitude === null ||
      !mapConfig?.transformMatrix
    ) {
      return null;
    }
    return gpsToPixel(gps.latitude, gps.longitude, mapConfig.transformMatrix);
  }, [gps.latitude, gps.longitude, mapConfig]);

  // Bottom sheet animation
  const openSheet = useCallback(
    (location: Location) => {
      setSelectedPin(location);
      sheetAnim.setValue(0);
      Animated.spring(sheetAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    },
    [sheetAnim],
  );

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSelectedPin(null));
  }, [sheetAnim]);

  const handlePinPress = useCallback(
    (location: Location) => {
      setSelectedSpace(null);
      setDecorateBtnPos(null);
      openSheet(location);
    },
    [openSheet],
  );

  const handleScanFromSheet = useCallback(() => {
    if (!selectedPin) return;
    setSelectedLocation(selectedPin.locationId);
    closeSheet();
    navigation.navigate('QRScanner', {
      locationId: selectedPin.locationId,
      locationName: selectedPin.name,
    });
  }, [selectedPin, navigation, setSelectedLocation, closeSheet]);

  const handleSpaceTap = useCallback((space: CapturedSpace | null, screenX: number, screenY: number) => {
    if (space && space.clan === clan) {
      setSelectedSpace(space);
      setDecorateBtnPos({ x: screenX, y: screenY - 50 });
    } else {
      setSelectedSpace(null);
      setDecorateBtnPos(null);
    }
  }, [clan]);

  const handleDecorate = useCallback(() => {
    if (!selectedSpace) return;
    const navParams = {
      spaceId: selectedSpace.spaceId,
      spaceName: selectedSpace.spaceName,
      clan: selectedSpace.clan as ClanId,
      gridCells: selectedSpace.gridCells ?? [],
      polygonPoints: selectedSpace.polygonPoints ?? [],
    };
    setSelectedSpace(null);
    setDecorateBtnPos(null);
    navigation.navigate('SpaceDecoration', navParams);
  }, [selectedSpace, navigation]);

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  // Get proximity info for the selected pin
  const selectedProximity = useMemo(() => {
    if (!selectedPin) return null;
    return proximities.find((p) => p.locationId === selectedPin.locationId) ?? null;
  }, [selectedPin, proximities]);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const CATEGORY_LABELS: Record<string, string> = {
    courtyard: 'Courtyard',
    garden: 'Garden',
    corridor: 'Corridor',
    classroom: 'Classroom',
    other: 'Other',
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        {/* Floating HUD overlays — hidden in quiet mode */}
        {!quietMode && (
          <View style={styles.hudTop}>
            <ClanScoreBar scores={scores} />
          </View>
        )}
        {!quietMode && (
          <View style={styles.hudSecondRow}>
            {!gameActive ? (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>
                  Starts at {GAME_START_HOUR}:00 AM
                </Text>
              </View>
            ) : (
              <CountdownTimer
                label="Scoring at"
                formatted={countdown.formatted}
                isExpired={countdown.isExpired}
              />
            )}
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>
                {todayXp}/{DAILY_XP_CAP} XP
              </Text>
            </View>
          </View>
        )}
        {quietMode && (
          <View style={styles.quietBanner}>
            <Text style={styles.quietBannerText}>
              Free roam — no challenges today
            </Text>
          </View>
        )}
        <MapCanvas
          playerX={showPlayer && playerPixel ? playerPixel.x : null}
          playerY={showPlayer && playerPixel ? playerPixel.y : null}
          clan={clan}
          locations={quietMode ? [] : todayLocations}
          capturedSpaces={capturedSpaces}
          onPinPress={handlePinPress}
          inRangeIds={inRangeIds}
          xpExhaustedIds={xpExhaustedIds}
          onViewportChange={handleViewportChange}
          registerNavigate={handleRegisterNavigate}
          followPlayer={followPlayer}
          onFollowChange={handleFollowChange}
          selectedSpaceId={selectedSpace?.spaceId ?? null}
          onSpaceTap={handleSpaceTap}
        />
        {mapConfig && (
          <MapMinimap
            viewport={viewport}
            playerX={showPlayer && playerPixel ? playerPixel.x : null}
            playerY={showPlayer && playerPixel ? playerPixel.y : null}
            clan={clan ?? null}
            locations={todayLocations}
            capturedSpaces={capturedSpaces}
            transformMatrix={mapConfig.transformMatrix}
            onNavigate={handleMinimapNavigate}
            isDebugMode={isDebugMode}
          />
        )}
        {/* Re-centre button — visible when follow mode is off */}
        {!followPlayer && showPlayer && (
          <Pressable
            style={({ pressed }) => [
              styles.reCenterBtn,
              pressed && styles.reCenterBtnPressed,
            ]}
            onPress={handleReCenter}
          >
            <View style={styles.reCenterIcon}>
              <View style={styles.reCenterDot} />
              <View style={[styles.reCenterArm, styles.reCenterArmTop]} />
              <View style={[styles.reCenterArm, styles.reCenterArmBottom]} />
              <View style={[styles.reCenterArm, styles.reCenterArmLeft]} />
              <View style={[styles.reCenterArm, styles.reCenterArmRight]} />
            </View>
          </Pressable>
        )}

        {gps.permissionDenied && (
          <Pressable
            style={styles.permissionBanner}
            onPress={handleOpenSettings}
          >
            <Text style={styles.permissionBannerText}>
              Location permission required to play. Tap to open settings.
            </Text>
          </Pressable>
        )}
        {!gps.permissionDenied && !gps.isTracking && !gps.error && gameActive && (
          <View style={styles.loadingBanner}>
            <Text style={styles.loadingBannerText}>
              Requesting location...
            </Text>
          </View>
        )}
        {gps.weakSignal && (
          <View style={styles.weakGpsBanner}>
            <Text style={styles.weakGpsBannerText}>
              GPS signal weak — move outdoors for better accuracy
            </Text>
          </View>
        )}
        {gps.error && gps.error !== 'PERMISSION_DENIED' && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>
              GPS error: {gps.error}
            </Text>
          </View>
        )}
        {__DEV__ && <DebugPanel />}
        {__DEV__ && showAllMinigames && (
          <Pressable
            style={styles.debugSkipQrBtn}
            onPress={() =>
              navigation.navigate('MinigameSelect', {
                locationId: '00000000-0000-0000-0000-000000000001',
                locationName: 'Debug Location',
              })
            }
          >
            <Text style={styles.debugSkipQrText}>Debug: Skip QR</Text>
          </Pressable>
        )}
        {__DEV__ && (
          <View style={styles.devBadge}>
            <Text style={styles.devBadgeText}>DEV</Text>
          </View>
        )}

        {/* Check-In floating button — hidden in quiet mode (replaced by quiet mode checkin) */}
        {!quietMode && (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.checkInBtn,
                pressed && styles.checkInBtnPressed,
              ]}
              onPress={() => setCheckInVisible(true)}
            >
              <Text style={styles.checkInBtnIcon}>{'\u{1F4CD}'}</Text>
              <Text style={styles.checkInBtnLabel}>Check In</Text>
            </Pressable>
            <FreeRoamCheckInModal
              visible={checkInVisible}
              onClose={() => setCheckInVisible(false)}
              currentGpsLat={gps.latitude}
              currentGpsLng={gps.longitude}
              currentPixelX={playerPixel?.x ?? null}
              currentPixelY={playerPixel?.y ?? null}
            />
          </>
        )}

        {/* Quiet mode: checkin card */}
        {quietMode && checkinStatus === 'in_range' && nearbyLocationName && (
          <View style={styles.quietCheckinCard}>
            <Text style={styles.quietCheckinText}>
              You're near {nearbyLocationName}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.quietCheckinBtn,
                pressed && styles.quietCheckinBtnPressed,
              ]}
              onPress={triggerCheckin}
            >
              <Text style={styles.quietCheckinBtnText}>Check in</Text>
            </Pressable>
          </View>
        )}
        {quietMode && checkinStatus === 'checking_in' && (
          <View style={styles.quietCheckinCard}>
            <Text style={styles.quietCheckinText}>Checking in...</Text>
          </View>
        )}
        {quietMode && checkinStatus === 'done' && nearbyLocationName && (
          <View style={styles.quietCheckinCardDone}>
            <Text style={styles.quietCheckinDoneText}>
              Checked in to {nearbyLocationName} {'\u2713'}
            </Text>
          </View>
        )}

        {/* Quiet mode: play minigame button */}
        {quietMode && (
          <Pressable
            style={({ pressed }) => [
              styles.quietPlayBtn,
              pressed && styles.quietPlayBtnPressed,
            ]}
            onPress={() =>
              navigation.navigate('MinigameSelect', {
                locationId: 'practice',
                locationName: 'Practice mode',
                practiceMode: true,
              })
            }
          >
            <Text style={styles.quietPlayBtnText}>Play a minigame</Text>
          </Pressable>
        )}

        {/* Decorate button for selected captured space */}
        {selectedSpace && decorateBtnPos && (
          <Pressable
            style={[
              styles.decorateBtn,
              {
                left: Math.max(8, Math.min(decorateBtnPos.x - 52, 300)),
                top: Math.max(60, decorateBtnPos.y),
              },
            ]}
            onPress={handleDecorate}
          >
            <Text style={styles.decorateBtnText}>{`Decorate \u2726`}</Text>
          </Pressable>
        )}

        {/* Bottom sheet backdrop */}
        {selectedPin && (
          <Pressable style={styles.backdrop} onPress={closeSheet} />
        )}

        {/* Bottom sheet */}
        {selectedPin && (
          <Animated.View
            style={[
              styles.bottomSheet,
              { transform: [{ translateY: sheetTranslateY }] },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetLocationName}>{selectedPin.name}</Text>
            <View style={styles.sheetCategoryBadge}>
              <Text style={styles.sheetCategoryText}>
                {CATEGORY_LABELS[selectedPin.category] ?? selectedPin.category}
              </Text>
            </View>

            {selectedPin.locked ? (
              <View style={styles.sheetStatusRow}>
                <Text style={styles.sheetLockedText}>Locked for today.</Text>
              </View>
            ) : xpExhaustedIds.has(selectedPin.locationId) && selectedProximity?.inRange ? (
              <>
                <View style={styles.sheetStatusRow}>
                  <Text style={styles.sheetXpExhaustedText}>
                    XP already earned here today — practice mode only
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.sheetScanButton,
                    styles.sheetScanButtonExhausted,
                    pressed && styles.sheetScanButtonPressed,
                  ]}
                  onPress={handleScanFromSheet}
                >
                  <Text style={styles.sheetScanButtonText}>Scan QR Code</Text>
                </Pressable>
              </>
            ) : selectedProximity?.inRange ? (
              <>
                <View style={styles.sheetStatusRow}>
                  <View style={styles.nearbyDot} />
                  <Text style={styles.sheetNearbyText}>
                    You're here! Ready to scan.
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.sheetScanButton,
                    pressed && styles.sheetScanButtonPressed,
                  ]}
                  onPress={handleScanFromSheet}
                >
                  <Text style={styles.sheetScanButtonText}>Scan QR Code</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.sheetDistanceText}>
                  You need to be within {selectedPin.geofenceRadius}m to scan. ({formatDistance(selectedProximity?.distance ?? 0)} away)
                </Text>
                <Pressable
                  style={[styles.sheetScanButton, styles.sheetScanButtonDisabled]}
                  disabled
                >
                  <Text style={styles.sheetScanButtonTextDisabled}>
                    Scan QR Code
                  </Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.parchmentBg,
  },
  hudTop: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 16,
  },
  hudSecondRow: {
    position: 'absolute',
    top: 38,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 16,
  },
  xpBadge: {
    backgroundColor: PALETTE.cream,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  xpBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.warmBrown,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: PALETTE.deepGreen,
  },
  // Re-centre button (Google Maps style)
  reCenterBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PALETTE.parchmentBg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '40',
  },
  reCenterBtnPressed: {
    backgroundColor: PALETTE.cream,
    transform: [{ scale: 0.95 }],
  },
  reCenterIcon: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reCenterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PALETTE.warmBrown,
    position: 'absolute',
  },
  reCenterArm: {
    position: 'absolute',
    backgroundColor: PALETTE.warmBrown,
  },
  reCenterArmTop: {
    width: 2,
    height: 6,
    top: 0,
  },
  reCenterArmBottom: {
    width: 2,
    height: 6,
    bottom: 0,
  },
  reCenterArmLeft: {
    width: 6,
    height: 2,
    left: 0,
  },
  reCenterArmRight: {
    width: 6,
    height: 2,
    right: 0,
  },
  permissionBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#C0392B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  permissionBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    textAlign: 'center',
  },
  inactiveBadge: {
    backgroundColor: 'rgba(61, 43, 31, 0.75)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  inactiveBadgeText: {
    color: PALETTE.cream,
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
  },
  loadingBanner: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(61, 43, 31, 0.75)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  loadingBannerText: {
    color: PALETTE.cream,
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
  },
  weakGpsBanner: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(211, 168, 67, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  weakGpsBannerText: {
    color: PALETTE.darkBrown,
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(192, 57, 43, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
  },
  // Check-In button
  checkInBtn: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.parchmentBg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    zIndex: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '40',
    gap: 6,
  },
  checkInBtnPressed: {
    backgroundColor: PALETTE.cream,
    transform: [{ scale: 0.95 }],
  },
  checkInBtnIcon: {
    fontSize: 16,
  },
  checkInBtnLabel: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  // Bottom sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 20,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: PALETTE.parchmentBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    zIndex: 30,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: PALETTE.stoneGrey,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetLocationName: {
    fontSize: 18,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 4,
  },
  sheetCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: PALETTE.softGreen + '30',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 10,
  },
  sheetCategoryText: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.deepGreen,
  },
  sheetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nearbyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#27AE60',
    marginRight: 6,
  },
  sheetNearbyText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: '#27AE60',
  },
  sheetDistanceText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: '#D4A843',
  },
  sheetLockedText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: '#C0392B',
  },
  sheetXpExhaustedText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
  },
  sheetScanButtonExhausted: {
    backgroundColor: PALETTE.stoneGrey,
    borderBottomColor: '#8A8071',
  },
  sheetScanButton: {
    backgroundColor: PALETTE.honeyGold,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.warmBrown,
  },
  sheetScanButtonPressed: {
    borderBottomWidth: 0,
    transform: [{ translateY: 2 }],
  },
  sheetScanButtonDisabled: {
    backgroundColor: PALETTE.stoneGrey,
    borderBottomColor: '#8A8071',
  },
  sheetScanButtonText: {
    color: PALETTE.darkBrown,
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
  },
  sheetScanButtonTextDisabled: {
    color: '#FFFFFF80',
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
  },
  sheetHintText: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginTop: 6,
  },
  decorateBtn: {
    position: 'absolute',
    zIndex: 19,
    backgroundColor: PALETTE.parchmentBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 1.5,
    borderColor: PALETTE.honeyGold,
  },
  decorateBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
    textAlign: 'center',
  },
  debugSkipQrBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(192, 57, 43, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    zIndex: 100,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  debugSkipQrText: {
    color: '#FFD700',
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
  },
  devBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(192, 57, 43, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 999,
  },
  devBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1,
  },
  // ── Quiet mode ──
  quietBanner: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: PALETTE.cream,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: PALETTE.warmBrown + '30',
  },
  quietBannerText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
  },
  quietPlayBtn: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: PALETTE.honeyGold,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    zIndex: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.warmBrown,
  },
  quietPlayBtnPressed: {
    borderBottomWidth: 0,
    transform: [{ translateY: 2 }],
  },
  quietPlayBtnText: {
    fontSize: 16,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.darkBrown,
  },
  quietCheckinCard: {
    position: 'absolute',
    bottom: 72,
    alignSelf: 'center',
    backgroundColor: PALETTE.cream,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    zIndex: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: PALETTE.softGreen + '50',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quietCheckinText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    flexShrink: 1,
  },
  quietCheckinBtn: {
    backgroundColor: PALETTE.softGreen,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  quietCheckinBtnPressed: {
    opacity: 0.8,
  },
  quietCheckinBtnText: {
    fontSize: 13,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.cream,
  },
  quietCheckinCardDone: {
    position: 'absolute',
    bottom: 72,
    alignSelf: 'center',
    backgroundColor: PALETTE.softGreen + '20',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    zIndex: 18,
    elevation: 4,
    borderWidth: 1,
    borderColor: PALETTE.softGreen + '40',
  },
  quietCheckinDoneText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.softGreen,
  },
});
