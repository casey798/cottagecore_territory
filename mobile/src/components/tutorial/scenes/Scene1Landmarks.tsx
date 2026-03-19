import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import NarratorCard from '../NarratorCard';

interface Scene1LandmarksProps {
  onComplete: () => void;
}

const LINES = [
  'But the grove was never empty.',
  'For centuries, five clans lived here — not in castles or kingdoms, but in courtyards, gardens, and the spaces between the stones.',
  'And though they shared the land… each clan guarded places they called their own.',
  'Paths became borders. Landmarks became territories.',
];

export default function Scene1Landmarks({ onComplete }: Scene1LandmarksProps) {
  return (
    <View style={styles.container}>
      <View style={styles.visualArea}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            [ Campus Landmarks — Library, Trees, Courtyards ]
          </Text>
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
    backgroundColor: '#2D5A27',
    borderWidth: 1,
    borderColor: PALETTE.cream,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: PALETTE.cream,
    textAlign: 'center',
  },
  narratorArea: {
    flex: 45,
    justifyContent: 'center',
  },
});
