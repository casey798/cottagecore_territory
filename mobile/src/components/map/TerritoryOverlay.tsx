import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CLAN_COLORS } from '@/constants/colors';
import { ClanId } from '@/types';

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  clan: ClanId;
}

export function TerritoryOverlay({ x, y, width, height, clan }: Props) {
  return (
    <View
      style={[
        styles.overlay,
        {
          left: x,
          top: y,
          width,
          height,
          backgroundColor: CLAN_COLORS[clan],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    opacity: 0.3,
    borderRadius: 4,
  },
});
