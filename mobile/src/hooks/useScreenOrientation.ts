import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import Orientation from 'react-native-orientation-locker';

/**
 * Bare lock functions (not hooks — call imperatively).
 */
export function lockPortrait() {
  Orientation.lockToPortrait();
}

export function lockLandscape() {
  Orientation.lockToLandscape();
}

export function unlockAll() {
  Orientation.unlockAllOrientations();
}

/**
 * Lock screen to portrait whenever it gains focus.
 */
export function useLockPortrait() {
  useFocusEffect(
    useCallback(() => {
      Orientation.lockToPortrait();
    }, []),
  );
}

/**
 * Lock screen to landscape whenever it gains focus.
 */
export function useLockLandscape() {
  useFocusEffect(
    useCallback(() => {
      Orientation.lockToLandscape();
    }, []),
  );
}
