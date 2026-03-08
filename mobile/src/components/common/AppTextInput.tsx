import React, { forwardRef } from 'react';
import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';

export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  (props, ref) => {
    return (
      <TextInput
        ref={ref}
        disableFullscreenUI={true}
        placeholderTextColor={PALETTE.stoneGrey}
        {...props}
        style={[styles.base, props.style]}
      />
    );
  },
);

const styles = StyleSheet.create({
  base: {
    backgroundColor: PALETTE.cream,
    borderWidth: 1.5,
    borderColor: PALETTE.warmBrown,
    borderRadius: 10,
    color: PALETTE.darkBrown,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
