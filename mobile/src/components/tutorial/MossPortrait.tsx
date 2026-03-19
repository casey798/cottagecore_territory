import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';

type MossMood = 'neutral' | 'alert' | 'warm';

const MOOD_BORDER_COLORS: Record<MossMood, string> = {
  neutral: PALETTE.honeyGold,
  alert: '#C0392B',
  warm: PALETTE.softGreen,
};

interface MossPortraitProps {
  mood?: MossMood;
}

export default function MossPortrait({ mood = 'neutral' }: MossPortraitProps) {
  const borderColor = MOOD_BORDER_COLORS[mood];

  return (
    <View style={[styles.container, { borderColor }]}>
      <Text style={styles.nameText}>[ Moss ]</Text>
      <Text style={styles.glowIndicator}>◈</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 112,
    height: 112,
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.honeyGold,
  },
  glowIndicator: {
    fontSize: 13,
    color: '#2980B9',
    marginTop: 4,
  },
});
