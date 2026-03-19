import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';

const SCENE_COLORS: Record<number, string> = {
  0: PALETTE.parchmentBg,
  1: PALETTE.deepGreen,
  2: '#1A1A2E',
  3: PALETTE.darkBrown,
  4: '#1A1A2E',
  5: PALETTE.deepGreen,
  7: PALETTE.deepGreen,
  8: PALETTE.darkBrown,
  9: '#1A1A2E',
};

interface SceneBackgroundProps {
  sceneIndex: number;
  activeClanColor?: string;
}

export default function SceneBackground({
  sceneIndex,
  activeClanColor,
}: SceneBackgroundProps) {
  let backgroundColor: string;

  if (sceneIndex === 6) {
    backgroundColor = activeClanColor ?? PALETTE.darkBrown;
  } else {
    backgroundColor = SCENE_COLORS[sceneIndex] ?? PALETTE.darkBrown;
  }

  return <View style={[styles.background, { backgroundColor }]} />;
}

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
  },
});
