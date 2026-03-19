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
import MossPortrait from './MossPortrait';

interface MossDialogueBoxProps {
  lines: string[];
  onComplete: () => void;
  mood?: 'neutral' | 'alert' | 'warm';
  onLineChange?: (lineIndex: number) => void;
}

export default function MossDialogueBox({
  lines,
  onComplete,
  mood = 'neutral',
  onLineChange,
}: MossDialogueBoxProps) {
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
      const nextIndex = currentLineIndex + 1;
      setCurrentLineIndex(nextIndex);
      onLineChange?.(nextIndex);
    }
  };

  return (
    <Pressable style={styles.card} onPress={handleTap}>
      <View style={styles.row}>
        <MossPortrait mood={mood} />
        <View style={styles.speechBlock}>
          <Text style={styles.speakerLabel}>Moss</Text>
          <Text style={styles.lineText}>{lines[currentLineIndex]}</Text>
        </View>
      </View>
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
  card: {
    backgroundColor: 'rgba(26,26,46,0.92)',
    borderWidth: 1.5,
    borderColor: PALETTE.honeyGold,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  speechBlock: {
    flex: 1,
    marginLeft: 12,
  },
  speakerLabel: {
    fontFamily: FONTS.headerBold,
    fontSize: 13,
    color: PALETTE.honeyGold,
    marginBottom: 4,
  },
  lineText: {
    fontFamily: FONTS.headerBold,
    fontSize: 18,
    lineHeight: 26,
    color: PALETTE.cream,
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
