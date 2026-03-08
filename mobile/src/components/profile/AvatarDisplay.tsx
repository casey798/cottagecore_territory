import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CLAN_COLORS, PALETTE } from '@/constants/colors';
import { ClanId } from '@/types';

interface Props {
  clan: ClanId;
  displayName?: string;
  size?: number;
}

export function AvatarDisplay({ clan, displayName, size = 48 }: Props) {
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';
  const clanColor = CLAN_COLORS[clan];

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: clanColor,
        },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4, color: clanColor }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 3,
    backgroundColor: PALETTE.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontWeight: 'bold',
  },
});
