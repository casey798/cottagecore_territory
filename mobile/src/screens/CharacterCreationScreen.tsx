import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/useAuthStore';
import * as playerApi from '@/api/player';
import CharacterCreationWidget from '@/components/profile/CharacterCreationWidget';
import type { AvatarConfig } from '@/types';
import { MainModalParamList } from '@/navigation/MainStack';

type Nav = NativeStackNavigationProp<MainModalParamList>;

export default function CharacterCreationScreen() {
  const navigation = useNavigation<Nav>();
  const savedPresetId = useAuthStore((s) => s.selectedPresetId);
  const savedDisplayName = useAuthStore((s) => s.displayName);
  const setSelectedPresetId = useAuthStore((s) => s.setSelectedPresetId);
  const setDisplayName = useAuthStore((s) => s.setDisplayName);

  const handleComplete = (
    displayName: string,
    presetId: number,
    avatarConfig: AvatarConfig,
  ) => {
    // Navigate immediately — fire-and-forget
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Map');
    }

    // Update store optimistically
    setSelectedPresetId(presetId);
    setDisplayName(displayName);

    // API call in background — do not block UI
    playerApi.updateAvatar(displayName, { ...avatarConfig, characterPreset: presetId }).catch((err) => {
      console.warn('CharacterCreation: failed to save avatar', err);
    });
  };

  return (
    <CharacterCreationWidget
      initialDisplayName={savedDisplayName ?? undefined}
      initialPresetId={savedPresetId ?? undefined}
      confirmLabel="Save Character"
      onComplete={handleComplete}
    />
  );
}
