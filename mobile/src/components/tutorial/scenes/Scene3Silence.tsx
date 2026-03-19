import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import NarratorCard from '../NarratorCard';

interface Scene3SilenceProps {
  onComplete: () => void;
}

const LINES = [
  'But as time passed…',
  'The clans faded.',
  'The grove fell silent.',
  'And the stories slept beneath the stones.',
];

export default function Scene3Silence({ onComplete }: Scene3SilenceProps) {
  return (
    <View style={styles.container}>
      <View style={styles.visualArea}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>[ Empty Campus Paths ]</Text>
        </View>
      </View>
      <View style={styles.narratorArea}>
        <NarratorCard lines={LINES} onComplete={onComplete} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  visualArea: {
    flex: 55,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  placeholder: {
    width: '80%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
  },
  narratorArea: {
    flex: 45,
    justifyContent: 'center',
  },
});
