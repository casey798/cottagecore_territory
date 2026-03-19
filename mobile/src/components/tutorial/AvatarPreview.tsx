import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import type { AvatarConfig } from '@/types';

const LAYER_COLORS = [
  '#D2B48C', '#C68E5B', '#F5CBA7', '#A0522D', '#8B7355',
  '#6B4226', '#E8C9A0', '#D4A574', '#B8860B', '#C4A882',
];

interface AvatarPreviewProps {
  value: AvatarConfig;
}

export default function AvatarPreview({ value }: AvatarPreviewProps) {
  const skinColor = LAYER_COLORS[value.skinTone % LAYER_COLORS.length];
  const outfitColor = LAYER_COLORS[value.outfit % LAYER_COLORS.length];
  const hairStyleColor = LAYER_COLORS[value.hairStyle % LAYER_COLORS.length];
  const hairColorValue = LAYER_COLORS[value.hairColor % LAYER_COLORS.length];
  const accessoryColor = value.accessory === 0
    ? 'transparent'
    : LAYER_COLORS[value.accessory % LAYER_COLORS.length];

  return (
    <View style={styles.container}>
      {/* swap: skinTone sprite */}
      <View style={[styles.layer, { backgroundColor: skinColor }]} />
      {/* swap: outfit sprite */}
      <View style={[styles.layer, { backgroundColor: outfitColor }]} />
      {/* swap: hairStyle sprite */}
      <View style={[styles.layer, { backgroundColor: hairStyleColor }]} />
      {/* swap: hairColor sprite */}
      <View style={[styles.layer, { backgroundColor: hairColorValue }]} />
      {/* swap: accessory sprite */}
      <View style={[styles.layer, { backgroundColor: accessoryColor }]} />
      <Text style={styles.label}>[ Avatar Preview ]</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 160,
    height: 220,
    alignSelf: 'center',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  label: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: PALETTE.stoneGrey,
  },
});
