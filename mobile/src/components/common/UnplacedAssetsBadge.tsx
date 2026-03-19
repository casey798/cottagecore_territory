import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';

interface Props {
  count: number;
}

export default function UnplacedAssetsBadge({ count }: Props) {
  if (count <= 0) return null;

  const label = count >= 9 ? '9+' : String(count);

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PALETTE.mutedRose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  text: {
    fontSize: 10,
    fontFamily: FONTS.bodyBold,
    color: '#FFFFFF',
    lineHeight: 12,
  },
});
