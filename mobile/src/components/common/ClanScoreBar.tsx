import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CLAN_COLORS, PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { ClanScore, ClanId } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';

interface Props {
  scores: ClanScore[];
}

export function ClanScoreBar({ scores }: Props) {
  const playerClan = useAuthStore((s) => s.clan);

  return (
    <View style={styles.container}>
      {scores.map((clan) => {
        const isPlayerClan = playerClan === clan.clanId;
        return (
          <View
            key={clan.clanId}
            style={[
              styles.clanChip,
              isPlayerClan && {
                borderWidth: 1.5,
                borderColor: CLAN_COLORS[clan.clanId],
                backgroundColor: CLAN_COLORS[clan.clanId] + '20',
              },
            ]}
          >
            <View
              style={[
                styles.accentBar,
                { backgroundColor: CLAN_COLORS[clan.clanId] },
              ]}
            />
            <Text style={[styles.clanName, isPlayerClan && { color: CLAN_COLORS[clan.clanId] }]}>
              {clan.clanId.charAt(0).toUpperCase() + clan.clanId.slice(1)}
            </Text>
            <Text style={[styles.clanXp, isPlayerClan && { color: PALETTE.darkBrown }]}>
              {clan.todayXp}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  clanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.cream,
    borderRadius: 6,
    overflow: 'hidden',
    paddingRight: 8,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 6,
  },
  clanName: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginRight: 4,
  },
  clanXp: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.stoneGrey,
  },
});
