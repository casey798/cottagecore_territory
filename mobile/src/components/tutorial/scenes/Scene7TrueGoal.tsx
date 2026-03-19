import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import MossDialogueBox from '../MossDialogueBox';

interface Scene7TrueGoalProps {
  onComplete: () => void;
}

const LINES = [
  'The grove rewards curiosity.',
  'Hidden things grow in quiet places.',
  'And every landmark holds power.',
  'Find them. Claim them.',
  'Let your clan flourish again.',
  'And let your banner rise across the grove.',
];

export default function Scene7TrueGoal({ onComplete }: Scene7TrueGoalProps) {
  return (
    <View style={styles.container}>
      <View style={styles.visualArea}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>[ Grove Rewards Curiosity ]</Text>
        </View>
      </View>
      <View style={styles.dialogueArea}>
        <MossDialogueBox lines={LINES} onComplete={onComplete} mood="warm" />
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
  dialogueArea: {
    flex: 45,
    justifyContent: 'center',
  },
});
