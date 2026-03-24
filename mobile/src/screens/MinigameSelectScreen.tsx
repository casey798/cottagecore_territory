// Fixes applied: 1, 2, 3, 4, 5, 6, 9, coop-fix-1, coop-fix-3, coop-fix-4
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { DAILY_XP_CAP, COLOR_SORT_TIME_LIMIT } from '@/constants/config';
import { useGameStore } from '@/store/useGameStore';
import { useDebugStore } from '@/store/useDebugStore';
import * as gameApi from '@/api/game';
import { MinigameInfo, ALL_MINIGAMES, MINIGAME_DIFFICULTY } from '@/constants/minigames';

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

const COOP_MINIGAME_IDS: readonly string[] = [
  'word-clusters-coop',
  'cipher-stones-coop',
  'pips-coop',
  'stone-pairs-coop',
  'potion-logic-coop',
  'vine-trail-coop',
];

const COOP_DEFAULTS: Record<string, { name: string; description: string; timeLimit: number }> = {
  'word-clusters-coop': { name: 'Word Clusters', description: 'Sort 16 words into 4 groups. 8 mistakes allowed.', timeLimit: 180 },
  'pips-coop': { name: 'Snuff Out', description: 'Turn all the cells dark. Tap to toggle a cell and its neighbours.', timeLimit: 75 },
  'stone-pairs-coop': { name: 'Flip & Match', description: 'Flip cards to find matching pairs. Remember what you saw \u2014 every flip counts.', timeLimit: 90 },
  'vine-trail-coop': { name: 'Word Hunt', description: 'Find all the hidden words in the letter grid \u2014 split-screen team challenge', timeLimit: 180 },
  'cipher-stones-coop': { name: 'Cipher', description: 'A famous quote has been scrambled \u2014 every letter replaced with another. Decode it letter by letter before time runs out.', timeLimit: 150 },
  'potion-logic-coop': { name: 'Logic Grid', description: 'Read the clues. Deduce which ingredient and effect belongs to each potion. Process of elimination.', timeLimit: 150 },
};

type Nav = NativeStackNavigationProp<MainModalParamList>;
type SelectRoute = RouteProp<MainModalParamList, 'MinigameSelect'>;


const MINIGAME_ICONS: Record<string, string> = {
  'grove-words': '📝',
  'word-clusters': '🔗',
  'pips': '🧩',
  'vine-trail': '🌿',
  'mosaic': '🪟',
  'number-grove': '🌱',
  'stone-pairs': '🪨',
  'potion-logic': '⚗️',
  'leaf-sort': '🍂',
  'cipher-stones': '🔮',
  'path-weaver': '🎨',
  'firefly-flow': '🪲',
  'grove-equations': '🧮',
  'bloom-sequence': '🌸',
  'shift-slide': '🖼️',
  'word-clusters-coop': '🔗',
  'pips-coop': '🧩',
  'stone-pairs-coop': '🪨',
  'vine-trail-coop': '🌿',
  'cipher-stones-coop': '🔮',
  'potion-logic-coop': '⚗️',
};

const DIFF_ORDER: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 1, hard: 2 };

const DIFF_LABEL_COLORS: Record<'easy' | 'medium' | 'hard', string> = {
  easy:   '#4CAF50',
  medium: '#E6A817',
  hard:   '#E05A3A',
};

export default function MinigameSelectScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<SelectRoute>();
  const { locationId, locationName, practiceMode, isCoopSession, coopPartnerId, coopPartnerDisplayName } = route.params;
  const lastScanResult = useGameStore((s) => s.lastScanResult);
  const setSessionId = useGameStore((s) => s.setSessionId);
  const setActiveLocationSession = useGameStore((s) => s.setActiveLocationSession);
  const clearActiveLocationSession = useGameStore((s) => s.clearActiveLocationSession);
  const todayXp = useGameStore((s) => s.todayXp);
  const showAllMinigames = useDebugStore((s) => s.showAllMinigames);
  const [loading, setLoading] = useState(false);
  const navigatedForwardRef = useRef(false);
  const [spaceFactDismissed, setSpaceFactDismissed] = useState(false);

  const locationModifiers = lastScanResult && 'locationModifiers' in lastScanResult
    ? lastScanResult.locationModifiers
    : undefined;
  const spaceFact = locationModifiers?.spaceFact ?? null;
  const isCoopOnly = locationModifiers?.coopOnly ?? isCoopSession ?? false;

  // Fire leave event when navigating back (not forward into a minigame)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (navigatedForwardRef.current) return; // going into minigame, not leaving
      const sessionId = useGameStore.getState().activeLocationSessionId;
      if (sessionId) {
        gameApi.submitLeave(sessionId, 'navigated_away');
        clearActiveLocationSession();
      }
    });
    return unsubscribe;
  }, [navigation, clearActiveLocationSession]);

  // If no scan result (e.g. cleared by daily reset), go back to map
  // Skip this check when debug "Show All Minigames" is active or in practice mode
  useEffect(() => {
    if (!lastScanResult && !practiceMode && !(__DEV__ && showAllMinigames)) {
      navigation.popToTop();
    }
  }, [lastScanResult, navigation, showAllMinigames, practiceMode]);

  // Server is sole source of truth for XP availability
  const xpAvailable = practiceMode
    ? false
    : (lastScanResult && 'xpAvailable' in lastScanResult ? lastScanResult.xpAvailable ?? true : true);
  const fullPool = practiceMode
    ? ALL_MINIGAMES
    : __DEV__ && showAllMinigames
      ? ALL_MINIGAMES
      : (lastScanResult && 'availableMinigames' in lastScanResult ? lastScanResult.availableMinigames : []);

  // Belt-and-suspenders: client-side filter co-op IDs based on location mode
  const coopSet = new Set(COOP_MINIGAME_IDS);
  const filteredPool = fullPool.filter((m) =>
    isCoopOnly ? coopSet.has(m.minigameId) : !coopSet.has(m.minigameId),
  );

  // Always show all 6 co-op variants, merging completed state from server
  const coopMinigames: MinigameInfo[] =
    COOP_MINIGAME_IDS.map((id) => {
      const serverEntry = fullPool.find((m) => m.minigameId === id);
      const defaults = COOP_DEFAULTS[id];
      return {
        minigameId: id,
        name: serverEntry?.name ?? defaults?.name ?? id,
        description: serverEntry?.description ?? defaults?.description ?? '',
        timeLimit: serverEntry?.timeLimit ?? defaults?.timeLimit ?? 120,
        completed: serverEntry?.completed ?? false,
      };
    });

  // Solo minigames: practice shows all, otherwise use server-filtered pool (co-op IDs already excluded)
  const soloMinigames: MinigameInfo[] =
    practiceMode
      ? ALL_MINIGAMES
      : __DEV__ && showAllMinigames
        ? ALL_MINIGAMES
        : filteredPool;

  const sortedSoloMinigames = soloMinigames
    .map(m => ({
      ...m,
      difficulty: (m.difficulty ?? MINIGAME_DIFFICULTY[m.minigameId] ?? 'medium') as 'easy' | 'medium' | 'hard',
    }))
    .sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]);

  const sortedCoopMinigames = coopMinigames
    .map(m => ({
      ...m,
      difficulty: (m.difficulty ?? MINIGAME_DIFFICULTY[m.minigameId] ?? 'medium') as 'easy' | 'medium' | 'hard',
    }))
    .sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]);

  const allExhausted = sortedSoloMinigames.length > 0 && sortedSoloMinigames.every((m) => m.completed);

  const handleSelect = async (minigame: MinigameInfo) => {
    if (loading) return;
    setLoading(true);
    try {
      if (practiceMode) {
        const result = await gameApi.startPractice(minigame.minigameId);
        if (result.success && result.data) {
          setSessionId(result.data.sessionId);
          setActiveLocationSession(result.data.sessionId);
          navigatedForwardRef.current = true;
          navigation.replace('MinigamePlay', {
            sessionId: result.data.sessionId,
            minigameId: minigame.minigameId,
            timeLimit: result.data.timeLimit,
            salt: result.data.salt,
            locationId: 'practice',
            locationName,
            puzzleData: result.data.puzzleData,
            xpAvailable: false,
          });
        } else {
          Alert.alert('Error', result.error?.message || 'Failed to start practice.');
        }
      } else {
        const partnerIdToSend = isCoopSession ? (coopPartnerId ?? null) : null;
        if (__DEV__ && (coopPartnerId === 'dev-partner' || locationId === '00000000-0000-0000-0000-000000000001')) {
          navigatedForwardRef.current = true;
          navigation.replace('MinigamePlay', {
            sessionId: 'dev-session-' + minigame.minigameId,
            minigameId: minigame.minigameId,
            timeLimit: minigame.timeLimit,
            salt: 'dev-salt',
            locationId,
            locationName,
            puzzleData: {},
            xpAvailable: false,
          });
          setLoading(false);
          return;
        }
        const result = await gameApi.startMinigame(
          locationId,
          minigame.minigameId,
          partnerIdToSend,
        );
        if (result.success && result.data) {
          setSessionId(result.data.sessionId);
          setActiveLocationSession(result.data.sessionId);
          navigatedForwardRef.current = true;
          navigation.replace('MinigamePlay', {
            sessionId: result.data.sessionId,
            minigameId: minigame.minigameId,
            timeLimit: result.data.timeLimit,
            salt: result.data.salt,
            locationId,
            locationName,
            puzzleData: result.data.puzzleData,
            xpAvailable,
          });
        } else {
          const code = result.error?.code || '';
          const friendlyMessage: Record<string, string> = {
            PARTNER_CAP_REACHED: "Your partner has already reached today's XP limit (100 XP)",
            PARTNER_LOCATION_LOCKED: 'Your partner is locked at this location from an earlier loss',
            PARTNER_ALREADY_WON: 'Your partner has already completed this minigame today',
          };
          Alert.alert('Error', friendlyMessage[code] || result.error?.message || 'Failed to start minigame.');
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to start minigame. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={plainBg} style={styles.container} resizeMode="cover">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {practiceMode ? 'Practice mode' : locationName}
        </Text>
        {!practiceMode && (
          <Text style={[styles.xpBadge, !xpAvailable && styles.xpBadgeMuted]}>
            {todayXp}/{DAILY_XP_CAP} XP
          </Text>
        )}
        {practiceMode && (
          <View style={styles.practiceBadge}>
            <Text style={styles.practiceBadgeText}>PRACTICE</Text>
          </View>
        )}
      </View>
      {practiceMode ? (
        <Text style={styles.subtitle}>Pick any minigame to practice</Text>
      ) : !xpAvailable && !allExhausted ? (
        <View style={styles.practiceHeader}>
          <View style={styles.practiceBadge}>
            <Text style={styles.practiceBadgeText}>PRACTICE MODE</Text>
          </View>
          <Text style={styles.practiceSubtitle}>
            No XP will be earned — you've already harvested this grove today
          </Text>
        </View>
      ) : (
        <Text style={styles.subtitle}>Choose a minigame</Text>
      )}
      {/* Space Fact overlay */}
      {spaceFact && !spaceFactDismissed && !practiceMode && (
        <Modal transparent animationType="fade">
          <View style={styles.overlayBackdrop}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayTitle}>Did you know?</Text>
              <Text style={styles.overlayBody}>{spaceFact}</Text>
              <TouchableOpacity
                style={styles.overlayButton}
                onPress={() => setSpaceFactDismissed(true)}
              >
                <Text style={styles.overlayButtonText}>Got it →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isCoopSession && coopPartnerDisplayName && !practiceMode && (
          <View style={styles.coopSessionBanner}>
            <Text style={styles.coopSessionText}>
              Co-op Session — You & {coopPartnerDisplayName}
            </Text>
          </View>
        )}
        {isCoopOnly && !isCoopSession && !practiceMode && (
          <View style={styles.coopOnlyBanner}>
            <Text style={styles.coopOnlyText}>Co-op only at this location</Text>
          </View>
        )}
        {sortedSoloMinigames.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No minigames available here right now.</Text>
          </View>
        )}

        {/* Solo minigames section */}
        {!isCoopOnly && (
          <>
            <Text style={styles.sectionHeader}>Solo</Text>
            <View style={styles.grid}>
              {sortedSoloMinigames.map((item) => (
                <TouchableOpacity
                  key={item.minigameId}
                  style={[styles.card, item.completed && styles.cardDone, !xpAvailable && !item.completed && styles.cardNoXp]}
                  onPress={() => handleSelect(item)}
                  disabled={loading || item.completed}
                  activeOpacity={item.completed ? 1 : 0.7}
                >
                  <Text style={[styles.cardEmoji, !xpAvailable && !item.completed && styles.cardEmojiMuted]}>
                    {MINIGAME_ICONS[item.minigameId] || '🎮'}
                  </Text>
                  <Text style={[styles.difficultyBadge, { color: DIFF_LABEL_COLORS[item.difficulty ?? 'medium'] }]}>
                    {(item.difficulty ?? 'medium').toUpperCase()}
                  </Text>
                  <Text style={[styles.cardName, item.completed && styles.cardTextDone, !xpAvailable && !item.completed && styles.cardTextMuted]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text
                    style={[styles.cardDesc, item.completed && styles.cardTextDone, !xpAvailable && !item.completed && styles.cardTextMuted]}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                  {item.completed ? (
                    <Text style={styles.cardCompleted}>✓ Done</Text>
                  ) : !xpAvailable ? (
                    <Text style={styles.cardNoXpBadge}>0 XP</Text>
                  ) : (
                    <Text style={styles.cardTime}>⏱ {item.timeLimit}s</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {(isCoopOnly || isCoopSession || practiceMode) && (
          <>
            {/* Divider */}
            <View style={styles.sectionDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>Co-op</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Co-op minigames section */}
            <View style={styles.grid}>
              {sortedCoopMinigames.map((item) => (
                <TouchableOpacity
                  key={item.minigameId}
                  style={[styles.card, item.completed && styles.cardDone, !xpAvailable && !item.completed && styles.cardNoXp]}
                  onPress={() => handleSelect(item)}
                  disabled={loading || item.completed}
                  activeOpacity={item.completed ? 1 : 0.7}
                >
                  <Text style={[styles.cardEmoji, !xpAvailable && !item.completed && styles.cardEmojiMuted]}>
                    {MINIGAME_ICONS[item.minigameId] || '🎮'}
                  </Text>
                  <Text style={[styles.difficultyBadge, { color: DIFF_LABEL_COLORS[item.difficulty ?? 'medium'] }]}>
                    {(item.difficulty ?? 'medium').toUpperCase()}
                  </Text>
                  <Text style={[styles.cardName, item.completed && styles.cardTextDone, !xpAvailable && !item.completed && styles.cardTextMuted]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text
                    style={[styles.cardDesc, item.completed && styles.cardTextDone, !xpAvailable && !item.completed && styles.cardTextMuted]}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                  {item.completed ? (
                    <Text style={styles.cardCompleted}>✓ Done</Text>
                  ) : !xpAvailable ? (
                    <Text style={styles.cardNoXpBadge}>0 XP</Text>
                  ) : (
                    <Text style={styles.cardTime}>⏱ {item.timeLimit}s</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {allExhausted && (
          <View style={styles.exhaustedBanner}>
            <Text style={styles.exhaustedText}>
              "You've proven yourself here today. Seek new grounds!"
            </Text>
            <Text style={styles.exhaustedAttrib}>— Elder Moss</Text>
          </View>
        )}
      </ScrollView>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={PALETTE.warmBrown} />
        </View>
      )}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={allExhausted ? styles.backBtnFull : styles.backBtn}
          onPress={() => allExhausted ? navigation.popToTop() : navigation.goBack()}
        >
          <Text style={allExhausted ? styles.backBtnFullText : styles.backBtnText}>
            {allExhausted ? 'Back to Map' : '← Back'}
          </Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
  xpBadge: {
    fontSize: 13,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.warmBrown,
    backgroundColor: PALETTE.cream,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  xpBadgeMuted: {
    opacity: 0.4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 12,
  },
  practiceHeader: {
    marginBottom: 12,
    alignItems: 'center',
  },
  practiceBadge: {
    backgroundColor: PALETTE.stoneGrey,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 6,
  },
  practiceBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.cream,
    letterSpacing: 1.5,
  },
  practiceSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  card: {
    backgroundColor: PALETTE.cream,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    width: '48%',
  },
  cardEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  difficultyBadge: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardName: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginBottom: 2,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginBottom: 4,
  },
  cardDone: {
    opacity: 0.4,
    borderColor: PALETTE.stoneGrey,
  },
  cardNoXp: {
    opacity: 0.8,
    borderColor: PALETTE.stoneGrey,
    backgroundColor: '#E8E0D4', // TODO: no close PALETTE match for this muted parchment
  },
  cardEmojiMuted: {
    opacity: 0.7,
  },
  cardTextMuted: {
    color: PALETTE.stoneGrey,
  },
  cardNoXpBadge: {
    fontSize: 11,
    color: PALETTE.stoneGrey,
    fontFamily: FONTS.bodyBold,
  },
  cardTextDone: {
    color: PALETTE.stoneGrey,
  },
  cardCompleted: {
    fontSize: 11,
    color: PALETTE.softGreen,
    fontFamily: FONTS.bodyBold,
  },
  cardTime: {
    fontSize: 12,
    color: PALETTE.warmBrown,
    fontFamily: FONTS.bodyBold,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exhaustedBanner: {
    backgroundColor: PALETTE.cream,
    borderWidth: 1,
    borderColor: PALETTE.warmBrown + '40',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  exhaustedText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  exhaustedAttrib: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginTop: 4,
  },
  bottomBar: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: PALETTE.warmBrown + '30',
  },
  backBtn: {
    marginTop: 12,
    alignSelf: 'center',
  },
  backBtnText: {
    color: PALETTE.warmBrown,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  backBtnFull: {
    marginTop: 12,
    backgroundColor: PALETTE.warmBrown,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  backBtnFullText: {
    color: PALETTE.cream,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },

  // ── Space Fact overlay ──
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  overlayCard: {
    backgroundColor: PALETTE.parchmentBg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    padding: 24,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  overlayTitle: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.warmBrown,
    marginBottom: 12,
  },
  overlayBody: {
    fontSize: 15,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  overlayButton: {
    backgroundColor: PALETTE.warmBrown,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  overlayButtonText: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
  },

  // ── Co-op banners ──
  coopSessionBanner: {
    backgroundColor: PALETTE.honeyGold,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  coopSessionText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  coopOnlyBanner: {
    backgroundColor: PALETTE.honeyGold,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  coopOnlyText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
  },

  // ── Section headers & divider ──
  sectionHeader: {
    fontFamily: FONTS.title,
    fontSize: 18,
    color: PALETTE.darkBrown,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: PALETTE.darkBrown + '40',
  },
  dividerLabel: {
    fontFamily: FONTS.title,
    fontSize: 16,
    color: PALETTE.darkBrown,
  },

});
