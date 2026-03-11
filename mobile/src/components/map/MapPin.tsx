import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, Text, Alert } from 'react-native';
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
  inRange?: boolean;
  xpExhausted?: boolean;
}

export function MapPin({ location, pixelX, pixelY, onPress, inRange, xpExhausted }: Props) {
  const snappedX = Math.round(pixelX / MAP_TILE_SIZE) * MAP_TILE_SIZE;
  const snappedY = Math.round(pixelY / MAP_TILE_SIZE) * MAP_TILE_SIZE;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  const isLocked = location.locked;
  const isXpExhausted = !isLocked && xpExhausted;
  const isInRange = !isLocked && !isXpExhausted && inRange;

  // Pulse animation only for in-range pins
  useEffect(() => {
    if (!isInRange) {
      pulseAnim.setValue(1);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isInRange, pulseAnim]);

  // Sparkle rotation for in-range pins
  useEffect(() => {
    if (!isInRange) {
      sparkleAnim.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(sparkleAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isInRange, sparkleAnim]);

  const pinIcon = PIN_ICONS[hashCode(location.locationId) % PIN_ICONS.length];

  const handlePress = useCallback(() => {
    if (isLocked) {
      Alert.alert(
        location.name,
        'The grove has closed this path for today...',
      );
      return;
    }
    onPress();
  }, [isLocked, onPress, location.name]);

  const sparkleRotate = sparkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.container,
        { left: snappedX, top: snappedY },
      ]}
    >
      {isInRange && (
        <Animated.View
          style={[
            styles.sparkleRing,
            { transform: [{ rotate: sparkleRotate }] },
          ]}
        >
          <Text style={styles.sparkleText}>✦</Text>
          <Text style={[styles.sparkleText, styles.sparkle2]}>✦</Text>
          <Text style={[styles.sparkleText, styles.sparkle3]}>✦</Text>
          <Text style={[styles.sparkleText, styles.sparkle4]}>✦</Text>
        </Animated.View>
      )}
      <View
        style={[
          styles.pin,
          isLocked && styles.pinLocked,
          isXpExhausted && styles.pinXpExhausted,
          isInRange && styles.pinInRange,
          !isLocked && !isXpExhausted && !isInRange && styles.pinOutOfRange,
        ]}
      >
        <Text style={styles.icon}>
          {isLocked ? '🔒' : pinIcon}
        </Text>
      </View>
      {isXpExhausted && (
        <View style={styles.exhaustedBadge}>
          <Text style={styles.exhaustedStar}>☆</Text>
        </View>
      )}
      {isInRange && (
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
  pinInRange: {
    backgroundColor: PALETTE.honeyGold,
    borderColor: '#FFD700',
  },
  pinXpExhausted: {
    backgroundColor: PALETTE.stoneGrey,
    opacity: 0.55,
    borderColor: PALETTE.stoneGrey,
  },
  pinOutOfRange: {
    opacity: 0.45,
    backgroundColor: PALETTE.stoneGrey,
  },
  exhaustedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  exhaustedStar: {
    fontSize: 10,
    color: PALETTE.stoneGrey,
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
  sparkleRing: {
    position: 'absolute',
    width: MAP_TILE_SIZE + 16,
    height: MAP_TILE_SIZE + 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleText: {
    position: 'absolute',
    fontSize: 8,
    color: '#FFD700',
    top: 0,
    alignSelf: 'center',
  },
  sparkle2: {
    top: undefined,
    bottom: 0,
  },
  sparkle3: {
    top: undefined,
    left: 0,
    alignSelf: undefined,
  },
  sparkle4: {
    top: undefined,
    right: 0,
    alignSelf: undefined,
  },
});
