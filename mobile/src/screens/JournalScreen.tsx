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
import { getSpaceAssignments, SpaceAssignmentsResponse } from '@/api/spaces';
import { DayJournal, JournalEntry, JournalLocationStatus } from '@/types';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
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

// ── Decor Spaces Section ────────────────────────────────────────────
function DecorSpacesSection({
  spaceAssignments,
  spacesLoading,
  navigation,
}: {
  spaceAssignments: SpaceAssignmentsResponse | null;
  spacesLoading: boolean;
  navigation: Props['navigation'];
}) {
  if (!spaceAssignments && !spacesLoading) return null;

  return (
    <View style={styles.decorCard}>
      {spacesLoading && !spaceAssignments ? (
        <ActivityIndicator size="small" color={PALETTE.honeyGold} />
      ) : spaceAssignments ? (
        <>
          <View style={styles.decorHeader}>
            <Text style={styles.decorTitle}>{'🌿 Today\'s Decor Spaces'}</Text>
            <Text style={styles.decorCount}>
              {spaceAssignments.completedCount} / {spaceAssignments.spacesPerDay} done
            </Text>
          </View>
          <View style={styles.decorBarTrack}>
            <View
              style={[
                styles.decorBarFill,
                {
                  width: spaceAssignments.spacesPerDay > 0
                    ? `${(spaceAssignments.completedCount / spaceAssignments.spacesPerDay) * 100}%`
                    : '0%',
                },
              ]}
            />
          </View>
          {spaceAssignments.assignments.map((item, idx) => (
            <View
              key={item.spaceId}
              style={[
                styles.decorRow,
                idx < spaceAssignments.assignments.length - 1 && styles.decorRowBorder,
              ]}
            >
              <Text style={styles.decorSpaceName} numberOfLines={1}>
                {item.spaceName}
              </Text>
              {item.completed ? (
                <View style={styles.decorDonePill}>
                  <Text style={styles.decorDoneText}>{'✓ Done'}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.decorGoePill}
                  onPress={() => {
                    try {
                      navigation.navigate('QRScanner', { mode: 'space' });
                    } catch {}
                  }}
                >
                  <Text style={styles.decorGoeText}>{'Decorate →'}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────
export default function JournalScreen({ navigation }: Props): React.JSX.Element {
  const [journal, setJournal] = useState<DayJournal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spaceAssignments, setSpaceAssignments] = useState<SpaceAssignmentsResponse | null>(null);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    toZonedTime(new Date(), IST_TIMEZONE),
  );

  const todayIST = toZonedTime(new Date(), IST_TIMEZONE);

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

  const fetchSpaceAssignments = useCallback(async (isToday: boolean) => {
    if (!isToday) {
      setSpaceAssignments(null);
      return;
    }
    setSpacesLoading(true);
    try {
      const response = await getSpaceAssignments();
      if (response.success && response.data) {
        setSpaceAssignments(response.data);
      }
    } catch {
      // Silently swallow — decor section simply won't show
    } finally {
      setSpacesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJournal(selectedDate);
    fetchSpaceAssignments(isSelectedToday);
  }, [selectedDate, fetchJournal, fetchSpaceAssignments, isSelectedToday]);

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


      {/* Today's Decor Spaces */}
      {isSelectedToday && (
        <DecorSpacesSection
          spaceAssignments={spaceAssignments}
          spacesLoading={spacesLoading}
          navigation={navigation}
        />
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

  // Decor spaces section
  decorCard: {
    backgroundColor: PALETTE.parchmentBg,
    borderRadius: 10,
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 12,
    elevation: 2,
  },
  decorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  decorTitle: {
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: PALETTE.darkBrown,
  },
  decorCount: {
    fontFamily: FONTS.pixel,
    fontSize: 13,
    color: PALETTE.stoneGrey,
  },
  decorBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(160, 147, 125, 0.2)',
    overflow: 'hidden',
    marginBottom: 4,
  },
  decorBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: PALETTE.softGreen,
  },
  decorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  decorRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(160, 147, 125, 0.15)',
  },
  decorSpaceName: {
    fontFamily: FONTS.pixel,
    fontSize: 14,
    color: PALETTE.darkBrown,
    flex: 1,
  },
  decorDonePill: {
    backgroundColor: 'rgba(124, 170, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  decorDoneText: {
    fontFamily: FONTS.pixel,
    fontSize: 12,
    color: PALETTE.softGreen,
  },
  decorGoePill: {
    backgroundColor: 'rgba(212, 168, 67, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  decorGoeText: {
    fontFamily: FONTS.pixel,
    fontSize: 12,
    color: PALETTE.honeyGold,
  },

});
