import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ImageBackground,
  ScrollView,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { CottageButton } from '@/components/common/CottageButton';
import PresetPicker from '@/components/tutorial/PresetPicker';
import AvatarPreview from '@/components/profile/AvatarPreview';
import {
  getPresetById,
  type CharacterPreset,
} from '@/utils/characterPresets';
import type { AvatarConfig } from '@/types';

const NAME_REGEX = /^[a-zA-Z0-9 ]+$/;
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 20;

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_LENGTH || trimmed.length > MAX_NAME_LENGTH) {
    return `Name must be ${MIN_NAME_LENGTH}\u2013${MAX_NAME_LENGTH} characters, letters and numbers only`;
  }
  if (!NAME_REGEX.test(trimmed)) {
    return `Name must be ${MIN_NAME_LENGTH}\u2013${MAX_NAME_LENGTH} characters, letters and numbers only`;
  }
  return null;
}

interface CharacterCreationWidgetProps {
  initialDisplayName?: string;
  initialPresetId?: number;
  onComplete: (displayName: string, presetId: number, avatarConfig: AvatarConfig) => void;
  onSkip?: () => void;
  confirmLabel?: string;
  style?: ViewStyle;
}

export default function CharacterCreationWidget({
  initialDisplayName,
  initialPresetId,
  onComplete,
  onSkip,
  confirmLabel = 'Enter the Grove',
  style,
}: CharacterCreationWidgetProps) {
  const [selectedPreset, setSelectedPreset] = useState<CharacterPreset | null>(
    initialPresetId != null ? (getPresetById(initialPresetId) ?? null) : null,
  );
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [touched, setTouched] = useState(false);

  const handlePresetSelect = (preset: CharacterPreset) => {
    setSelectedPreset(preset);
  };

  const nameError = touched ? validateName(displayName) : null;
  const isValid = selectedPreset !== null && validateName(displayName) === null;

  const handleConfirm = () => {
    if (!isValid || !selectedPreset) return;
    onComplete(displayName.trim(), selectedPreset.id, selectedPreset.avatarConfig);
  };

  return (
    <ImageBackground
      source={require('@/assets/ui/backgrounds/bg_plain.png')}
      resizeMode="cover"
      style={[styles.background, style]}
      imageStyle={styles.backgroundImage}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <Text style={styles.title}>Choose your look</Text>

        {/* PRESET PICKER */}
        <PresetPicker
          selectedPresetId={selectedPreset?.id ?? null}
          onSelect={handlePresetSelect}
          style={styles.pickerArea}
        />

        {/* SELECT HINT — visible when no preset chosen */}
        {!selectedPreset && (
          <Text style={styles.selectHint}>Tap a character to select</Text>
        )}

        {/* AVATAR PREVIEW */}
        <AvatarPreview selectedPreset={selectedPreset} />

        {/* NAME INPUT */}
        <Text style={styles.inputLabel}>Display Name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={(text) => {
            setDisplayName(text);
            if (!touched) setTouched(true);
          }}
          onBlur={() => setTouched(true)}
          placeholder="Enter your name..."
          placeholderTextColor={PALETTE.stoneGrey}
          maxLength={MAX_NAME_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <View style={styles.inputFooter}>
          {nameError ? (
            <Text style={styles.nameError}>{nameError}</Text>
          ) : (
            <View />
          )}
          <Text style={styles.charCount}>
            {displayName.length} / {MAX_NAME_LENGTH}
          </Text>
        </View>

        {/* CONFIRM BUTTON */}
        <CottageButton
          title={confirmLabel}
          onPress={handleConfirm}
          disabled={!isValid}
          style={styles.confirmBtn}
        />

        {/* SKIP BUTTON (optional) */}
        {onSkip && (
          <CottageButton
            title="Skip"
            onPress={onSkip}
            variant="secondary"
            style={styles.skipBtn}
          />
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: UI.background,
  },
  backgroundImage: {
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginBottom: 12,
  },

  // Preset picker
  pickerArea: {
    marginBottom: 8,
  },
  selectHint: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.honeyGold,
    textAlign: 'center',
    marginBottom: 8,
  },

  // Name input
  inputLabel: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    alignSelf: 'flex-start',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    backgroundColor: PALETTE.parchmentBg,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
  },
  inputFooter: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
  },
  nameError: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.errorRed,
    flex: 1,
    marginRight: 8,
  },
  charCount: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
  },

  // Buttons
  confirmBtn: {
    width: '100%',
    marginTop: 8,
  },
  skipBtn: {
    width: '100%',
    marginTop: 12,
  },
});
