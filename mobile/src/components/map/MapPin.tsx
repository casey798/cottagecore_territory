import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, Text } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { MAP_TILE_SIZE } from '@/constants/config';
import { Location } from '@/types';

const PIN_ICONS = ['🍄', '🌸', '🏮', '🌰'];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface Props {
  location: Location;
  pixelX: number;
  pixelY: number;
  onPress: () => void;
  eventBoosted?: boolean;
}

export function MapPin({ location, pixelX, pixelY, onPress, eventBoosted }: Props) {
  const snappedX = Math.round(pixelX / MAP_TILE_SIZE) * MAP_TILE_SIZE;
  const snappedY = Math.round(pixelY / MAP_TILE_SIZE) * MAP_TILE_SIZE;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isActive = !location.locked;

  useEffect(() => {
    if (isActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
    return undefined;
  }, [isActive, pulseAnim]);

  const pinIcon = PIN_ICONS[hashCode(location.locationId) % PIN_ICONS.length];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        { left: snappedX, top: snappedY },
      ]}
    >
      <Animated.View
        style={[
          styles.pin,
          location.locked && styles.pinLocked,
          eventBoosted && styles.pinBoosted,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Text style={styles.icon}>
          {location.locked ? '🔒' : pinIcon}
        </Text>
      </Animated.View>
      {eventBoosted && !location.locked && (
        <View style={styles.glowRing} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: MAP_TILE_SIZE,
    height: MAP_TILE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pin: {
    width: MAP_TILE_SIZE,
    height: MAP_TILE_SIZE,
    borderRadius: MAP_TILE_SIZE / 2,
    backgroundColor: PALETTE.softGreen,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: PALETTE.cream,
  },
  pinLocked: {
    backgroundColor: PALETTE.stoneGrey,
    opacity: 0.6,
  },
  pinBoosted: {
    backgroundColor: PALETTE.honeyGold,
    borderColor: '#FFD700',
  },
  icon: {
    fontSize: 14,
  },
  glowRing: {
    position: 'absolute',
    width: MAP_TILE_SIZE + 8,
    height: MAP_TILE_SIZE + 8,
    borderRadius: (MAP_TILE_SIZE + 8) / 2,
    borderWidth: 2,
    borderColor: '#FFD70060',
  },
});
