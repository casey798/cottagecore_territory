import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import type { AvatarConfig } from '@/types';
import MossPortrait from '../MossPortrait';
import PresetPicker from '../PresetPicker';
import type { CharacterPreset } from '@/utils/characterPresets';

interface Scene8CharacterCreationProps {
  onComplete: (displayName: string, avatarConfig: AvatarConfig, presetId: number) => void;
}

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 20;

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
  const [selectedPreset, setSelectedPreset] = useState<CharacterPreset | null>(null);

  const isValid =
    displayName.trim().length >= MIN_NAME_LENGTH &&
    displayName.trim().length <= MAX_NAME_LENGTH &&
    selectedPreset !== null;

  const handleEnter = () => {
    if (isValid && selectedPreset) {
      onComplete(displayName.trim(), selectedPreset.avatarConfig, selectedPreset.id);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.bannerArea}>
        <StaticMossLine text="But first\u2026 the grove must know who you are. Every wanderer leaves their own mark." />
      </View>
      <View style={styles.creationArea}>
        <Text style={styles.heading}>Choose your look</Text>
        <PresetPicker
          selectedPresetId={selectedPreset?.id ?? null}
          onSelect={setSelectedPreset}
          style={styles.picker}
        />
        <View style={styles.nameRow}>
          <Text style={styles.inputLabel}>Display Name</Text>
          <TextInput
            style={styles.nameInput}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Enter name..."
            placeholderTextColor={PALETTE.stoneGrey}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Text style={styles.charHint}>
            {displayName.length} / {MAX_NAME_LENGTH}
          </Text>
        </View>
      </View>
      <View style={styles.buttonArea}>
        <Pressable
          style={[styles.enterButton, !isValid && styles.enterButtonDisabled]}
          onPress={handleEnter}
          disabled={!isValid}
        >
          <Text style={[styles.enterButtonText, !isValid && styles.enterButtonTextDisabled]}>
            Enter the Grove \u2192
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
    paddingHorizontal: 16,
  },
  heading: {
    fontFamily: FONTS.headerBold,
    fontSize: 28,
    color: PALETTE.cream,
    textAlign: 'center',
    marginBottom: 12,
  },
  picker: {
    marginBottom: 16,
  },
  nameRow: {
    marginTop: 4,
  },
  inputLabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: PALETTE.stoneGrey,
    marginBottom: 4,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.cream,
  },
  charHint: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 10,
    color: PALETTE.stoneGrey,
    marginTop: 2,
    textAlign: 'right',
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
