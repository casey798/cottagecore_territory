import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { CHARACTER_PRESETS, CharacterPreset } from '@/utils/characterPresets';

interface PresetPickerProps {
  selectedPresetId: number | null;
  onSelect: (preset: CharacterPreset) => void;
  style?: ViewStyle;
}

export default function PresetPicker({
  selectedPresetId,
  onSelect,
  style,
}: PresetPickerProps) {
  return (
    <View style={[styles.grid, style]}>
      {CHARACTER_PRESETS.map((preset) => {
        const isSelected = selectedPresetId === preset.id;
        return (
          <TouchableOpacity
            key={preset.id}
            style={[
              styles.card,
              { backgroundColor: preset.color },
              isSelected ? styles.cardSelected : styles.cardUnselected,
            ]}
            onPress={() => onSelect(preset)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{preset.emoji}</Text>
            <Text style={styles.label} numberOfLines={2}>
              {preset.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  card: {
    width: 72,
    height: 88,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    paddingHorizontal: 4,
  },
  cardSelected: {
    borderColor: PALETTE.honeyGold,
  },
  cardUnselected: {
    borderColor: `${PALETTE.stoneGrey}4D`, // 0.3 opacity
  },
  emoji: {
    fontSize: 40,
  },
  label: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: PALETTE.cream,
    textAlign: 'center',
    marginTop: 2,
  },
});
