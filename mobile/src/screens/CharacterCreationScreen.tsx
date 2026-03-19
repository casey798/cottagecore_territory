import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PALETTE, CLAN_COLORS, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import * as playerApi from '@/api/player';
import { CHARACTER_PRESETS } from '@/utils/characterPresets';
import { MainModalParamList } from '@/navigation/MainStack';

type Nav = NativeStackNavigationProp<MainModalParamList>;

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

export default function CharacterCreationScreen() {
  const navigation = useNavigation<Nav>();
  const clan = useAuthStore((s) => s.clan);
  const clanColor = clan ? CLAN_COLORS[clan] : PALETTE.honeyGold;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const nameError = touched ? validateName(displayName) : null;
  const isValid = selectedIndex !== null && validateName(displayName) === null;

  const handleSubmit = async () => {
    if (!isValid || submitting || selectedIndex === null) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await playerApi.updateAvatar(displayName.trim(), {
        hairStyle: 0,
        hairColor: 0,
        skinTone: 0,
        outfit: 0,
        accessory: 0,
        characterPreset: selectedIndex,
      });
      if (result.success) {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      } else {
        setErrorMsg(result.error?.message ?? 'Failed to save character');
      }
    } catch {
      setErrorMsg('Network error \u2014 please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* HEADER */}
      <Text style={styles.title}>Who are you?</Text>
      <Text style={styles.subtitle}>
        Choose your character and enter your name
      </Text>

      {/* CHARACTER GRID */}
      <View style={styles.grid}>
        {CHARACTER_PRESETS.map((preset) => {
          const isSelected = selectedIndex === preset.index;
          return (
            <Pressable
              key={preset.index}
              style={[
                styles.card,
                { backgroundColor: preset.color },
                isSelected && styles.cardSelected,
                isSelected && { borderColor: clanColor },
              ]}
              onPress={() => setSelectedIndex(preset.index)}
            >
              <Text style={styles.cardEmoji}>{preset.emoji}</Text>
            </Pressable>
          );
        })}
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

      {/* ERROR */}
      {errorMsg && <Text style={styles.submitError}>{errorMsg}</Text>}

      {/* CONFIRM BUTTON */}
      <Pressable
        style={[
          styles.confirmBtn,
          {
            backgroundColor: isValid && !submitting
              ? clanColor
              : PALETTE.stoneGrey,
          },
        ]}
        onPress={handleSubmit}
        disabled={!isValid || submitting}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.confirmBtnText}>Enter the Grove</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginBottom: 28,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 28,
  },
  card: {
    width: 80,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.06 }],
  },
  cardEmoji: {
    fontSize: 36,
  },

  // Name input
  inputLabel: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    alignSelf: 'flex-start',
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

  // Submit error
  submitError: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.errorRed,
    textAlign: 'center',
    marginBottom: 12,
  },

  // Confirm button
  confirmBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  confirmBtnText: {
    fontSize: 20,
    fontFamily: FONTS.headerBold,
    color: '#FFFFFF',
  },
});
