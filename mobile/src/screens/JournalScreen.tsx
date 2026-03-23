import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { getJournal } from '@/api/player';
import { DayJournal, JournalEntry, JournalLocationStatus } from '@/types';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { ErrorToast } from '@/components/common/ErrorToast';
import { format, subDays, addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// ── Status colors & labels ──────────────────────────────────────────
const STATUS_COLORS: Record<JournalLocationStatus, string> = {
  won: '#5D8A4E',
  lost: '#C0392B',
  locked: '#A0937D',
  pending: '#BDB49A',
};

const STATUS_LABELS: Record<JournalLocationStatus, string> = {
  won: 'Victory',
  lost: 'Defeat',
  locked: 'Locked',
  pending: 'Not visited',
};

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');
const IST_TIMEZONE = 'Asia/Kolkata';
const DAILY_XP_CAP = 100;

// ── Clan XP bar colors ──────────────────────────────────────────────
const CLAN_XP_COLORS: Record<string, string> = {
  ember: '#9E5550',
  tide: '#4E7FA3',
  bloom: '#C4A832',
  gale: '#4A9966',
  hearth: '#6E5082',
};

type Props = NativeStackScreenProps<MainModalParamList, 'Journal'>;

// ── Entry Card ──────────────────────────────────────────────────────
function JournalEntryCard({
  entry,
  isToday,
}: {
  entry: JournalEntry;
  isToday: boolean;
}) {
  const statusColor = STATUS_COLORS[entry.status];

  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: statusColor }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardRow}>
          <Text style={styles.locationName} numberOfLines={1}>
            {entry.name}
          </Text>
          {entry.xpEarned > 0 ? (
            <Text style={styles.xpBadge}>+{entry.xpEarned} XP</Text>
          ) : (
            <Text style={styles.xpBadgeEmpty}>—</Text>
          )}
        </View>

        <View style={styles.cardRow}>
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {STATUS_LABELS[entry.status]}
          </Text>
        </View>

        {entry.minigameId && (
          <Text style={styles.minigameText}>{entry.minigameId}</Text>
        )}

        {entry.coopPartnerId && (
          <View style={styles.coopPill}>
            <Text style={styles.coopText}>Co-op</Text>
          </View>
        )}

        {entry.status === 'pending' && isToday && (
          <Text style={styles.goCapture}>Go capture it!</Text>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────
export default function JournalScreen({ navigation }: Props): React.JSX.Element {
  const [journal, setJournal] = useState<DayJournal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    toZonedTime(new Date(), IST_TIMEZONE),
  );

  const todayIST = toZonedTime(new Date(), IST_TIMEZONE);
  const clan = useAuthStore((s) => s.clan ?? 'ember');
  const dailyInfo = useGameStore((s) => s.dailyInfo);
  const xpBarColor = CLAN_XP_COLORS[clan] ?? CLAN_XP_COLORS.ember;

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const todayStr = format(todayIST, 'yyyy-MM-dd');
  const isSelectedToday = selectedDateStr === todayStr;
  const canGoForward = !isSelectedToday;

  const fetchJournal = useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const data = await getJournal(dateStr);
      setJournal(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJournal(selectedDate);
  }, [selectedDate, fetchJournal]);

  const handlePrevDay = () => setSelectedDate((prev) => subDays(prev, 1));
  const handleNextDay = () => {
    const next = addDays(selectedDate, 1);
    const nextStr = format(next, 'yyyy-MM-dd');
    if (nextStr <= todayStr) {
      setSelectedDate(next);
    }
  };

  const getDateLabel = (date: Date): string => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(todayIST, 1), 'yyyy-MM-dd');
    if (dateStr === todayStr) return `Today, ${format(date, 'MMM d')}`;
    if (dateStr === yesterdayStr) return `Yesterday, ${format(date, 'MMM d')}`;
    return format(date, 'MMM d, yyyy');
  };

  const xpFill = journal
    ? Math.min(100, Math.max(0, (journal.totalXp / DAILY_XP_CAP) * 100))
    : 0;

  const renderItem = ({ item }: { item: JournalEntry }) => (
    <JournalEntryCard entry={item} isToday={isSelectedToday} />
  );

  return (
    <ImageBackground source={plainBg} style={styles.screen} resizeMode="cover">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Field Journal</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Date navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={handlePrevDay} style={styles.dateArrow}>
          <Text style={styles.dateArrowText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.dateLabel}>{getDateLabel(selectedDate)}</Text>
        <TouchableOpacity
          onPress={handleNextDay}
          style={styles.dateArrow}
          disabled={!canGoForward}
        >
          <Text
            style={[
              styles.dateArrowText,
              !canGoForward && styles.dateArrowDisabled,
            ]}
          >
            {'>'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* XP summary bar */}
      {journal && (
        <View style={styles.xpSection}>
          <Text style={styles.xpSummaryText}>
            {journal.totalXp} / {DAILY_XP_CAP} XP
          </Text>
          <View style={styles.xpBarTrack}>
            <View
              style={[
                styles.xpBarFill,
                { width: `${xpFill}%`, backgroundColor: xpBarColor },
              ]}
            />
          </View>
        </View>
      )}

      {/* Today's capturable space banner */}
      {isSelectedToday && dailyInfo?.targetSpace && (
        <View style={styles.targetSpaceBanner}>
          <View style={styles.targetSpaceBannerInner}>
            <Text style={styles.targetSpaceBannerEyebrow}>Today's prize space</Text>
            <Text style={styles.targetSpaceBannerName}>
              {dailyInfo.targetSpace.name}
            </Text>
            {dailyInfo.targetSpace.description ? (
              <Text style={styles.targetSpaceBannerDesc} numberOfLines={2}>
                {dailyInfo.targetSpace.description}
              </Text>
            ) : null}
          </View>
          <Text style={styles.targetSpaceBannerIcon}>🏡</Text>
        </View>
      )}

      {/* Content */}
      {loading && !journal ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.honeyGold} />
        </View>
      ) : journal && journal.locations.length > 0 ? (
        <FlatList
          data={journal.locations}
          keyExtractor={(item) => item.locationId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : journal && journal.locations.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No quest assigned for this day</Text>
        </View>
      ) : null}

      <ErrorToast message={error} onDismiss={() => setError(null)} />
      <LoadingOverlay visible={loading && journal !== null} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.darkBrown,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontFamily: FONTS.pixel,
    fontSize: 22,
    color: PALETTE.cream,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: PALETTE.cream,
  },
  headerSpacer: {
    width: 40,
  },

  // Date navigation
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 16,
  },
  dateArrow: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateArrowText: {
    fontFamily: FONTS.pixel,
    fontSize: 22,
    color: PALETTE.cream,
  },
  dateArrowDisabled: {
    opacity: 0.3,
  },
  dateLabel: {
    fontFamily: FONTS.pixel,
    fontSize: 16,
    color: PALETTE.cream,
    minWidth: 160,
    textAlign: 'center',
  },

  // XP bar
  xpSection: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  xpSummaryText: {
    fontFamily: FONTS.pixel,
    fontSize: 14,
    color: PALETTE.cream,
    marginBottom: 4,
    textAlign: 'center',
  },
  xpBarTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: PALETTE.warmBrownMild,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 5,
  },

  // List
  listContent: {
    paddingVertical: 8,
    paddingBottom: 24,
  },

  // Card
  card: {
    flexDirection: 'row',
    marginVertical: 6,
    marginHorizontal: 16,
    borderRadius: 8,
    backgroundColor: PALETTE.parchmentBg,
    overflow: 'hidden',
    elevation: 2,
  },
  cardAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    padding: 12,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationName: {
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: PALETTE.darkBrown,
    flex: 1,
    marginRight: 8,
  },
  xpBadge: {
    fontFamily: FONTS.heading,
    fontSize: 14,
    color: '#2D5A27',
  },
  xpBadgeEmpty: {
    fontFamily: FONTS.pixel,
    fontSize: 14,
    color: PALETTE.stoneGrey,
  },
  statusLabel: {
    fontFamily: FONTS.pixel,
    fontSize: 13,
    fontWeight: '600',
  },
  minigameText: {
    fontFamily: FONTS.pixel,
    fontSize: 12,
    color: PALETTE.stoneGrey,
    fontStyle: 'italic',
    marginTop: 2,
  },
  coopPill: {
    alignSelf: 'flex-start',
    backgroundColor: PALETTE.honeyGold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  coopText: {
    fontFamily: FONTS.pixel,
    fontSize: 11,
    color: PALETTE.darkBrown,
  },
  goCapture: {
    fontFamily: FONTS.pixel,
    fontSize: 12,
    color: PALETTE.softGreen,
    marginTop: 4,
  },

  // States
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
  },

  // Today's capturable space banner
  targetSpaceBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#3B2A1A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    elevation: 3,
  },
  targetSpaceBannerInner: {
    flex: 1,
  },
  targetSpaceBannerEyebrow: {
    fontFamily: FONTS.pixel,
    fontSize: 10,
    color: '#BDB49A',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  targetSpaceBannerName: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: '#F5EACB',
    lineHeight: 26,
  },
  targetSpaceBannerDesc: {
    fontFamily: FONTS.pixel,
    fontSize: 12,
    color: '#BDB49A',
    marginTop: 3,
    lineHeight: 16,
  },
  targetSpaceBannerIcon: {
    fontSize: 32,
  },
});
