import React, { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Image,
  Text,
  ImageSourcePropType,
} from 'react-native';
import { MAP_TILE_SIZE } from '@/constants/config';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { Location } from '@/types';
import { useLocationLockTimer } from '@/hooks/useLocationLockTimer';

const PIN_IMAGES = {
  active: require('../../assets/sprites/pins/pin_key.png'),
  locked: require('../../assets/sprites/pins/pin_lock.png'),
  coop: require('../../assets/sprites/pins/pin_coop.png'),
  done: require('../../assets/sprites/pins/pin_done.png'),
  bonus: require('../../assets/sprites/pins/pin_bonus.png'),
};

const PIN_SIZE = 30;
const CONTAINER_SIZE = 42;

function getPinImage(isLocked: boolean, isCoop: boolean, xpExhausted: boolean, bonusXP: boolean): ImageSourcePropType {
  if (isLocked) return PIN_IMAGES.locked;
  if (xpExhausted) return PIN_IMAGES.done;
  if (isCoop) return PIN_IMAGES.coop;
  if (bonusXP) return PIN_IMAGES.bonus;
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
  lockedUntil?: string;
}

export function MapPin({ location, pixelX, pixelY, onPress, xpExhausted, isCoop, lockedUntil, inRange, bonusXP }: Props) {
  const snappedX = Math.round(pixelX / MAP_TILE_SIZE) * MAP_TILE_SIZE;
  const snappedY = Math.round(pixelY / MAP_TILE_SIZE) * MAP_TILE_SIZE;

  const lockTimer = useLocationLockTimer(location.locked ? lockedUntil : undefined);
  const isLocked = location.locked && lockTimer.isLocked;
  const isXpExhausted = !isLocked && !!xpExhausted;
  const isCoopPin = !isLocked && !isXpExhausted && !!isCoop;
  const isBonusXP = !isLocked && !isXpExhausted && !isCoopPin && !!bonusXP;

  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const pinSource = getPinImage(isLocked, isCoopPin, isXpExhausted, isBonusXP);

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
      <View style={styles.pinImageShadow}>
        <Image
          source={pinSource}
          style={styles.pinImage}
          resizeMode="contain"
        />
      </View>
      {isLocked && (
        <Text style={styles.lockTimerText}>{lockTimer.formattedTime}</Text>
      )}
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
  lockTimerText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: PALETTE.warmBrown,
    textAlign: 'center',
    marginTop: 1,
  },
});
