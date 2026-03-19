import React from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import type { AvatarConfig } from '@/types';
import AvatarPreview from './AvatarPreview';

const LAYER_COLORS = [
  '#D2B48C', '#C68E5B', '#F5CBA7', '#A0522D', '#8B7355',
  '#6B4226', '#E8C9A0', '#D4A574', '#B8860B', '#C4A882',
];

interface CharacterCreationPaneProps {
  value: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
}

interface PickerRowProps {
  label: string;
  count: number;
  selected: number;
  onSelect: (index: number) => void;
  showNone?: boolean;
}

function PickerRow({ label, count, selected, onSelect, showNone }: PickerRowProps) {
  const data = Array.from({ length: count }, (_, i) => i);

  return (
    <View style={styles.pickerRow}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(item) => String(item)}
        renderItem={({ item }) => {
          const isSelected = item === selected;
          const isNone = showNone && item === 0;
          const bg = isNone ? 'transparent' : LAYER_COLORS[item % LAYER_COLORS.length];

          return (
            <Pressable
              style={[
                styles.optionCell,
                { backgroundColor: bg },
                isSelected && styles.optionCellSelected,
                isNone && styles.optionCellNone,
              ]}
              onPress={() => onSelect(item)}
            >
              {isNone && <Text style={styles.noneText}>✕{'\n'}None</Text>}
            </Pressable>
          );
        }}
        contentContainerStyle={styles.optionList}
      />
    </View>
  );
}

export default function CharacterCreationPane({
  value,
  onChange,
  displayName,
  onDisplayNameChange,
}: CharacterCreationPaneProps) {
  const update = (field: keyof AvatarConfig, val: number) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <View style={styles.container}>
      <View style={styles.previewArea}>
        <AvatarPreview value={value} />
      </View>
      <ScrollView style={styles.pickersArea} contentContainerStyle={styles.pickersContent}>
        <View style={styles.nameRow}>
          <Text style={styles.pickerLabel}>Display Name</Text>
          <TextInput
            style={styles.nameInput}
            value={displayName}
            onChangeText={onDisplayNameChange}
            maxLength={20}
            placeholder="Enter name..."
            placeholderTextColor={PALETTE.stoneGrey}
          />
          <Text style={styles.charHint}>3–20 characters</Text>
        </View>
        <PickerRow
          label="Skin Tone"
          count={8}
          selected={value.skinTone}
          onSelect={(i) => update('skinTone', i)}
        />
        <PickerRow
          label="Hair Style"
          count={8}
          selected={value.hairStyle}
          onSelect={(i) => update('hairStyle', i)}
        />
        <PickerRow
          label="Hair Color"
          count={10}
          selected={value.hairColor}
          onSelect={(i) => update('hairColor', i)}
        />
        <PickerRow
          label="Outfit"
          count={8}
          selected={value.outfit}
          onSelect={(i) => update('outfit', i)}
        />
        <PickerRow
          label="Accessory"
          count={6}
          selected={value.accessory}
          onSelect={(i) => update('accessory', i)}
          showNone
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  previewArea: {
    width: '40%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickersArea: {
    width: '60%',
  },
  pickersContent: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  pickerRow: {
    marginBottom: 12,
  },
  pickerLabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: PALETTE.stoneGrey,
    marginBottom: 4,
  },
  optionList: {
    gap: 6,
  },
  optionCell: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionCellSelected: {
    borderColor: PALETTE.honeyGold,
  },
  optionCellNone: {
    borderColor: PALETTE.stoneGrey,
    borderStyle: 'dashed',
  },
  noneText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 8,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
  },
  nameRow: {
    marginBottom: 12,
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
  },
});
