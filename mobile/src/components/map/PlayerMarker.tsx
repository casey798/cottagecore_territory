import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { CLAN_COLORS } from '@/constants/colors';
import { MAP_TILE_SIZE } from '@/constants/config';
import { ClanId } from '@/types';

interface Props {
  x: number;
  y: number;
  clan: ClanId;
}

export function PlayerMarker({ x, y, clan }: Props) {
  const animX = useRef(new Animated.Value(x)).current;
  const animY = useRef(new Animated.Value(y)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animX, {
        toValue: x,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(animY, {
        toValue: y,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [x, y, animX, animY]);

  const clanColor = CLAN_COLORS[clan];

  const left = Animated.subtract(animX, 32);
  const top = Animated.subtract(animY, 32);

  return (
    <Animated.View style={[styles.container, { left, top }]}>
      <Animated.View
        style={[
          styles.accuracyRing,
          { borderColor: clanColor, backgroundColor: clanColor + '20' },
        ]}
      />
      <Animated.View style={[styles.dot, { backgroundColor: clanColor }]}>
        <Animated.View style={styles.dotInner} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accuracyRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    opacity: 0.3,
  },
  dot: {
    width: MAP_TILE_SIZE,
    height: MAP_TILE_SIZE,
    borderRadius: MAP_TILE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});
