import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  Pressable,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { useAuthStore } from '@/store/useAuthStore';
import { CLAN_COLORS, PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { ClanId, SeasonSummaryData } from '@/types';
import * as scoresApi from '@/api/scores';

type Nav = NativeStackNavigationProp<MainModalParamList>;

const CLAN_LABELS: Record<ClanId, string> = {
  ember: 'Ember',
  tide: 'Tide',
  bloom: 'Bloom',
  gale: 'Gale',
  hearth: 'Hearth',
};

const CLAN_EMOJIS: Record<ClanId, string> = {
  ember: '\uD83D\uDD25',
  tide: '\uD83C\uDF0A',
  bloom: '\uD83C\uDF3B',
  gale: '\uD83C\uDF43',
  hearth: '\uD83C\uDFE0',
};

const STAT_ICONS = ['\u2B50', '\uD83C\uDFC6', '\uD83D\uDD25', '\uD83D\uDDFA\uFE0F'];
const STAT_LABELS = ['Season XP', 'Total Wins', 'Best Streak', 'Spaces Discovered'];
const COUNT_UP_DURATION = 800;

function AnimatedStatValue({ value, isReady }: { value: number; isReady: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isReady || value <= 0) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: value,
      duration: COUNT_UP_DURATION,
      useNativeDriver: false,
    }).start();
  }, [value, isReady, anim]);

  useEffect(() => {
    if (!isReady) return;
    const listenerId = anim.addListener(({ value: v }) => {
      setDisplay(Math.round(v));
    });
    return () => anim.removeListener(listenerId);
  }, [anim, isReady]);

  return <Text style={styles.statCardValue}>{isReady ? display : 0}</Text>;
}

function BarChart({ clans }: { clans: SeasonSummaryData['clans'] }) {
  const maxSpaces = Math.max(...clans.map((c) => c.spacesCaptured), 1);
  const sorted = [...clans].sort((a, b) => b.spacesCaptured - a.spacesCaptured);
  const barAnims = useRef(sorted.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      80,
      barAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        })
      )
    ).start();
  }, [barAnims]);

  return (
    <View style={styles.barChartContainer}>
      {sorted.map((clan, i) => {
        const fraction = clan.spacesCaptured / maxSpaces;
        const width = barAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', `${Math.max(fraction * 100, 2)}%`],
        });
        return (
          <View key={clan.clanId} style={styles.barRow}>
            <Text style={styles.barLabel}>{CLAN_LABELS[clan.clanId]}</Text>
            <View style={styles.barTrack}>
              <Animated.View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: CLAN_COLORS[clan.clanId],
                    width,
                  },
                ]}
              />
            </View>
            <Text style={styles.barCount}>{clan.spacesCaptured}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function SeasonSummaryScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.userId);
  const myClan = useAuthStore((s) => s.clan);
  const [data, setData] = useState<SeasonSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Banner shimmer animation
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const result = await scoresApi.getSeasonSummary();
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setErrorMsg(result.error?.message ?? 'Failed to load season summary');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleShare = useCallback(async () => {
    if (!data || !myClan) return;
    const clanName = CLAN_LABELS[myClan];
    const { seasonXp, bestStreak, totalWins } = data.playerStats;
    const message = `I played GroveWars this season with ${clanName}! \uD83C\uDF3F Season XP: ${seasonXp} | Best Streak: ${bestStreak} | Total Wins: ${totalWins}`;
    try {
      await Share.share({ message });
    } catch {
      // User cancelled or share failed
    }
  }, [data, myClan]);

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator
          size="large"
          color={myClan ? CLAN_COLORS[myClan] : PALETTE.honeyGold}
        />
        <Text style={styles.loadingText}>Loading season results...</Text>
      </View>
    );
  }

  if (errorMsg || !data) {
    return (
      <View style={styles.centeredContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMsg ?? 'Something went wrong'}</Text>
          <Pressable style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const winnerClan = data.winnerClan;
  const winnerColor = winnerClan ? CLAN_COLORS[winnerClan] : PALETTE.honeyGold;
  const bannerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  // Find current player rank in leaderboards
  const playerXpIndex = data.topPlayersByXp.findIndex((p) => p.userId === userId);
  const playerStreakIndex = data.topPlayersByStreak.findIndex((p) => p.userId === userId);

  const statValues = [
    data.playerStats.seasonXp,
    data.playerStats.totalWins,
    data.playerStats.bestStreak,
    data.playerStats.spacesDiscovered,
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* CLOSE BUTTON */}
      <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
        <Text style={styles.closeButtonText}>{'\u2715'}</Text>
      </Pressable>

      {/* 1. WINNER BANNER */}
      <Animated.View
        style={[
          styles.bannerSection,
          { backgroundColor: winnerColor + '20', opacity: bannerOpacity },
        ]}
      >
        {winnerClan ? (
          <>
            <Text style={[styles.bannerTitle, { color: winnerColor }]}>
              {CLAN_LABELS[winnerClan]} Wins the Season!
            </Text>
            <Text style={styles.bannerEmoji}>{CLAN_EMOJIS[winnerClan]}</Text>
          </>
        ) : (
          <Text style={[styles.bannerTitle, { color: PALETTE.darkBrown }]}>
            Season Complete
          </Text>
        )}
      </Animated.View>

      {/* 2. TERRITORY RESULTS */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Territories Claimed</Text>
        <BarChart clans={data.clans} />
      </View>

      {/* 3. TOP PLAYERS (Season XP) */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Grove Champions</Text>
        {data.topPlayersByXp.map((player, i) => {
          const isMe = player.userId === userId;
          return (
            <View
              key={player.userId}
              style={[
                styles.leaderRow,
                isMe && {
                  backgroundColor: CLAN_COLORS[player.clan] + '26',
                },
              ]}
            >
              <Text style={styles.rankNum}>{i + 1}</Text>
              <View
                style={[styles.clanDot, { backgroundColor: CLAN_COLORS[player.clan] }]}
              />
              <Text style={styles.playerName} numberOfLines={1}>
                {player.displayName}
              </Text>
              <Text style={styles.playerStat}>{player.seasonXp} XP</Text>
            </View>
          );
        })}
        {playerXpIndex === -1 && userId && (
          <>
            <View style={styles.divider} />
            <View
              style={[
                styles.leaderRow,
                myClan && { backgroundColor: CLAN_COLORS[myClan] + '26' },
              ]}
            >
              <Text style={styles.rankNum}>--</Text>
              {myClan && (
                <View
                  style={[styles.clanDot, { backgroundColor: CLAN_COLORS[myClan] }]}
                />
              )}
              <Text style={styles.playerName}>Your Rank</Text>
              <Text style={styles.playerStat}>{data.playerStats.seasonXp} XP</Text>
            </View>
          </>
        )}
      </View>

      {/* 4. TOP STREAKS */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Longest Streaks</Text>
        {data.topPlayersByStreak.map((player, i) => {
          const isMe = player.userId === userId;
          return (
            <View
              key={player.userId}
              style={[
                styles.leaderRow,
                isMe && {
                  backgroundColor: CLAN_COLORS[player.clan] + '26',
                },
              ]}
            >
              <Text style={styles.rankNum}>{i + 1}</Text>
              <View
                style={[styles.clanDot, { backgroundColor: CLAN_COLORS[player.clan] }]}
              />
              <Text style={styles.playerName} numberOfLines={1}>
                {player.displayName}
              </Text>
              <Text style={styles.playerStat}>
                {player.bestStreak} {'\uD83D\uDD25'}
              </Text>
            </View>
          );
        })}
        {playerStreakIndex === -1 && userId && (
          <>
            <View style={styles.divider} />
            <View
              style={[
                styles.leaderRow,
                myClan && { backgroundColor: CLAN_COLORS[myClan] + '26' },
              ]}
            >
              <Text style={styles.rankNum}>--</Text>
              {myClan && (
                <View
                  style={[styles.clanDot, { backgroundColor: CLAN_COLORS[myClan] }]}
                />
              )}
              <Text style={styles.playerName}>Your Rank</Text>
              <Text style={styles.playerStat}>
                {data.playerStats.bestStreak} {'\uD83D\uDD25'}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* 5. MOST DECORATED SPACES (conditional) */}
      {data.mostDecoratedSpaces.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Most Loved Spaces</Text>
          {data.mostDecoratedSpaces.map((space) => (
            <View key={space.spaceId} style={styles.decoratedRow}>
              <Text style={styles.decoratedName} numberOfLines={1}>
                {space.spaceName}
              </Text>
              <Text style={styles.decoratedCount}>
                {space.decoratorCount} decorator{space.decoratorCount !== 1 ? 's' : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* 6. YOUR SEASON */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Your Season</Text>
        <View style={styles.statGrid}>
          {statValues.map((val, i) => (
            <View key={STAT_LABELS[i]} style={styles.statCard}>
              <Text style={styles.statCardIcon}>{STAT_ICONS[i]}</Text>
              <AnimatedStatValue value={val} isReady={!loading} />
              <Text style={styles.statCardLabel}>{STAT_LABELS[i]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 7. SHARE BUTTON */}
      <Pressable
        style={[
          styles.shareButton,
          { backgroundColor: myClan ? CLAN_COLORS[myClan] : PALETTE.honeyGold },
        ]}
        onPress={handleShare}
      >
        <Text style={styles.shareButtonText}>Share Your Season</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: UI.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.stoneGrey,
    marginTop: 12,
  },
  errorCard: {
    backgroundColor: PALETTE.cream,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '40',
  },
  errorText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.errorRed,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: PALETTE.honeyGold,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: PALETTE.cream,
  },
  backButton: {
    marginTop: 16,
  },
  backButtonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.stoneGrey,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PALETTE.cream,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '40',
  },
  closeButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: PALETTE.darkBrown,
  },

  // Banner
  bannerSection: {
    paddingTop: 48,
    paddingBottom: 28,
    alignItems: 'center',
    marginBottom: 8,
  },
  bannerTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 32,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  bannerEmoji: {
    fontSize: 48,
    marginTop: 12,
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    fontFamily: FONTS.headerBold,
    fontSize: 24,
    color: PALETTE.darkBrown,
    marginBottom: 12,
  },

  // Bar chart
  barChartContainer: {
    gap: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.darkBrown,
    width: 52,
  },
  barTrack: {
    flex: 1,
    height: 22,
    backgroundColor: PALETTE.cream,
    borderRadius: 11,
    overflow: 'hidden',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '30',
  },
  barFill: {
    height: '100%',
    borderRadius: 11,
  },
  barCount: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: PALETTE.darkBrown,
    width: 28,
    textAlign: 'right',
  },

  // Leaderboard rows
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.cream,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '20',
  },
  rankNum: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: PALETTE.darkBrown,
    width: 28,
    textAlign: 'center',
  },
  clanDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  playerName: {
    flex: 1,
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.darkBrown,
  },
  playerStat: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: PALETTE.warmBrown,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: PALETTE.stoneGrey + '40',
    marginVertical: 6,
  },

  // Decorated spaces
  decoratedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: PALETTE.cream,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '20',
  },
  decoratedName: {
    flex: 1,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.darkBrown,
  },
  decoratedCount: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: PALETTE.stoneGrey,
    marginLeft: 8,
  },

  // Stat grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: PALETTE.cream,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '30',
  },
  statCardIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  statCardValue: {
    fontFamily: FONTS.bodyBold,
    fontSize: 28,
    color: PALETTE.darkBrown,
  },
  statCardLabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: PALETTE.stoneGrey,
    marginTop: 4,
    textAlign: 'center',
  },

  // Share button
  shareButton: {
    marginHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  shareButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: PALETTE.cream,
  },
});
