import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Animated,
  Alert,
  Image,
  ImageBackground,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, CLAN_COLORS } from '@/constants/colors';
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
import { MapCanvas, ViewportRect } from '@/components/map/MapCanvas';
import { MapMinimap } from '@/components/map/MapMinimap';
import { DebugPanel } from '@/components/common/DebugPanel';
import { Canvas, Rect, RadialGradient, vec, useImage } from '@shopify/react-native-skia';
import * as mapApi from '@/api/map';
import * as playerApi from '@/api/player';
import { ClanId, CapturedSpace, Location, ClanScore } from '@/types';
import { useAssetStore } from '@/store/useAssetStore';
import { useCheckin } from '@/hooks/useCheckin';
import { useDwellTracking } from '@/hooks/useDwellTracking';
import { PLAYER_DOT_IMAGES } from '@/constants/playerAssets';

// Map screen icon assets
const ICON_SETTINGS = require('../assets/ui/icons/icon_settings.png');
const ICON_INVENTORY = require('../assets/ui/icons/icon_inventory.png');
const ICON_JOURNAL = require('../assets/ui/icons/icon_journal.png');
const ICON_XP = require('../assets/ui/icons/icon_xp.png');
const ICON_RECENTER = require('../assets/ui/icons/icon_recenter.png');

// Button sprites (9-slice)
const BTN_SECONDARY_NORMAL = require('../assets/ui/buttons/btn_secondary_normal.png');
const BTN_SECONDARY_PRESSED = require('../assets/ui/buttons/btn_secondary_pressed.png');

const FRAME_DIALOGUE = require('../assets/ui/frames/dialogue_frame.png');
const NAMEPLATE = require('../assets/ui/frames/dialogue_nameplate.png');


type Nav = NativeStackNavigationProp<MainModalParamList>;

interface LocationProximity {
  locationId: string;
  distance: number;
  inRange: boolean;
}

export default function MainMapScreen() {
  const { width: screenW, height: screenH } = useWindowDimensions();

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
  const unplacedCount = useAssetStore((s) => s.unplacedCount);

  const [selectedPin, setSelectedPin] = useState<Location | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const capturedSpaces = useMapStore((s) => s.capturedSpaces);

  const [selectedSpace, setSelectedSpace] = useState<CapturedSpace | null>(null);
  const [decorateBtnPos, setDecorateBtnPos] = useState<{ x: number; y: number } | null>(null);

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

  useEffect(() => {
    if (captureResult) {
      navigation.navigate('CaptureCelebration', {
        clan: captureResult.winnerClan as ClanId,
        spaceName: captureResult.spaceName,
      });
    }
  }, [captureResult, navigation]);

  useEffect(() => {
    async function loadDailyData() {
      try {
        const result = await mapApi.getDailyInfo();
        if (result.success && result.data) {
          setDailyInfo(result.data);
          setQuietMode(result.data.quietMode ?? false);
        }
      } catch (err) {
        if (__DEV__) console.warn('[daily/info] exception:', err);
      }
    }
    loadDailyData();
  }, [setDailyInfo, setQuietMode]);

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

  // FIX 3: Android back button closes the bottom sheet
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (selectedPin !== null) {
          closeSheet();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [selectedPin, closeSheet]),
  );

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

  const handleShowInfo = useCallback(() => {
    const locationCount = todayLocations.length;
    const timeInfo = gameActive
      ? `Scoring in ${countdown.formatted}`
      : `Game starts at ${GAME_START_HOUR}:00 AM`;
    Alert.alert(
      'Game Status',
      `${timeInfo}\n${locationCount} locations active today\nYour XP: ${todayXp}/${DAILY_XP_CAP}`,
    );
  }, [todayLocations.length, gameActive, countdown.formatted, todayXp]);

  const selectedProximity = useMemo(() => {
    if (!selectedPin) return null;
    return proximities.find((p) => p.locationId === selectedPin.locationId) ?? null;
  }, [selectedPin, proximities]);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const clanColor = clan ? CLAN_COLORS[clan] : PALETTE.honeyGold;
  const clanBorderColor = clan ? CLAN_COLORS[clan] : PALETTE.warmBrown;

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
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

        {/* ── HUD: Clan Badge Button (left) ── */}
        {!quietMode && clan && (
          <Pressable
            onPress={() => navigation.navigate('PlayerProfile')}
            style={[styles.hudBadgeBtn, { borderColor: clanBorderColor }]}
          >
            <Image
              source={PLAYER_DOT_IMAGES[clan]}
              style={styles.hudBadgeImage}
              resizeMode="cover"
            />
          </Pressable>
        )}

        {/* ── HUD: Timer Nameplate (below badge) ── */}
        {!quietMode && clan && (
          <ImageBackground
            source={NAMEPLATE}
            style={styles.timerNameplate}
            resizeMode="stretch"
          >
            <Text style={styles.timerNameplateText}>
              {!gameActive
                ? `${GAME_START_HOUR} AM`
                : countdown.isExpired
                  ? 'Scoring!'
                  : countdown.formatted}
            </Text>
          </ImageBackground>
        )}

        {/* ── HUD: Info Bar (right of badge) ── */}
        {!quietMode && (
          <Pressable
            onPress={() => navigation.navigate('ClanScoreboard')}
            style={styles.hudInfoBtn}
          >
            {({ pressed }) => (
              <ImageBackground
                source={pressed ? BTN_SECONDARY_PRESSED : BTN_SECONDARY_NORMAL}
                style={styles.hudInfoBg}
                resizeMode="stretch"
              >
                <View style={styles.hudInfoXp}>
                  <Image source={ICON_XP} style={styles.hudInfoXpIcon} resizeMode="contain" />
                  <Text style={styles.hudInfoXpText}>
                    {todayXp}/{DAILY_XP_CAP}
                  </Text>
                </View>

                <View style={styles.hudInfoDivider} />

                <View style={styles.hudInfoClans}>
                  {scores.map((cs: ClanScore) => (
                    <View
                      key={cs.clanId}
                      style={[
                        styles.hudInfoClanChip,
                        cs.clanId === clan && styles.hudInfoClanChipOwn,
                      ]}
                    >
                      <View
                        style={[
                          styles.hudInfoClanDot,
                          { backgroundColor: CLAN_COLORS[cs.clanId] },
                        ]}
                      />
                      <Text
                        style={[
                          styles.hudInfoClanScore,
                          cs.clanId === clan && { color: CLAN_COLORS[cs.clanId] },
                        ]}
                      >
                        {cs.todayXp}
                      </Text>
                    </View>
                  ))}
                </View>
              </ImageBackground>
            )}
          </Pressable>
        )}

        {/* Quiet mode banner */}
        {quietMode && (
          <View style={styles.quietBanner}>
            <Text style={styles.quietBannerText}>
              Free roam — no challenges today
            </Text>
          </View>
        )}

        {/* ── Circular Minimap (top-right) ── */}
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

        {/* ── Dialogue frame backdrop below minimap ── */}
        <Image
          source={FRAME_DIALOGUE}
          style={styles.fabBackdrop}
          resizeMode="stretch"
        />

        {/* ── Right-side FAB stack (below minimap) ── */}
        <View style={styles.fabStack}>
          <Pressable
            style={({ pressed }) => [
              styles.fabButton,
              pressed && styles.fabButtonPressed,
            ]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Image source={ICON_SETTINGS} style={styles.fabIconImage} resizeMode="contain" />
          </Pressable>

          <View>
            <Pressable
              style={({ pressed }) => [
                styles.fabButton,
                pressed && styles.fabButtonPressed,
              ]}
              onPress={() => navigation.navigate('AssetInventory')}
            >
              <Image source={ICON_INVENTORY} style={styles.fabIconImage} resizeMode="contain" />
            </Pressable>
            {unplacedCount > 0 && (
              <View style={styles.fabBadge}>
                <Text style={styles.fabBadgeText}>
                  {unplacedCount >= 9 ? '9+' : String(unplacedCount)}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.fabButton,
              pressed && styles.fabButtonPressed,
            ]}
            onPress={handleShowInfo}
          >
            <Image source={ICON_JOURNAL} style={styles.fabIconImage} resizeMode="contain" />
          </Pressable>
        </View>

        {/* ── Re-centre button (bottom-left) ── */}
        {!followPlayer && showPlayer && (
          <Pressable
            style={({ pressed }) => [
              styles.reCenterBtn,
              pressed && styles.reCenterBtnPressed,
            ]}
            onPress={handleReCenter}
          >
            <Image source={ICON_RECENTER} style={styles.reCenterImage} resizeMode="contain" />
          </Pressable>
        )}

        {/* ── GPS Status Banners ── */}
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

        {/* ── Debug elements ── */}
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

        {/* ── Check-In button — normal mode only ── */}
        {!quietMode && (
          <Pressable
            onPress={() => navigation.navigate('FreeRoamCheckIn')}
            style={({ pressed }) => [
              styles.checkInBtn,
              pressed && styles.checkInBtnPressed,
            ]}
          >
            {({ pressed }) => (
              <ImageBackground
                source={pressed
                  ? require('../assets/ui/buttons/btn_secondary_pressed.png')
                  : require('../assets/ui/buttons/btn_secondary_normal.png')}
                style={styles.checkInBtnBg}
                resizeMode="stretch"
              >
                <Image
                  source={require('../assets/ui/icons/check_in.png')}
                  style={styles.checkInBtnIcon}
                  resizeMode="contain"
                />
                <Text style={styles.checkInBtnLabel}>Check In</Text>
              </ImageBackground>
            )}
          </Pressable>
        )}

        {/* ── Quiet mode: checkin card ── */}
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

        {/* ── Quiet mode: play minigame button ── */}
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

        {/* ── Decorate button for selected captured space ── */}
        {selectedSpace && decorateBtnPos && (
          <Pressable
            onPress={handleDecorate}
            style={({ pressed }) => [
              styles.decorateBtn,
              {
                left: Math.max(8, Math.min(decorateBtnPos.x - 80, 260)),
                top: Math.max(60, decorateBtnPos.y),
              },
              pressed && styles.decorateBtnPressed,
            ]}
          >
            {({ pressed }) => (
              <ImageBackground
                source={pressed ? BTN_SECONDARY_PRESSED : BTN_SECONDARY_NORMAL}
                style={styles.decorateBtnBg}
                resizeMode="stretch"
              >
                <Text style={styles.decorateBtnText}>{`Decorate \u2726`}</Text>
              </ImageBackground>
            )}
          </Pressable>
        )}

        {/* ── Screen-level vignette ── */}
        <View style={styles.screenVignette} pointerEvents="none">
          <Canvas style={StyleSheet.absoluteFill}>
            <Rect x={0} y={0} width={screenW} height={screenH}>
              <RadialGradient
                c={vec(screenW / 2, screenH / 2)}
                r={Math.max(screenW, screenH) * 0.78}
                colors={['transparent', 'transparent', 'rgba(0,0,0,0.82)']}
                positions={[0, 0.45, 1]}
              />
            </Rect>
          </Canvas>
        </View>

        {/* ── Bottom sheet backdrop ── */}
        {selectedPin && (
          <Pressable style={styles.backdrop} onPress={closeSheet} />
        )}

        {/* ── Bottom sheet ── */}
        {selectedPin && (
          <Animated.View
            style={[
              styles.bottomSheet,
              { transform: [{ translateY: sheetTranslateY }] },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetLocationName}>{selectedPin.name}</Text>

            {/* Co-op indicator — shown in all non-locked states */}
            {!selectedPin.locked && selectedPin.isCoop && (
              <View style={styles.sheetCoopRow}>
                <Text style={styles.sheetCoopText}>Co-op — bring a friend!</Text>
              </View>
            )}

            {/* Bonus XP indicator — shown in all non-locked states */}
            {!selectedPin.locked && selectedPin.bonusXP && (
              <View style={styles.sheetBonusRow}>
                <Text style={styles.sheetBonusText}>Bonus XP today!</Text>
              </View>
            )}

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
                  style={[styles.sheetScanBtn, { backgroundColor: clanColor }]}
                  onPress={handleScanFromSheet}
                >
                  <Text style={styles.sheetScanBtnText}>Scan QR Code</Text>
                </Pressable>
              </>
            ) : xpExhaustedIds.has(selectedPin.locationId) && !selectedProximity?.inRange ? (
              <>
                <View style={styles.sheetStatusRow}>
                  <Text style={styles.sheetXpExhaustedDistantText}>
                    Already earned XP here today — walk over to keep practicing.
                  </Text>
                </View>
                <Pressable
                  style={[styles.sheetScanBtn, styles.sheetScanBtnDisabled]}
                  disabled
                >
                  <Text style={styles.sheetScanBtnTextDisabled}>Scan QR Code</Text>
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
                  style={[styles.sheetScanBtn, { backgroundColor: clanColor }]}
                  onPress={handleScanFromSheet}
                >
                  <Text style={styles.sheetScanBtnText}>Scan QR Code</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.sheetDistanceText}>
                  You need to be within {selectedPin.geofenceRadius}m to scan. ({formatDistance(selectedProximity?.distance ?? 0)} away)
                </Text>
                <Pressable
                  style={[styles.sheetScanBtn, styles.sheetScanBtnDisabled]}
                  disabled
                >
                  <Text style={styles.sheetScanBtnTextDisabled}>Scan QR Code</Text>
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
  mapContainer: {
    flex: 1,
    backgroundColor: PALETTE.deepGreen,
  },

  // ── HUD: Clan Badge Button (1.2x: 64→77) ──
  hudBadgeBtn: {
    position: 'absolute',
    top: 6,
    left: 10,
    width: 77,
    height: 77,
    borderRadius: 39,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 6,
    shadowColor: 'rgba(30, 20, 10, 0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    borderWidth: 3,
  },
  hudBadgeImage: {
    width: 71,
    height: 71,
    borderRadius: 36,
  },

  // ── HUD: Timer Nameplate ──
  timerNameplate: {
    position: 'absolute',
    top: 68,
    left: 100,
    width: 90,
    height: 28,
    zIndex: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerNameplateText: {
    fontFamily: FONTS.pixel,
    fontSize: 13,
    color: PALETTE.darkBrown,
    textAlign: 'center',
  },

  // ── HUD: Info Bar ──
  hudInfoBtn: {
    position: 'absolute',
    top: 12,
    left: 96,
    right: 12,
    zIndex: 20,
    elevation: 5,
  },
  hudInfoBg: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 52,
  },
  hudInfoXp: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudInfoXpIcon: {
    width: 22,
    height: 22,
    right: -5,
    marginRight: 4,
  },
  hudInfoXpText: {
    fontFamily: FONTS.pixel,
    fontSize: 14,
    right: -5,
    color: PALETTE.darkBrown,
  },
  hudInfoDivider: {
    width: 75,
    height: 16,
    backgroundColor: PALETTE.stoneGrey + '60',
    marginHorizontal: 4,
  },
  hudInfoClans: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  hudInfoClanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  hudInfoClanChipOwn: {
    opacity: 1,
  },
  hudInfoClanDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hudInfoClanScore: {
    fontFamily: FONTS.pixel,
    fontSize: 12,
    color: PALETTE.darkBrown,
  },

  // ── Right-side FAB stack (below minimap) ──
  fabStack: {
    position: 'absolute',
    top: 210,
    right: 22,
    gap: 6,
    zIndex: 18,
    alignItems: 'center',
  },
  fabBackdrop: {
    position: 'absolute',
    top: 240,
    right: -73,
    width: 240,
    height: 75,
    transform: [{ rotate: '90deg' }],
    opacity: 0.85,
    zIndex: 14,
  },
  fabButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabButtonPressed: {
    transform: [{ scale: 0.9 }],
  },
  fabIconImage: {
    width: 42,
    height: 42,
  },
  fabBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: PALETTE.mutedRose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  fabBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.pixel,
    color: '#FFFFFF',
    lineHeight: 11,
  },

  // ── Re-centre button (bottom-left, 1.2x) ──
  reCenterBtn: {
    position: 'absolute',
    bottom: 18,
    left: 14,
    width: 65,
    height: 65,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 18,
  },
  reCenterBtnPressed: {
    transform: [{ scale: 0.9 }],
  },
  reCenterImage: {
    width: 58,
    height: 58,
  },

  // ── GPS banners ──
  permissionBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: PALETTE.errorRed,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  permissionBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: FONTS.pixel,
    textAlign: 'center',
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
    fontFamily: FONTS.pixel,
  },
  weakGpsBanner: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    backgroundColor: 'rgba(212, 168, 67, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    zIndex: 15,
  },
  weakGpsBannerText: {
    color: PALETTE.darkBrown,
    fontSize: 11,
    fontFamily: FONTS.pixel,
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
    fontFamily: FONTS.pixel,
  },

  // ── Check-In button ──
  checkInBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    zIndex: 18,
    width: 150,
    height: 48,
  },
  checkInBtnPressed: {
    opacity: 0.85,
  },
  checkInBtnBg: {
    width: 150,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  checkInBtnIcon: {
    width: 22,
    height: 22,
  },
  checkInBtnLabel: {
    fontFamily: FONTS.pixel,
    fontSize: 20,
    color: '#3B1E08',
  },

  // ── Screen vignette ──
  screenVignette: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 20,
  },

  // ── Bottom sheet ──
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
    fontFamily: FONTS.heading,
    color: PALETTE.darkBrown,
    marginBottom: 4,
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
    backgroundColor: PALETTE.softGreen,
    marginRight: 6,
  },
  sheetNearbyText: {
    fontSize: 14,
    fontFamily: FONTS.pixel,
    color: PALETTE.softGreen,
  },
  sheetDistanceText: {
    fontSize: 14,
    fontFamily: FONTS.pixel,
    color: PALETTE.honeyGold,
  },
  sheetLockedText: {
    fontSize: 14,
    fontFamily: FONTS.pixel,
    color: PALETTE.errorRed,
  },
  sheetXpExhaustedText: {
    fontSize: 13,
    fontFamily: FONTS.pixel,
    color: PALETTE.stoneGrey,
  },
  sheetXpExhaustedDistantText: {
    fontSize: 13,
    fontFamily: FONTS.pixel,
    color: PALETTE.honeyGold,
  },
  sheetCoopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: PALETTE.honeyGold + '20',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sheetCoopText: {
    fontSize: 12,
    fontFamily: FONTS.pixel,
    color: PALETTE.warmBrown,
  },
  sheetBonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: PALETTE.amberLight + '30',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sheetBonusText: {
    fontSize: 12,
    fontFamily: FONTS.pixel,
    color: PALETTE.amberStrong,
  },
  sheetScanBtn: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  sheetScanBtnDisabled: {
    backgroundColor: PALETTE.stoneGrey,
  },
  sheetScanBtnText: {
    fontFamily: FONTS.pixel,
    fontSize: 15,
    color: '#FFFFFF',
  },
  sheetScanBtnTextDisabled: {
    fontFamily: FONTS.pixel,
    fontSize: 15,
    color: '#FFFFFF80',
  },

  // ── Decorate button ──
  decorateBtn: {
    position: 'absolute',
    zIndex: 19,
    width: 160,
    height: 48,
  },
  decorateBtnPressed: {
    opacity: 0.85,
  },
  decorateBtnBg: {
    width: 160,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decorateBtnText: {
    fontFamily: FONTS.pixel,
    fontSize: 20,
    color: '#3D3D3D',
    textAlign: 'center',
    marginTop: -5,
  },

  // ── Debug elements ──
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
    fontFamily: FONTS.pixel,
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
    fontFamily: FONTS.pixel,
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
    fontFamily: FONTS.pixel,
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
    fontFamily: FONTS.pixel,
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
    fontFamily: FONTS.pixel,
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
    fontFamily: FONTS.pixel,
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
    fontFamily: FONTS.pixel,
    color: PALETTE.softGreen,
  },
});
