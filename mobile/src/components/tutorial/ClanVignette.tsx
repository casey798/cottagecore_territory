import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LORE_CLANS, PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';

type LoreClan = (typeof LORE_CLANS)[number];

interface ClanVignetteProps {
  clan: LoreClan;
}

export default function ClanVignette({ clan }: ClanVignetteProps) {
  return (
    <View style={[styles.card, { backgroundColor: clan.color }]}>
      <Text style={styles.emoji}>{clan.emoji}</Text>
      <Text style={styles.name}>{clan.name}</Text>
      <Text style={styles.element}>{clan.element}</Text>
      <Text style={styles.description} numberOfLines={2} ellipsizeMode="tail">
        {clan.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 110,
    height: 160,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 32,
    textAlign: 'center',
  },
  name: {
    fontFamily: FONTS.headerBold,
    fontSize: 18,
    color: PALETTE.cream,
    textAlign: 'center',
    marginTop: 4,
  },
  element: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: PALETTE.cream,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
  },
  description: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: PALETTE.cream,
    textAlign: 'center',
    marginTop: 4,
  },
});
