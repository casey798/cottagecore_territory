import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';

export default function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Coming in Phase 4</Text>

      <View style={styles.spacer} />

      {/* TODO: remove before launch */}
      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.signOutButtonPressed,
        ]}
        onPress={() => logout()}
      >
        <Text style={styles.signOutText}>DEV: Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: UI.background,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginTop: 8,
  },
  spacer: {
    flex: 1,
  },
  signOutButton: {
    backgroundColor: '#8B3A1A',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  signOutButtonPressed: {
    opacity: 0.8,
  },
  signOutText: {
    color: PALETTE.cream,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
});
