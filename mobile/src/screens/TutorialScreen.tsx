import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';


export default function TutorialScreen() {
  const setTutorialDone = useAuthStore((s) => s.setTutorialDone);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tutorial</Text>
      <Text style={styles.subtitle}>Coming in Phase 4</Text>

      <Pressable
        style={({ pressed }) => [
          styles.skipButton,
          pressed && styles.skipButtonPressed,
        ]}
        onPress={setTutorialDone}
      >
        <Text style={styles.skipButtonText}>Skip</Text>
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
  skipButton: {
    marginTop: 32,
    backgroundColor: PALETTE.honeyGold,
    paddingVertical: 12,
    paddingHorizontal: 48,
    borderRadius: 12,
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.warmBrown,
  },
  skipButtonPressed: {
    borderBottomWidth: 0,
    transform: [{ translateY: 2 }],
  },
  skipButtonText: {
    color: PALETTE.darkBrown,
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
  },
});
