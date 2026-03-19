import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import MossDialogueBox from '../MossDialogueBox';

interface Scene5StirringProps {
  onComplete: () => void;
}

const LINES = [
  'But something has begun to stir again.',
  'The landmarks are waking.',
  'The clans are returning.',
  'And the territories… are ready to be claimed once more.',
];

export default function Scene5Stirring({ onComplete }: Scene5StirringProps) {
  const [mood, setMood] = useState<'neutral' | 'alert'>('neutral');

  const handleLineChange = useCallback((lineIndex: number) => {
    if (lineIndex >= 2) {
      setMood('alert');
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.visualArea}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>[ Landmarks Waking — Map Glows ]</Text>
        </View>
      </View>
      <View style={styles.dialogueArea}>
        <MossDialogueBox
          lines={LINES}
          onComplete={onComplete}
          mood={mood}
          onLineChange={handleLineChange}
        />
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
