import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';

interface Props {
  label: string;
  formatted: string;
  isExpired: boolean;
}

export function CountdownTimer({ label, formatted, isExpired }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.timeBadge, isExpired && styles.timeBadgeExpired]}>
        <Text style={[styles.time, isExpired && styles.timeExpired]}>
          {isExpired ? 'Scoring!' : formatted}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
  },
  timeBadge: {
    backgroundColor: PALETTE.cream,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeBadgeExpired: {
    backgroundColor: PALETTE.warmBrown,
  },
  time: {
    fontSize: 18,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.darkBrown,
  },
  timeExpired: {
    color: PALETTE.honeyGold,
  },
});
