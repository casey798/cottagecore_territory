import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LORE_CLANS, PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import ClanVignetteRow from '../ClanVignetteRow';
import NarratorCard from '../NarratorCard';

interface Scene2ClansProps {
  onComplete: () => void;
}

const LINES = [
  'Seekers. Guardians. Makers. Wardens. Chroniclers.',
  'Five clans. Five ways of seeing the world.',
  'Five reasons the grove was never truly empty.',
];

export default function Scene2Clans({ onComplete }: Scene2ClansProps) {
  const [narratorVisible, setNarratorVisible] = useState(false);

  const handleAnimationComplete = useCallback(() => {
    setNarratorVisible(true);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.titleArea}>
        <Text style={styles.title}>The Five Clans</Text>
      </View>
      <View style={styles.vignetteArea}>
        <ClanVignetteRow
          clans={LORE_CLANS}
          onAnimationComplete={handleAnimationComplete}
        />
      </View>
      <View style={styles.narratorArea}>
        <View style={narratorVisible ? styles.visible : styles.hidden}>
          <NarratorCard lines={LINES} onComplete={onComplete} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleArea: {
    flex: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: FONTS.headerBold,
    fontSize: 24,
    color: PALETTE.honeyGold,
    textAlign: 'center',
  },
  vignetteArea: {
    flex: 55,
    justifyContent: 'center',
  },
  narratorArea: {
    flex: 25,
    justifyContent: 'center',
  },
  visible: {
    opacity: 1,
  },
  hidden: {
    opacity: 0,
  },
});
