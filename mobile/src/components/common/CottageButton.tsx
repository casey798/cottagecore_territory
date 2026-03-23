import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'choice';
  disabled?: boolean;
  style?: ViewStyle;
  selected?: boolean;
  accentColor?: string;
}

export function CottageButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  selected = false,
  accentColor,
}: Props) {
  const isPrimary = variant === 'primary';
  const isChoice = variant === 'choice';

  const choiceStyle: ViewStyle | undefined = isChoice
    ? {
        backgroundColor: selected ? accentColor : 'transparent',
        borderColor: selected ? accentColor : PALETTE.warmBrown,
      }
    : undefined;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        isPrimary ? styles.primary : isChoice ? styles.choice : styles.secondary,
        isChoice && choiceStyle,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.text,
          isPrimary
            ? styles.primaryText
            : isChoice
              ? selected
                ? styles.choiceSelectedText
                : styles.choiceText
              : styles.secondaryText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: PALETTE.warmBrown,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
  },
  choice: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 14,
    fontFamily: FONTS.bodyBold,
  },
  primaryText: {
    color: PALETTE.cream,
  },
  secondaryText: {
    color: PALETTE.warmBrown,
  },
  choiceText: {
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  choiceSelectedText: {
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.white,
  },
});
