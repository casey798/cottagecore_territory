import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import * as playerApi from '@/api/player';
import MossPortrait from '@/components/tutorial/MossPortrait';
import CharacterCreationWidget from '@/components/profile/CharacterCreationWidget';
import type { AvatarConfig } from '@/types';

interface TutorialCharacterSceneProps {
  onComplete: () => void;
  /**
   * Whether the user arrived here via the Skip button.
   * Informational only — routing is handled by TutorialScreen.
   */
  arrivedViaSkip: boolean;
}

export default function TutorialCharacterScene({
  onComplete,
}: TutorialCharacterSceneProps) {
  const savedDisplayName = useAuthStore((s) => s.displayName);
  const savedPresetId = useAuthStore((s) => s.selectedPresetId);
  const setSelectedPresetId = useAuthStore((s) => s.setSelectedPresetId);
  const setDisplayName = useAuthStore((s) => s.setDisplayName);

  const handleComplete = (
    displayName: string,
    presetId: number,
    avatarConfig: AvatarConfig,
  ) => {
    // Update store immediately
    setSelectedPresetId(presetId);
    setDisplayName(displayName);

    // Persist to backend — fire-and-forget
    playerApi
      .updateAvatar(displayName, { ...avatarConfig, characterPreset: presetId })
      .catch((err) => {
        console.warn('TutorialCharacterScene: failed to save avatar', err);
      });

    onComplete();
  };

  return (
    <View style={styles.container}>
      <View style={styles.mossHeader}>
        <MossPortrait mood="neutral" />
        <View style={styles.mossSpeech}>
          <Text style={styles.mossLabel}>Elder Moss</Text>
          <Text style={styles.mossLine}>
            Before the grove knows you&hellip; tell me your name.
          </Text>
        </View>
      </View>

      <View style={styles.creationArea}>
        <CharacterCreationWidget
          initialDisplayName={savedDisplayName ?? undefined}
          initialPresetId={savedPresetId ?? undefined}
          confirmLabel="Enter the Grove →"
          onComplete={handleComplete}
          compact={true}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.parchmentBg,
  },
  mossHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.darkBrown,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: PALETTE.honeyGold,
  },
  mossSpeech: {
    flex: 1,
    marginLeft: 12,
  },
  mossLabel: {
    fontFamily: FONTS.headerBold,
    fontSize: 13,
    color: PALETTE.honeyGold,
    marginBottom: 2,
  },
  mossLine: {
    fontFamily: FONTS.headerBold,
    fontSize: 16,
    lineHeight: 22,
    color: PALETTE.cream,
  },
  creationArea: {
    flex: 1,
  },
});
