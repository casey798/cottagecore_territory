import React, { useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { GAME_START_HOUR } from '@/constants/config';
import { useAuthStore } from '@/store/useAuthStore';
import { useMapStore } from '@/store/useMapStore';
import { useGameStore } from '@/store/useGameStore';
import { useClanScores } from '@/hooks/useClanScores';
import { useGPS } from '@/hooks/useGPS';
import { useCountdown } from '@/hooks/useCountdown';
import { getEndOfGameTimeToday, isWithinGameHours } from '@/utils/time';
import { gpsToPixel } from '@/utils/affineTransform';
import { ClanScoreBar } from '@/components/common/ClanScoreBar';
import { CountdownTimer } from '@/components/common/CountdownTimer';
import { MapCanvas } from '@/components/map/MapCanvas';
import { DebugPanel } from '@/components/common/DebugPanel';
import * as mapApi from '@/api/map';
import { Location } from '@/types';

type Nav = NativeStackNavigationProp<MainModalParamList>;

export default function MainMapScreen() {
  const navigation = useNavigation<Nav>();
  const { clans: scores } = useClanScores();
  const gps = useGPS();
  const clan = useAuthStore((s) => s.clan);
  const loadMapConfig = useMapStore((s) => s.loadMapConfig);
  const loadTodayLocations = useMapStore((s) => s.loadTodayLocations);
  const loadCapturedSpaces = useMapStore((s) => s.loadCapturedSpaces);
  const updatePlayerPosition = useMapStore((s) => s.updatePlayerPosition);
  const todayLocations = useMapStore((s) => s.todayLocations ?? []);
  const mapConfig = useMapStore((s) => s.mapConfig);
  const setTodayLocations = useGameStore((s) => s.setTodayLocations);
  const setDailyInfo = useGameStore((s) => s.setDailyInfo);
  const setSelectedLocation = useGameStore((s) => s.setSelectedLocation);
  const dailyInfo = useGameStore((s) => s.dailyInfo);
  const currentStreak = useAuthStore((s) => s.userId); // placeholder — streak from profile

  const endOfGame = useMemo(() => getEndOfGameTimeToday(), []);
  const countdown = useCountdown(endOfGame);
  const gameActive = isWithinGameHours();

  useEffect(() => {
    loadMapConfig();
    loadTodayLocations();
    loadCapturedSpaces();
  }, [loadMapConfig, loadTodayLocations, loadCapturedSpaces]);

  // Load daily info and sync today locations to game store
  useEffect(() => {
    async function loadDailyData() {
      try {
        const result = await mapApi.getDailyInfo();
        console.log('[daily/info] response:', JSON.stringify(result, null, 2));
        if (result.success && result.data) {
          setDailyInfo(result.data);
        }
      } catch (err) {
        console.warn('[daily/info] exception:', err);
      }
    }
    loadDailyData();
  }, [setDailyInfo]);

  // Log map dimensions when config loads
  useEffect(() => {
    if (mapConfig) {
      console.log('[map] dimensions:', mapConfig.mapWidth, mapConfig.mapHeight, 'transform matrix:', JSON.stringify(mapConfig.transformMatrix));
    }
  }, [mapConfig]);

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

  const handleScanQR = useCallback(() => {
    setSelectedLocation(null);
    navigation.navigate('QRScanner');
  }, [navigation, setSelectedLocation]);

  const handlePinPress = useCallback(
    (location: Location) => {
      setSelectedLocation(location.locationId);
      navigation.navigate('QRScanner', { locationName: location.name });
    },
    [navigation, setSelectedLocation],
  );

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  const renderLocationItem = ({ item }: { item: Location }) => (
    <Pressable
      onPress={() => !item.locked && handlePinPress(item)}
      style={[
        styles.locationItem,
        item.locked && styles.locationItemLocked,
      ]}
    >
      <View
        style={[
          styles.locationDot,
          { backgroundColor: item.locked ? PALETTE.stoneGrey : PALETTE.softGreen },
        ]}
      />
      <Text
        style={[styles.locationName, item.locked && styles.locationNameLocked]}
      >
        {item.name}
      </Text>
      {item.locked && <Text style={styles.lockIcon}>Locked</Text>}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <ClanScoreBar scores={scores} />
        <CountdownTimer
          label="Scoring at"
          formatted={countdown.formatted}
          isExpired={countdown.isExpired}
        />
      </View>
      <View style={styles.mainArea}>
        <View style={styles.mapContainer}>
          <MapCanvas
            playerX={gameActive && playerPixel ? playerPixel.x : null}
            playerY={gameActive && playerPixel ? playerPixel.y : null}
            clan={clan}
            locations={todayLocations}
            onPinPress={handlePinPress}
          />
          {!gameActive && (
            <View style={styles.outsideHoursBanner}>
              <Text style={styles.outsideHoursText}>
                Game starts at {GAME_START_HOUR}:00 AM
              </Text>
            </View>
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
          {gps.error && gps.error !== 'PERMISSION_DENIED' && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>
                GPS error: {gps.error}
              </Text>
            </View>
          )}
          {__DEV__ && <DebugPanel />}
        </View>
        <View style={styles.sidePanel}>
          <Text style={styles.sidePanelTitle}>Today's Locations</Text>
          <View style={styles.vineDivider} />
          {dailyInfo?.targetSpace && (
            <View style={styles.targetSpaceBox}>
              <Text style={styles.targetLabel}>Today's Prize</Text>
              <Text style={styles.targetName}>{dailyInfo.targetSpace.name}</Text>
            </View>
          )}
          <FlatList
            data={todayLocations}
            renderItem={renderLocationItem}
            keyExtractor={(item) => item.locationId}
            style={styles.locationList}
          />
          <Pressable
            style={({ pressed }) => [
              styles.scanButton,
              pressed && styles.scanButtonPressed,
            ]}
            onPress={handleScanQR}
          >
            <Text style={styles.scanButtonText}>Scan QR</Text>
          </Pressable>
          {/* TODO: remove before launch */}
          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => useAuthStore.getState().logout()}
          >
            <Text style={styles.signOutButtonText}>DEV: Sign Out</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.parchmentBg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: PALETTE.parchmentBg,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.warmBrown,
  },
  mainArea: {
    flex: 1,
    flexDirection: 'row',
  },
  mapContainer: {
    flex: 7,
    backgroundColor: PALETTE.deepGreen,
  },
  sidePanel: {
    flex: 3,
    backgroundColor: PALETTE.parchmentBg,
    borderLeftWidth: 1,
    borderLeftColor: PALETTE.warmBrown,
    padding: 12,
  },
  sidePanelTitle: {
    fontSize: 16,
    fontFamily: FONTS.headerBold,
    color: PALETTE.cream,
    backgroundColor: PALETTE.warmBrown,
    marginHorizontal: -12,
    marginTop: -12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 0,
  },
  vineDivider: {
    height: 1,
    backgroundColor: PALETTE.softGreen,
    marginVertical: 8,
  },
  targetSpaceBox: {
    backgroundColor: PALETTE.cream,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: PALETTE.honeyGold,
  },
  targetLabel: {
    fontSize: 10,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textTransform: 'uppercase',
  },
  targetName: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  locationList: {
    flex: 1,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: 6,
    backgroundColor: PALETTE.cream,
  },
  locationItemLocked: {
    opacity: 0.5,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  locationName: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
  },
  locationNameLocked: {
    color: PALETTE.stoneGrey,
  },
  lockIcon: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
  },
  scanButton: {
    backgroundColor: PALETTE.honeyGold,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.warmBrown,
  },
  scanButtonPressed: {
    borderBottomWidth: 0,
    transform: [{ translateY: 2 }],
  },
  scanButtonText: {
    color: PALETTE.darkBrown,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  signOutButton: {
    backgroundColor: '#8B3A1A',
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutButtonText: {
    color: PALETTE.cream,
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
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
  outsideHoursBanner: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outsideHoursText: {
    color: PALETTE.cream,
    fontSize: 16,
    fontFamily: FONTS.headerBold,
    textAlign: 'center',
    backgroundColor: 'rgba(61, 43, 31, 0.75)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    overflow: 'hidden',
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
});
