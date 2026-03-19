import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useDebugStore } from '@/store/useDebugStore';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGPS } from '@/hooks/useGPS';

export function DebugPanel() {
  if (!__DEV__) return null;

  const [expanded, setExpanded] = useState(false);
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');

  const isDebugMode = useDebugStore((s) => s.isDebugMode);
  const debugLocation = useDebugStore((s) => s.debugLocation);
  const setDebugLocation = useDebugStore((s) => s.setDebugLocation);
  const clearDebugLocation = useDebugStore((s) => s.clearDebugLocation);
  const toggleDebugMode = useDebugStore((s) => s.toggleDebugMode);
  const toggleTapToSetMode = useDebugStore((s) => s.toggleTapToSetMode);
  const showAllMinigames = useDebugStore((s) => s.showAllMinigames);
  const setShowAllMinigames = useDebugStore((s) => s.setShowAllMinigames);
  const todayLocations = useMapStore((s) => s.todayLocations ?? []);

  // Get real GPS state (this will return debug values if debug is on,
  // but we also show the raw state for reference)
  const gps = useGPS();

  const handleSetLocation = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng)) return;
    setDebugLocation(lat, lng);
  };

  const handleQuickLocation = (lat: number, lng: number) => {
    setLatInput(lat.toString());
    setLngInput(lng.toString());
    setDebugLocation(lat, lng);
  };

  if (!expanded) {
    return (
      <Pressable
        style={styles.collapsedButton}
        onPress={() => setExpanded(true)}
      >
        <Text style={styles.collapsedButtonText}>DEBUG</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Debug Panel</Text>
        <Pressable onPress={() => setExpanded(false)}>
          <Text style={styles.closeButton}>X</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} nestedScrollEnabled>
        {/* GPS Override Toggle */}
        <View style={styles.row}>
          <Text style={styles.label}>GPS Override:</Text>
          <Pressable
            style={[
              styles.toggleButton,
              isDebugMode && styles.toggleButtonActive,
            ]}
            onPress={toggleDebugMode}
          >
            <Text style={styles.toggleButtonText}>
              {isDebugMode ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
          {isDebugMode && (
            <Pressable style={styles.clearButton} onPress={clearDebugLocation}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </Pressable>
          )}
        </View>

        {/* Show All Minigames Toggle */}
        {__DEV__ && (
          <View style={styles.row}>
            <Text style={styles.label}>All Minigames:</Text>
            <Pressable
              style={[
                styles.toggleButton,
                showAllMinigames && styles.toggleButtonActive,
              ]}
              onPress={() => setShowAllMinigames(!showAllMinigames)}
            >
              <Text style={styles.toggleButtonText}>
                {showAllMinigames ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Manual Lat/Lng Input */}
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Lat:</Text>
          <TextInput
            style={styles.input}
            value={latInput}
            onChangeText={setLatInput}
            keyboardType="numeric"
            placeholder="9.8800"
            placeholderTextColor="#666"
          />
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Lng:</Text>
          <TextInput
            style={styles.input}
            value={lngInput}
            onChangeText={setLngInput}
            keyboardType="numeric"
            placeholder="78.0830"
            placeholderTextColor="#666"
          />
        </View>
        <Pressable style={styles.setButton} onPress={handleSetLocation}>
          <Text style={styles.setButtonText}>Set Location</Text>
        </Pressable>

        {/* Quick Locations */}
        {todayLocations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Quick Locations:</Text>
            {todayLocations.map((loc) => (
              <Pressable
                key={loc.locationId}
                style={styles.quickLocation}
                onPress={() => handleQuickLocation(loc.gpsLat, loc.gpsLng)}
              >
                <Text style={styles.quickLocationText} numberOfLines={1}>
                  {loc.name}
                </Text>
                <Text style={styles.quickLocationCoords}>
                  {loc.gpsLat.toFixed(4)}, {loc.gpsLng.toFixed(4)}
                </Text>
              </Pressable>
            ))}
          </>
        )}

        {/* Sign Out */}
        <Pressable
          style={styles.signOutButton}
          onPress={() => useAuthStore.getState().logout()}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </Pressable>

        {/* Tap Map to Set Location */}
        <Pressable
          style={styles.tapMapButton}
          onPress={() => {
            toggleTapToSetMode();
            setExpanded(false);
          }}
        >
          <Text style={styles.tapMapButtonText}>Tap Map to Set Location</Text>
        </Pressable>

        {/* Current GPS Info */}
        <Text style={styles.sectionTitle}>Current GPS:</Text>
        <Text style={styles.infoText}>
          Active: {gps.latitude?.toFixed(6) ?? 'null'}, {gps.longitude?.toFixed(6) ?? 'null'}
        </Text>
        {isDebugMode && debugLocation && (
          <Text style={styles.debugActiveText}>
            Debug: {debugLocation.latitude.toFixed(6)}, {debugLocation.longitude.toFixed(6)}
          </Text>
        )}
        <Text style={styles.infoText}>
          Tracking: {gps.isTracking ? 'Yes' : 'No'} | Accuracy: {gps.accuracy?.toFixed(1) ?? '-'}m
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedButton: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(61, 43, 31, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFD700',
    zIndex: 100,
  },
  collapsedButtonText: {
    color: '#FFD700',
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
  },
  panel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 240,
    maxHeight: 320,
    backgroundColor: 'rgba(30, 20, 15, 0.92)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD70040',
  },
  headerText: {
    color: '#FFD700',
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
  },
  closeButton: {
    color: '#FFD700',
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  content: {
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    color: PALETTE.cream,
    fontSize: 10,
    fontFamily: FONTS.bodyRegular,
    marginRight: 6,
  },
  toggleButton: {
    backgroundColor: '#555',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toggleButtonActive: {
    backgroundColor: '#27AE60',
  },
  toggleButtonText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
  },
  clearButton: {
    backgroundColor: '#C0392B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  clearButtonText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: FONTS.bodySemiBold,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    color: PALETTE.cream,
    fontSize: 10,
    fontFamily: FONTS.bodyRegular,
    width: 26,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    color: '#FFF',
    fontSize: 10,
    fontFamily: FONTS.bodyRegular,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#555',
  },
  setButton: {
    backgroundColor: PALETTE.honeyGold,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 6,
  },
  setButtonText: {
    color: PALETTE.darkBrown,
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
  },
  tapMapButton: {
    backgroundColor: '#2D5A27',
    paddingVertical: 5,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  tapMapButtonText: {
    color: '#FFD700',
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
  },
  signOutButton: {
    backgroundColor: '#8B3A1A',
    paddingVertical: 5,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#A04520',
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
  },
  sectionTitle: {
    color: '#FFD700',
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
    marginTop: 4,
    marginBottom: 2,
  },
  quickLocation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 2,
  },
  quickLocationText: {
    color: PALETTE.cream,
    fontSize: 10,
    fontFamily: FONTS.bodyRegular,
    flex: 1,
  },
  quickLocationCoords: {
    color: PALETTE.stoneGrey,
    fontSize: 9,
    fontFamily: FONTS.bodyRegular,
    marginLeft: 4,
  },
  infoText: {
    color: PALETTE.stoneGrey,
    fontSize: 9,
    fontFamily: FONTS.bodyRegular,
    marginBottom: 1,
  },
  debugActiveText: {
    color: '#FFD700',
    fontSize: 9,
    fontFamily: FONTS.bodySemiBold,
    marginBottom: 1,
  },
});
