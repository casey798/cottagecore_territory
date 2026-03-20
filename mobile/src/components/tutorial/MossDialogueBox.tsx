import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  Pressable,
  Animated,
  StyleSheet,
} from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import MossPortrait from './MossPortrait';

const dialogueFrame = require('../../assets/ui/frames/dialogue_frame.png');
const dialogueNameplate = require('../../assets/ui/frames/dialogue_nameplate.png');

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
    <Pressable onPress={handleTap} style={styles.wrapper}>
      {/* Nameplate positioned above the frame, overlapping top edge */}
      <View style={styles.nameplateContainer}>
        <ImageBackground
          source={dialogueNameplate}
          style={styles.nameplate}
          resizeMode="stretch"
        >
          <Text style={styles.speakerLabel}>Moss</Text>
        </ImageBackground>
      </View>

      {/* Dialogue frame with 9-slice */}
      <Image
        source={dialogueFrame}
        style={styles.frameBackground}
        resizeMode="stretch"
        // TODO: adjust capInsets after visual testing
        capInsets={{ top: 12, right: 12, bottom: 12, left: 12 }}
      />

      {/* Content overlay on top of the frame */}
      <View style={styles.content}>
        <View style={styles.row}>
          <MossPortrait mood={mood} />
          <View style={styles.speechBlock}>
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
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    position: 'relative',
    paddingTop: 14, // space for overlapping nameplate
  },
  nameplateContainer: {
    position: 'absolute',
    top: 0,
    left: 16,
    zIndex: 2,
  },
  nameplate: {
    width: 128,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speakerLabel: {
    fontFamily: FONTS.headerBold,
    fontSize: 13,
    color: PALETTE.darkBrown,
  },
  frameBackground: {
    ...StyleSheet.absoluteFillObject,
    top: 14, // align with content below nameplate overlap
  },
  content: {
    padding: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  speechBlock: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
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
