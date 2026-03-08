import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { PALETTE } from '@/constants/colors';

interface Props {
  message: string | null;
  onDismiss: () => void;
}

export function ErrorToast({ message, onDismiss }: Props) {
  const [slideAnim] = useState(() => new Animated.Value(100));

  useEffect(() => {
    if (message) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const startTime = Date.now();
      const check = () => {
        if (Date.now() - startTime >= 3000) {
          Animated.timing(slideAnim, {
            toValue: 100,
            duration: 300,
            useNativeDriver: true,
          }).start(() => onDismiss());
        } else {
          requestAnimationFrame(check);
        }
      };
      requestAnimationFrame(check);
    }
  }, [message, slideAnim, onDismiss]);

  if (!message) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
    backgroundColor: PALETTE.mutedRose,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 200,
  },
  text: {
    color: PALETTE.cream,
    fontSize: 14,
    fontWeight: '600',
  },
});
