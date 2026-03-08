import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { PALETTE } from '@/constants/colors';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
}

export function CottageButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: Props) {
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.text,
          isPrimary ? styles.primaryText : styles.secondaryText,
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
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  primaryText: {
    color: PALETTE.cream,
  },
  secondaryText: {
    color: PALETTE.warmBrown,
  },
});
