import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import MossDialogueBox from '../MossDialogueBox';

const elderMossStanding = require('../../../assets/sprites/npc/elder_moss_standing.png');

interface Scene4MossAppearsProps {
  onComplete: () => void;
}

const LINES = [
  'My name is Moss.',
  'I am what remains of the Old Chroniclers.',
  'I was built to remember the grove\u2026 even when no one else did.',
];

export default function Scene4MossAppears({ onComplete }: Scene4MossAppearsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.visualArea}>
        <Image
          source={elderMossStanding}
          style={styles.standingSprite}
          resizeMode="contain"
        />
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
    alignItems: 'center',
    padding: 16,
  },
  standingSprite: {
    width: 200,
    height: 280,
  },
  dialogueArea: {
    flex: 45,
    justifyContent: 'center',
  },
});
