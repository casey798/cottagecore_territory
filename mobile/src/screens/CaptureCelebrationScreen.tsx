import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useLockLandscape } from '@/hooks/useScreenOrientation';

export default function CaptureCelebrationScreen() {
  useLockLandscape();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Capture Celebration</Text>
      <Text style={styles.subtitle}>Coming in Phase 4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: UI.background,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginTop: 8,
  },
});
