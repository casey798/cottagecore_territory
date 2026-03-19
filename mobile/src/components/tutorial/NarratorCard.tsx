import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
} from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';

interface NarratorCardProps {
  lines: string[];
  onComplete: () => void;
}

export default function NarratorCard({ lines, onComplete }: NarratorCardProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const blinkAnim = useRef(new Animated.Value(1)).current;

  const isLastLine = currentLineIndex >= lines.length - 1;

  useEffect(() => {
    if (isLastLine) {
      blinkAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [isLastLine, blinkAnim]);

  const handleTap = () => {
    if (isLastLine) {
      onComplete();
    } else {
      setCurrentLineIndex((prev) => prev + 1);
    }
  };

  return (
    <Pressable style={styles.container} onPress={handleTap}>
      <Text style={styles.lineText}>{lines[currentLineIndex]}</Text>
      <View style={styles.indicatorRow}>
        {isLastLine ? (
          <Text style={styles.continueText}>Continue →</Text>
        ) : (
          <Animated.Text style={[styles.blinkIndicator, { opacity: blinkAnim }]}>
            ▶
          </Animated.Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(61,43,31,0.85)',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineText: {
    fontFamily: FONTS.headerBold,
    fontSize: 20,
    lineHeight: 30,
    color: PALETTE.cream,
    textAlign: 'center',
  },
  indicatorRow: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  blinkIndicator: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.cream,
  },
  continueText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.cream,
  },
});
