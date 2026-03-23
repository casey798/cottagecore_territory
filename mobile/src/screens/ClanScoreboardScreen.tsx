import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { fromZonedTime } from 'date-fns-tz';
import { useClanScores } from '@/hooks/useClanScores';
import { useCountdown } from '@/hooks/useCountdown';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { CottageButton } from '@/components/common/CottageButton';
import { CLAN_COLORS, CLAN_LABELS, PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { GAME_END_HOUR } from '@/constants/config';
import { getNowIST, getTodayISTString } from '@/utils/time';
import { ClanScore, ClanId, CaptureHistoryEntry } from '@/types';

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');
const IST_TIMEZONE = 'Asia/Kolkata';

function getScoringTargetIST(): Date {
  const nowIST = getNowIST();
  const y = nowIST.getFullYear();
  const m = nowIST.getMonth();
  const d = nowIST.getDate();

  // Build 18:00 IST today as a UTC Date
  let target = fromZonedTime(
    new Date(y, m, d, GAME_END_HOUR, 0, 0, 0),
    IST_TIMEZONE,
  );

  // If IST is already past scoring hour, target next day
  if (Date.now() >= target.getTime()) {
    target = fromZonedTime(
      new Date(y, m, d + 1, GAME_END_HOUR, 0, 0, 0),
      IST_TIMEZONE,
    );
  }
  return target;
}

function getParticipationLabel(participants: number, roster: number): string {
  if (roster === 0) return '\u2014';
  if (participants === 0) return 'no players scored today';
  const pct = Math.round((participants / roster) * 100);
  return pct === 0 ? '< 1% of members scored' : `${pct}% of members scored`;
}

function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${dayNames[d.getUTCDay()]}, ${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// ── ClanRow ───────────────────────────────────────────────────────

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

  const participationLabel = getParticipationLabel(
    item.todayParticipants,
    item.rosterSize,
  );

  return (
    <Animated.View
      style={[
        styles.row,
        isOwnClan && styles.ownClanRow,
        isOwnClan && { borderColor: CLAN_COLORS[item.clanId] },
        { backgroundColor },
      ]}
    >
      <View style={styles.rowTop}>
        <View
          style={[styles.crestDot, { backgroundColor: CLAN_COLORS[item.clanId] }]}
        />
        <Text style={styles.clanName}>{CLAN_LABELS[item.clanId]}</Text>
        <Text style={styles.participationText}>
          {participationLabel}
        </Text>
      </View>
      <View style={styles.statsRow}>
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
      </View>
    </Animated.View>
  );
}

// ── HistoryRow ────────────────────────────────────────────────────

interface HistoryRowProps {
  entry: CaptureHistoryEntry;
}

function HistoryRow({ entry }: HistoryRowProps) {
  return (
    <View style={styles.historyRow}>
      <Text style={styles.historyDate}>{formatHistoryDate(entry.date)}</Text>
      <View style={[styles.historyDot, { backgroundColor: CLAN_COLORS[entry.clan] }]} />
      <Text style={styles.historyClan}>{CLAN_LABELS[entry.clan]}</Text>
      <Text style={styles.historySpace} numberOfLines={1}>{entry.spaceName}</Text>
    </View>
  );
}

// ── CaptureHistorySection ─────────────────────────────────────────

interface CaptureHistorySectionProps {
  captureHistory: CaptureHistoryEntry[];
  isLoadingHistory: boolean;
  historyError: string | null;
  hasMoreHistory: boolean;
  fetchMoreHistory: () => void;
}

function CaptureHistorySection({
  captureHistory,
  isLoadingHistory,
  historyError,
  hasMoreHistory,
  fetchMoreHistory,
}: CaptureHistorySectionProps) {
  return (
    <View style={styles.historySection}>
      <Text style={styles.historySectionTitle}>Capture History</Text>

      {captureHistory.length === 0 && !isLoadingHistory && !historyError && (
        <Text style={styles.historyEmptyText}>No captures yet this season.</Text>
      )}

      {captureHistory.map((entry) => (
        <HistoryRow key={entry.spaceId + entry.date} entry={entry} />
      ))}

      {historyError && (
        <View style={styles.historyErrorContainer}>
          <Text style={styles.historyErrorText}>{historyError}</Text>
          <TouchableOpacity onPress={fetchMoreHistory}>
            <Text style={styles.historyRetryLink}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoadingHistory && (
        <ActivityIndicator
          size="small"
          color={PALETTE.warmBrown}
          style={styles.historyLoader}
        />
      )}

      {hasMoreHistory && !isLoadingHistory && !historyError && captureHistory.length > 0 && (
        <CottageButton
          title="Load more"
          variant="secondary"
          onPress={fetchMoreHistory}
          style={styles.loadMoreButton}
        />
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────

export default function ClanScoreboardScreen() {
  const {
    clans,
    isConnected,
    lastUpdated,
    isLoading,
    error,
    refreshScores,
    captureHistory,
    isLoadingHistory,
    historyError,
    hasMoreHistory,
    fetchMoreHistory,
  } = useClanScores();
  const myClan = useAuthStore((s) => s.clan);
  const captureResult = useGameStore((s) => s.captureResult);

  const todayIST = getTodayISTString();
  const scoringTarget = useMemo(() => getScoringTargetIST(), [todayIST]);
  const { formatted: countdown, isExpired: scoringDone } = useCountdown(scoringTarget);

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
    await refreshScores();
    setRefreshing(false);
  }, [refreshScores]);

  const renderItem = useCallback(
    ({ item, index }: { item: ClanScore; index: number }) => (
      <ClanRow
        item={item}
        rank={index + 1}
        isOwnClan={item.clanId === myClan}
        previousXp={prevXpRef.current[item.clanId]}
      />
    ),
    [myClan],
  );

  const keyExtractor = useCallback((item: ClanScore) => item.clanId, []);

  // Determine the scoring status label
  const scoringLabel = scoringDone ? 'Scores locked for today' : countdown;

  // Capture banner info
  const captureBannerClan = captureResult?.winnerClan as ClanId | undefined;
  const captureBannerSpace = captureResult?.spaceName;

  const listFooter = useMemo(
    () => (
      <CaptureHistorySection
        captureHistory={captureHistory}
        isLoadingHistory={isLoadingHistory}
        historyError={historyError}
        hasMoreHistory={hasMoreHistory}
        fetchMoreHistory={fetchMoreHistory}
      />
    ),
    [captureHistory, isLoadingHistory, historyError, hasMoreHistory, fetchMoreHistory],
  );

  // Loading state — initial fetch in progress, no data yet
  if (isLoading && clans.length === 0) {
    return (
      <ImageBackground source={plainBg} style={styles.centeredContainer} resizeMode="cover">
        <ActivityIndicator size="large" color={PALETTE.warmBrown} />
        <Text style={styles.loadingText}>Loading scores...</Text>
      </ImageBackground>
    );
  }

  // Error state — fetch failed, no data
  if (error && clans.length === 0) {
    return (
      <ImageBackground source={plainBg} style={styles.centeredContainer} resizeMode="cover">
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={plainBg} style={styles.container} resizeMode="cover">
      <View style={styles.header}>
        <Text style={styles.title}>Clan Scoreboard</Text>
        <View style={styles.headerRight}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                isConnected ? styles.statusDotConnected : styles.statusDotDisconnected,
              ]}
            />
            <Text style={styles.statusText}>
              {isConnected ? 'LIVE' : 'polling'}
            </Text>
          </View>
          <Text style={styles.countdown}>{scoringLabel}</Text>
          {lastUpdated && (
            <Text style={styles.lastUpdatedText}>
              Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
      </View>

      {scoringDone && captureBannerClan && captureBannerSpace && (
        <View style={[styles.captureBanner, { borderColor: CLAN_COLORS[captureBannerClan] }]}>
          <View style={[styles.captureBannerDot, { backgroundColor: CLAN_COLORS[captureBannerClan] }]} />
          <Text style={styles.captureBannerText}>
            Today&apos;s capture: {CLAN_LABELS[captureBannerClan]} claimed {captureBannerSpace}
          </Text>
        </View>
      )}

      {scoringDone && !captureBannerClan && (
        <View style={styles.awaitingBanner}>
          <Text style={styles.awaitingBannerText}>Awaiting result...</Text>
        </View>
      )}

      <FlatList
        data={clans}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        ListFooterComponent={listFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </ImageBackground>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: UI.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
  statusDotConnected: {
    backgroundColor: UI.statusConnected,
  },
  statusDotDisconnected: {
    backgroundColor: UI.statusDisconnected,
  },
  statusText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
    textTransform: 'uppercase',
  },
  countdown: {
    fontSize: 13,
    fontFamily: FONTS.headerBold,
    color: PALETTE.warmBrown,
  },
  lastUpdatedText: {
    fontSize: 10,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginTop: 2,
  },
  list: {
    paddingBottom: 24,
  },
  row: {
    backgroundColor: PALETTE.cream,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '40',
  },
  ownClanRow: {
    borderWidth: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  crestDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
  },
  clanName: {
    fontSize: 18,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
  participationText: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginLeft: 8,
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
    opacity: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.darkBrown,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.errorRed,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: PALETTE.warmBrown,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
  },
  captureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: PALETTE.cream,
  },
  captureBannerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  captureBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  awaitingBanner: {
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '60',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: PALETTE.cream,
    alignItems: 'center',
  },
  awaitingBannerText: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
  },

  // ── Capture History styles ──────────────────────────────────────
  historySection: {
    marginTop: 16,
    paddingBottom: 16,
  },
  historySectionTitle: {
    fontSize: 22,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.cream,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '30',
  },
  historyDate: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
    width: 80,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  historyClan: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    width: 56,
  },
  historySpace: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.warmBrown,
    marginLeft: 6,
  },
  historyEmptyText: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    paddingVertical: 16,
  },
  historyErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  historyErrorText: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.errorRed,
    marginRight: 8,
  },
  historyRetryLink: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
    textDecorationLine: 'underline',
  },
  historyLoader: {
    paddingVertical: 12,
  },
  loadMoreButton: {
    alignSelf: 'center',
    marginTop: 8,
  },
});
