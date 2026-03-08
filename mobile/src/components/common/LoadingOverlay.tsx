import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { PALETTE, UI } from '@/constants/colors';

interface Props {
  visible: boolean;
}

export function LoadingOverlay({ visible }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <ActivityIndicator size="large" color={PALETTE.honeyGold} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: UI.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
});
