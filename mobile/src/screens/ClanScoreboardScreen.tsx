import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  RefreshControl,
} from 'react-native';
import { useClanScores } from '@/hooks/useClanScores';

import { useCountdown } from '@/hooks/useCountdown';
import { useAuthStore } from '@/store/useAuthStore';
import { CLAN_COLORS, PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { GAME_END_HOUR } from '@/constants/config';
import { ClanScore, ClanId } from '@/types';
import * as scoresApi from '@/api/scores';
import { useClanStore } from '@/store/useClanStore';

const CLAN_LABELS: Record<ClanId, string> = {
  ember: 'Ember',
  tide: 'Tide',
  bloom: 'Bloom',
  gale: 'Gale',
  hearth: 'Hearth',
};

function getScoringTarget(): Date {
  const now = new Date();
  const target = new Date(now);
  target.setHours(GAME_END_HOUR, 0, 0, 0);
  if (now >= target) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

interface ClanRowProps {
  item: ClanScore;
  rank: number;
  isOwnClan: boolean;
  previousXp: number | undefined;
}

function ClanRow({ item, rank, isOwnClan, previousXp }: ClanRowProps) {
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (previousXp !== undefined && previousXp !== item.todayXp) {
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [item.todayXp, previousXp, flashAnim]);

  const backgroundColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', CLAN_COLORS[item.clanId] + '30'],
  });

  return (
    <Animated.View
      style={[
        styles.row,
        isOwnClan && { borderColor: CLAN_COLORS[item.clanId], borderWidth: 2 },
        { backgroundColor },
      ]}
    >
      <View style={styles.rankContainer}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>
      <View
        style={[styles.crestDot, { backgroundColor: CLAN_COLORS[item.clanId] }]}
      />
      <View style={styles.clanInfo}>
        <Text style={styles.clanName}>{CLAN_LABELS[item.clanId]}</Text>
        {item.rosterSize > 0 && (
          <Text style={styles.participationText}>
            ({Math.round((item.todayParticipants / item.rosterSize) * 100)}% played today)
          </Text>
        )}
      </View>
      <View style={styles.statCol}>
        <Text style={styles.statLabel}>Today</Text>
        <Text style={styles.statValue}>{item.todayXp}</Text>
      </View>
      <View style={styles.statCol}>
        <Text style={styles.statLabel}>Season</Text>
        <Text style={styles.statValue}>{item.seasonXp}</Text>
      </View>
      <View style={styles.statCol}>
        <Text style={styles.statLabel}>Spaces</Text>
        <Text style={styles.statValue}>{item.spacesCaptured}</Text>
      </View>
    </Animated.View>
  );
}

export default function ClanScoreboardScreen() {

  const { clans, isConnected, lastUpdated } = useClanScores();
  const myClan = useAuthStore((s) => s.clan);
  const setClans = useClanStore((s) => s.setClans);
  const scoringTarget = getScoringTarget();
  const { formatted: countdown } = useCountdown(scoringTarget);
  const [refreshing, setRefreshing] = useState(false);
  const prevXpRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const c of clans) {
      next[c.clanId] = c.todayXp;
    }
    // We update *after* render so the ClanRow can compare
    const timer = setTimeout(() => {
      prevXpRef.current = next;
    }, 1000);
    return () => clearTimeout(timer);
  }, [clans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await scoresApi.getClanScores();
      if (result.success && result.data?.clans) {
        setClans(result.data.clans);
      }
    } catch {
      // Silently fail
    }
    setRefreshing(false);
  }, [setClans]);

  const renderItem = useCallback(
    ({ item, index }: { item: ClanScore; index: number }) => (
      <ClanRow
        item={item}
        rank={index + 1}
        isOwnClan={item.clanId === myClan}
        previousXp={prevXpRef.current[item.clanId]}
      />
    ),
    [myClan]
  );

  const keyExtractor = useCallback((item: ClanScore) => item.clanId, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Clan Scoreboard</Text>
        <View style={styles.headerRight}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isConnected ? '#27AE60' : '#95A5A6' },
              ]}
            />
            <Text style={styles.statusText}>
              {isConnected ? 'LIVE' : 'polling'}
            </Text>
          </View>
          <Text style={styles.countdown}>Scoring in {countdown}</Text>
        </View>
      </View>

      <FlatList
        data={clans}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
    textTransform: 'uppercase',
  },
  countdown: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.warmBrown,
  },
  list: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.cream,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '40',
  },
  rankContainer: {
    width: 28,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 18,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.darkBrown,
  },
  crestDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginHorizontal: 12,
  },
  clanInfo: {
    flex: 1,
  },
  clanName: {
    fontSize: 18,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  participationText: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginTop: 1,
  },
  statCol: {
    alignItems: 'center',
    minWidth: 64,
    marginLeft: 8,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.darkBrown,
  },
});
