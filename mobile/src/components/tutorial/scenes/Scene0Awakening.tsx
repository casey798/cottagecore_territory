import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import NarratorCard from '../NarratorCard';

interface Scene0AwakeningProps {
  onComplete: () => void;
}

const LINES = [
  'Long before these halls were filled with lectures and footsteps… this land was something else.',
  'It was a grove. A quiet world of winding paths and hidden corners where stories grew like wildflowers.',
];

export default function Scene0Awakening({ onComplete }: Scene0AwakeningProps) {
  return (
    <View style={styles.container}>
      <View style={styles.visualArea}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>[ Sky — Campus Descending ]</Text>
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
    backgroundColor: PALETTE.softGreen,
    borderWidth: 1,
    borderColor: PALETTE.darkBrown,
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
