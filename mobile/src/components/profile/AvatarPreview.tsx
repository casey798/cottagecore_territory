import React from 'react';
import { Image, ImageBackground, StyleSheet } from 'react-native';
import type { CharacterPreset } from '@/utils/characterPresets';

const dialogueFrame = require('@/assets/ui/frames/dialogue_frame.png');

interface AvatarPreviewProps {
  selectedPreset: CharacterPreset | null;
  width?: number;
  height?: number;
}

function makeStyles(w: number, h: number) {
  const wScale = w / 220;
  const hScale = h / 325;
  return StyleSheet.create({
    frame: {
      width: w,
      height: h,
      alignSelf: 'center',
      marginLeft: Math.round(30 * wScale),
      alignItems: 'center',
      justifyContent: 'center',
      padding: Math.round(16 * wScale),
    },
    fullBody: {
      width: Math.round(148 * wScale),
      height: Math.round(188 * hScale),
      marginRight: Math.round(20 * wScale),
    },
  });
}

const staticStyles = StyleSheet.create({
  frameImage: {
    width: '100%',
    height: '100%',
  },
});

export default function AvatarPreview({ selectedPreset, width = 120, height = 140 }: AvatarPreviewProps) {
  const dynStyles = React.useMemo(() => makeStyles(width, height), [width, height]);
  return (
    <ImageBackground
      source={dialogueFrame}
      resizeMode="stretch"
      style={dynStyles.frame}
      imageStyle={staticStyles.frameImage}
    >
      {selectedPreset && (
        <Image
          source={selectedPreset.fullBody}
          style={dynStyles.fullBody}
          resizeMode="contain"
        />
      )}
    </ImageBackground>
  );
}
