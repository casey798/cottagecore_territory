import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { CottageButton } from '@/components/common/CottageButton';
import AvatarPreview from '@/components/profile/AvatarPreview';
import { CHARACTER_PRESETS } from '@/utils/characterPresets';
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
  compact?: boolean;
}

export default function CharacterCreationWidget({
  initialDisplayName,
  initialPresetId,
  onComplete,
  onSkip,
  confirmLabel = 'Enter the Grove',
  style,
  compact = false,
}: CharacterCreationWidgetProps) {
  const initialIndex =
    initialPresetId != null
      ? Math.max(0, CHARACTER_PRESETS.findIndex((p) => p.id === initialPresetId))
      : 0;

  const [carouselIndex, setCarouselIndex] = useState(initialIndex);
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [touched, setTouched] = useState(false);

  const selectedPreset = CHARACTER_PRESETS[carouselIndex];

  const handlePrev = () =>
    setCarouselIndex((i) => (i - 1 + CHARACTER_PRESETS.length) % CHARACTER_PRESETS.length);
  const handleNext = () =>
    setCarouselIndex((i) => (i + 1) % CHARACTER_PRESETS.length);

  const nameError = touched ? validateName(displayName) : null;
  const isValid = validateName(displayName) === null;

  const handleConfirm = () => {
    if (!isValid) return;
    onComplete(displayName.trim(), selectedPreset.id, selectedPreset.avatarConfig);
  };

  const previewWidth = compact ? 200 : 240;
  const previewHeight = compact ? 240 : 280;

  return (
    <ImageBackground
      source={require('@/assets/ui/backgrounds/bg_plain.png')}
      resizeMode="cover"
      style={[styles.background, style]}
      imageStyle={styles.backgroundImage}
    >
      <View style={compact ? styles.contentCompact : styles.content}>

        {/* TITLE */}
        <Text style={compact ? styles.titleCompact : styles.title}>Choose your look</Text>

        {/* CAROUSEL ROW */}
        <View style={styles.carouselRow}>
          <TouchableOpacity style={styles.arrowBtn} onPress={handlePrev} activeOpacity={0.7}>
            <Text style={styles.arrowText}>&#8249;</Text>
          </TouchableOpacity>

          <View style={styles.carouselCenter}>
            <AvatarPreview
              selectedPreset={selectedPreset}
              width={previewWidth}
              height={previewHeight}
            />
            <Text style={styles.presetName}>{selectedPreset.name}</Text>
          </View>

          <TouchableOpacity style={styles.arrowBtn} onPress={handleNext} activeOpacity={0.7}>
            <Text style={styles.arrowText}>&#8250;</Text>
          </TouchableOpacity>
        </View>

        {/* DOT INDICATORS */}
        <View style={compact ? styles.dotRowCompact : styles.dotRow}>
          {CHARACTER_PRESETS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === carouselIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

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
      </View>
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

  // Content containers — standard vs compact
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
  },
  contentCompact: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 12,
    alignItems: 'center',
  },

  // Title — standard vs compact
  title: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginBottom: 8,
  },
  titleCompact: {
    fontSize: 24,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginBottom: 8,
  },

  // Carousel
  carouselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 32,
    lineHeight: 36,
    color: PALETTE.warmBrown,
    fontFamily: FONTS.headerBold,
  },
  carouselCenter: {
    alignItems: 'center',
  },
  presetName: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginTop: 4,
  },

  // Dot indicators — standard vs compact
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dotRowCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: PALETTE.honeyGold,
  },
  dotInactive: {
    backgroundColor: PALETTE.warmBrown,
    opacity: 0.4,
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
