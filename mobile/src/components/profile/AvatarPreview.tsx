import React from 'react';
import { View, Text, Image, ImageBackground, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import type { CharacterPreset } from '@/utils/characterPresets';

const dialogueFrame = require('@/assets/ui/frames/dialogue_frame.png');

interface AvatarPreviewProps {
  selectedPreset: CharacterPreset | null;
}

export default function AvatarPreview({ selectedPreset }: AvatarPreviewProps) {
  return (
    <ImageBackground
      source={dialogueFrame}
      resizeMode="stretch"
      style={styles.frame}
      imageStyle={styles.frameImage}
    >
      {selectedPreset && (
        <Image
          source={selectedPreset.fullBody}
          style={styles.fullBody}
          resizeMode="contain"
        />
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 220,
    height: 325,
    alignSelf: 'center',
    marginLeft: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  frameImage: {
    width: '100%',
    height: '100%',
  },
  placeholderText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.stoneGrey,
  },
  fullBody: {
    width: 148,
    height: 188,
    marginRight: 20,
  },
});
