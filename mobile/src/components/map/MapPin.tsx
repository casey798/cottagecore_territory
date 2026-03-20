import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  Image,
  Easing,
  ImageSourcePropType,
} from 'react-native';
import { PALETTE } from '@/constants/colors';
import { MAP_TILE_SIZE } from '@/constants/config';
import { Location } from '@/types';

const PIN_IMAGES = {
  active: require('../../assets/sprites/pins/pin_key.png'),
  locked: require('../../assets/sprites/pins/pin_lock.png'),
  coop: require('../../assets/sprites/pins/pin_coop.png'),
};

const PIN_SIZE = 30;
const CONTAINER_SIZE = 42;

function getPinImage(isLocked: boolean, isCoop: boolean): ImageSourcePropType {
  if (isLocked) return PIN_IMAGES.locked;
  if (isCoop) return PIN_IMAGES.coop;
  return PIN_IMAGES.active;
}

interface Props {
  location: Location;
  pixelX: number;
  pixelY: number;
  onPress: () => void;
  inRange?: boolean;
  xpExhausted?: boolean;
  bonusXP?: boolean;
  isCoop?: boolean;
}

export function MapPin({ location, pixelX, pixelY, onPress, inRange, xpExhausted, bonusXP, isCoop }: Props) {
  const snappedX = Math.round(pixelX / MAP_TILE_SIZE) * MAP_TILE_SIZE;
  const snappedY = Math.round(pixelY / MAP_TILE_SIZE) * MAP_TILE_SIZE;
  const glowAnim = useRef(new Animated.Value(1)).current;

  const isLocked = location.locked;
  const isXpExhausted = !isLocked && xpExhausted;
  const isInRange = !isLocked && !isXpExhausted && inRange;
  const isBoosted = !isLocked && !isXpExhausted && bonusXP;
  const isCoopPin = !isLocked && !!isCoop;
  const isDefaultActive = !isLocked && !isXpExhausted && !isInRange && !isBoosted && !isCoopPin;

  useEffect(() => {
    if (isInRange || isBoosted) {
      const targetScale = isBoosted ? 1.2 : 1.15;
      const duration = isBoosted ? 1200 : 1500;
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: targetScale,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 1.0,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
    glowAnim.setValue(1);
    return undefined;
  }, [isInRange, isBoosted, glowAnim]);

  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const pinSource = getPinImage(isLocked, isCoopPin);

  const showGlow = isDefaultActive || isInRange || isBoosted || isXpExhausted || (isCoopPin && !isInRange && !isBoosted);
  const glowStyle = isBoosted
    ? styles.glowEvent
    : isInRange
      ? styles.glowInRange
      : isCoopPin
        ? styles.glowCoop
        : isXpExhausted
          ? styles.glowExhausted
          : isDefaultActive
            ? styles.glowDefault
            : null;
  const animateGlow = isInRange || isBoosted;

  // Compute glow centering offset
  const glowW = isBoosted ? 42 : isInRange ? 40 : isCoopPin ? 38 : isXpExhausted ? 32 : isDefaultActive ? 36 : 0;
  const glowOffset = (CONTAINER_SIZE - glowW) / 2;

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.pinContainer,
        {
          left: snappedX - CONTAINER_SIZE / 2,
          top: snappedY - CONTAINER_SIZE / 2,
        },
      ]}
    >
      {showGlow && glowStyle && (
        <Animated.View
          style={[
            styles.glowBase,
            glowStyle,
            { top: glowOffset, left: glowOffset },
            animateGlow ? { transform: [{ scale: glowAnim }] } : undefined,
          ]}
        />
      )}

      <View style={styles.pinImageShadow}>
        <Image
          source={pinSource}
          style={[
            styles.pinImage,
            isLocked && styles.pinImageLocked,
            isXpExhausted && styles.pinImageExhausted,
          ]}
          resizeMode="contain"
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pinContainer: {
    position: 'absolute',
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },

  glowBase: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowDefault: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 248, 225, 0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(210, 170, 80, 0.50)',
  },
  glowInRange: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 240, 180, 0.65)',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.75)',
  },
  glowEvent: {
    width: 42,
    height: 42,
    backgroundColor: 'rgba(255, 235, 160, 0.70)',
    borderWidth: 2.5,
    borderColor: 'rgba(255, 200, 50, 0.80)',
  },
  glowCoop: {
    width: 38,
    height: 38,
    backgroundColor: 'rgba(255, 245, 210, 0.50)',
    borderWidth: 1.5,
    borderColor: 'rgba(200, 165, 60, 0.55)',
  },
  glowExhausted: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(180, 175, 165, 0.30)',
  },

  pinImageShadow: {
    elevation: 4,
    shadowColor: 'rgba(50, 35, 20, 0.7)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 3,
  },
  pinImage: {
    width: PIN_SIZE,
    height: PIN_SIZE,
  },
  pinImageLocked: {
    opacity: 0.5,
  },
  pinImageExhausted: {
    opacity: 0.6,
  },
});
