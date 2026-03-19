import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import type { AvatarConfig } from '@/types';
import MossPortrait from '../MossPortrait';
import CharacterCreationPane from '../CharacterCreationPane';

interface Scene8CharacterCreationProps {
  onComplete: (displayName: string, avatarConfig: AvatarConfig) => void;
}

function StaticMossLine({ text }: { text: string }) {
  return (
    <View style={styles.staticCard}>
      <View style={styles.staticRow}>
        <MossPortrait mood="neutral" />
        <View style={styles.staticSpeech}>
          <Text style={styles.staticLabel}>Moss</Text>
          <Text style={styles.staticText}>{text}</Text>
        </View>
      </View>
    </View>
  );
}

export default function Scene8CharacterCreation({
  onComplete,
}: Scene8CharacterCreationProps) {
  const [displayName, setDisplayName] = useState('');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({
    hairStyle: 1,
    hairColor: 1,
    skinTone: 1,
    outfit: 1,
    accessory: 0,
  });

  const isValid = displayName.trim().length >= 3;

  const handleEnter = () => {
    if (isValid) {
      onComplete(displayName.trim(), avatarConfig);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.bannerArea}>
        <StaticMossLine text="But first… the grove must know who you are. Every wanderer leaves their own mark." />
      </View>
      <View style={styles.creationArea}>
        <CharacterCreationPane
          value={avatarConfig}
          onChange={setAvatarConfig}
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
        />
      </View>
      <View style={styles.buttonArea}>
        <Pressable
          style={[styles.enterButton, !isValid && styles.enterButtonDisabled]}
          onPress={handleEnter}
          disabled={!isValid}
        >
          <Text style={[styles.enterButtonText, !isValid && styles.enterButtonTextDisabled]}>
            Enter the Grove →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bannerArea: {
    flex: 15,
    justifyContent: 'center',
  },
  creationArea: {
    flex: 75,
  },
  buttonArea: {
    flex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staticCard: {
    backgroundColor: 'rgba(26,26,46,0.92)',
    borderWidth: 1.5,
    borderColor: PALETTE.honeyGold,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
  },
  staticRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staticSpeech: {
    flex: 1,
    marginLeft: 12,
  },
  staticLabel: {
    fontFamily: FONTS.headerBold,
    fontSize: 13,
    color: PALETTE.honeyGold,
    marginBottom: 2,
  },
  staticText: {
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    lineHeight: 22,
    color: PALETTE.cream,
  },
  enterButton: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1.5,
    borderColor: PALETTE.honeyGold,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  enterButtonDisabled: {
    borderColor: PALETTE.stoneGrey,
    opacity: 0.5,
  },
  enterButtonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: PALETTE.honeyGold,
  },
  enterButtonTextDisabled: {
    color: PALETTE.stoneGrey,
  },
});
