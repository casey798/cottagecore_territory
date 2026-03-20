import React from 'react';
import { Image, StyleSheet } from 'react-native';

type MossMood = 'neutral' | 'alert' | 'warm';

const MOSS_PORTRAITS: Record<MossMood, ReturnType<typeof require>> = {
  neutral: require('../../assets/sprites/npc/elder_moss_neutral.png'),
  alert: require('../../assets/sprites/npc/elder_moss_surprised.png'),
  warm: require('../../assets/sprites/npc/elder_moss_proud.png'),
};

interface MossPortraitProps {
  mood?: MossMood;
}

export default function MossPortrait({ mood = 'neutral' }: MossPortraitProps) {
  return (
    <Image
      source={MOSS_PORTRAITS[mood]}
      style={styles.portrait}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  portrait: {
    width: 128,
    height: 128,
  },
});
