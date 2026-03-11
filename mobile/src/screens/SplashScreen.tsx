import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import { useLockPortrait } from '@/hooks/useScreenOrientation';

export default function SplashScreen() {
  useLockPortrait();
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GroveWars</Text>
      <Text style={styles.subtitle}>Claim your territory</Text>
      <ActivityIndicator
        size="large"
        color={PALETTE.honeyGold}
        style={styles.spinner}
      />
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
    fontSize: 36,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 24,
  },
  spinner: {
    marginTop: 16,
  },
});
