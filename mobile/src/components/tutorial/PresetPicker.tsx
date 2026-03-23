import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
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
              isSelected ? styles.cardSelected : styles.cardUnselected,
            ]}
            onPress={() => onSelect(preset)}
            activeOpacity={0.7}
          >
            <Image
              source={preset.icon}
              style={styles.icon}
              resizeMode="contain"
            />
            <Text style={styles.label} numberOfLines={1}>
              {preset.name}
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
    width: 80,
    height: 96,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: PALETTE.parchmentBg,
    paddingVertical: 6,
  },
  cardSelected: {
    borderColor: PALETTE.honeyGold,
  },
  cardUnselected: {
    borderColor: PALETTE.stoneGrey,
  },
  icon: {
    width: 64,
    height: 64,
  },
  label: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginTop: 2,
  },
});
