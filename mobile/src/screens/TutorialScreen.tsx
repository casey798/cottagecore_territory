import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import { lockLandscape } from '@/hooks/useScreenOrientation';
import { useLockLandscape } from '@/hooks/useScreenOrientation';

export default function TutorialScreen() {
  useLockLandscape();
  const setTutorialDone = useAuthStore((s) => s.setTutorialDone);
  const [ready, setReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Black fade: start opaque, wait for orientation change, then fade out
    const timer = setTimeout(() => {
      lockLandscape();
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setReady(true));
    }, 300);
    return () => clearTimeout(timer);
  }, [fadeAnim]);

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

      {/* Black fade overlay to mask orientation change */}
      {!ready && (
        <Animated.View
          style={[styles.fadeOverlay, { opacity: fadeAnim }]}
          pointerEvents="none"
        />
      )}
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
  fadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
});
