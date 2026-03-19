import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import MossPortrait from '../MossPortrait';
import MossDialogueBox from '../MossDialogueBox';

interface Scene4MossAppearsProps {
  onComplete: () => void;
}

const LINES = [
  'My name is Moss.',
  'I am what remains of the Old Chroniclers.',
  'I was built to remember the grove… even when no one else did.',
];

export default function Scene4MossAppears({ onComplete }: Scene4MossAppearsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.visualArea}>
        <View style={styles.visualRow}>
          <View style={styles.mapPlaceholder}>
            <Text style={styles.placeholderText}>[ Campus Map — Zooming In ]</Text>
          </View>
          <View style={styles.mossColumn}>
            <MossPortrait mood="neutral" />
          </View>
        </View>
      </View>
      <View style={styles.dialogueArea}>
        <MossDialogueBox lines={LINES} onComplete={onComplete} mood="neutral" />
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
    padding: 16,
  },
  visualRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapPlaceholder: {
    flex: 7,
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
  mossColumn: {
    flex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogueArea: {
    flex: 45,
    justifyContent: 'center',
  },
});
