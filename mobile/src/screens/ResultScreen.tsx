import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, UI, CLAN_COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useClanStore } from '@/store/useClanStore';
import { useGameStore } from '@/store/useGameStore';
import { useMapStore } from '@/store/useMapStore';
import { AssetRarity } from '@/types';

type Nav = NativeStackNavigationProp<MainModalParamList>;
type ResultRoute = RouteProp<MainModalParamList, 'Result'>;

const RARITY_COLORS: Record<AssetRarity, string> = {
  common: PALETTE.stoneGrey,
  uncommon: PALETTE.softGreen,
  rare: PALETTE.honeyGold,
  legendary: PALETTE.mutedRose,
};

const RARITY_LABELS: Record<AssetRarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

type ChestPhase = 'none' | 'chest' | 'reveal';

export default function ResultScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ResultRoute>();
  const {
    result,
    xpEarned,
    newTodayXp,
    clanTodayXp,
    chestDrop,
    locationLocked,
    locationId,
    locationName,
    minigameId,
    xpAwarded,
    sessionId,
    practiceMode,
    bonusXpTriggered,
    linkedLocation,
  } = route.params;

  const clans = useClanStore((s) => s.clans);
  const lockLocation = useMapStore((s) => s.lockLocation);
  const loadTodayLocations = useMapStore((s) => s.loadTodayLocations);
  const markXpEarnedAtLocation = useGameStore((s) => s.markXpEarnedAtLocation);
  const patchLastScanResult = useGameStore((s) => s.patchLastScanResult);
  const lastScanResult = useGameStore((s) => s.lastScanResult);
  const isWin = result === 'win';
  const didEarnXp = !practiceMode && xpAwarded !== false;
  const hasChest = !practiceMode && !!(chestDrop?.dropped && chestDrop.asset);

  const [chestPhase, setChestPhase] = useState<ChestPhase>('none');
  const [showContinueBtn, setShowContinueBtn] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Mark XP earned or lock location on lose, then refresh map locations
  // Skip all side effects in practice mode
  useEffect(() => {
    if (practiceMode) return;
    if (isWin && didEarnXp && locationId) {
      markXpEarnedAtLocation(locationId);
      loadTodayLocations();

      const capReached = (newTodayXp ?? 0) >= 100;
      if (capReached) {
        patchLastScanResult({ xpAvailable: false });
      }

      if (minigameId && lastScanResult?.availableMinigames) {
        const patched = lastScanResult.availableMinigames.map((m) =>
          m.minigameId === minigameId ? { ...m, completed: true } : m,
        );
        patchLastScanResult({ availableMinigames: patched, xpAvailable: false });
      }
    }
    if (!isWin && locationLocked && locationId) {
      lockLocation(locationId);
      loadTodayLocations();
      patchLastScanResult({ xpAvailable: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animations ──

  // XP bounce
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Phase 1: chest slide up
  const chestSlideAnim = useRef(new Animated.Value(200)).current; // start off-screen below
  const chestOpacityAnim = useRef(new Animated.Value(0)).current;

  // Phase 2: chest open (scale up then vanish)
  const chestOpenScale = useRef(new Animated.Value(1)).current;
  const chestOpenOpacity = useRef(new Animated.Value(1)).current;

  // Phase 2: item reveal
  const itemScale = useRef(new Animated.Value(0.5)).current;
  const itemOpacity = useRef(new Animated.Value(0)).current;

  // XP animation on mount → then trigger chest phase 1
  useEffect(() => {
    if (isWin) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }).start(() => {
        if (hasChest) {
          // After XP animation completes, show chest
          setChestPhase('chest');
          Animated.parallel([
            Animated.spring(chestSlideAnim, {
              toValue: 0,
              friction: 6,
              tension: 50,
              useNativeDriver: true,
            }),
            Animated.timing(chestOpacityAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();
        }
      });
    }
  }, [isWin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 2: open chest → reveal item
  const handleOpenChest = useCallback(() => {
    setChestPhase('reveal');

    // Chest: scale up to 1.3 then shrink to 0
    Animated.sequence([
      Animated.timing(chestOpenScale, {
        toValue: 1.3,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(chestOpenScale, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(chestOpenOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Item: fade + spring scale in
      Animated.parallel([
        Animated.timing(itemOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(itemScale, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Show Continue button after 800ms delay
        setTimeout(() => setShowContinueBtn(true), 800);
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBackToMap = () => {
    if (navigating) return;
    setNavigating(true);
    if (sessionId && locationName) {
      navigation.replace('SpaceSentiment', { sessionId, locationName });
    } else {
      navigation.popToTop();
    }
  };

  const handlePlayAgainHere = () => {
    if (navigating) return;
    setNavigating(true);
    if (locationId && locationName) {
      navigation.replace('MinigameSelect', { locationId, locationName });
    } else {
      navigation.popToTop();
    }
  };

  const sortedClans = [...clans].sort((a, b) => b.todayXp - a.todayXp);

  // When in chest reveal flow, hide the normal buttons until Continue appears
  const showNormalButtons = !hasChest || chestPhase === 'none';

  return (
    <View style={[styles.container, isWin ? styles.bgWin : styles.bgLose]}>
      <View style={styles.content}>
        {isWin ? (
          <>
            {practiceMode ? (
              <>
                <Text style={styles.practiceWinTitle}>Nice work!</Text>
                <Text style={styles.practiceWinSubtitle}>
                  Practice makes perfect.
                </Text>
              </>
            ) : didEarnXp ? (
              <>
                <Animated.Text
                  style={[
                    styles.xpGain,
                    { transform: [{ scale: scaleAnim }] },
                  ]}
                >
                  +{xpEarned} XP
                </Animated.Text>
                <Text style={styles.clanXpText}>
                  Your clan now has {clanTodayXp ?? 0} XP today!
                </Text>
                <Text style={styles.playerXpText}>
                  Your XP: {newTodayXp ?? 0}/100
                </Text>
                {bonusXpTriggered && (
                  <View style={styles.bonusXpBadge}>
                    <Text style={styles.bonusXpText}>
                      {/* Server returns firstVisitBonus or bonusXP — both use bonusXpTriggered */}
                      First Visit Bonus! ⭐
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.practiceWinTitle}>Challenge Complete!</Text>
                <Text style={styles.practiceWinSubtitle}>
                  No XP earned — you've already harvested this grove today.
                </Text>
              </>
            )}

            {/* ── Chest reveal sequence ── */}
            {hasChest && chestPhase !== 'none' && chestDrop?.asset && (
              <View style={styles.chestRevealArea}>
                {/* Phase 1 & 2: Chest placeholder (visible until opened) */}
                {chestPhase === 'chest' || chestPhase === 'reveal' ? (
                  <Animated.View
                    style={[
                      styles.chestAnimWrapper,
                      {
                        opacity: chestPhase === 'reveal' ? chestOpenOpacity : chestOpacityAnim,
                        transform: [
                          { translateY: chestPhase === 'reveal' ? 0 : chestSlideAnim },
                          { scale: chestPhase === 'reveal' ? chestOpenScale : 1 },
                        ],
                      },
                    ]}
                  >
                    {/* Chest placeholder — swap for <Image source={require('...')} /> when chest art is ready */}
                    <View style={styles.chestPlaceholder}>
                      <Text style={styles.chestPlaceholderEmoji}>🎁</Text>
                    </View>
                    {chestPhase === 'chest' && (
                      <>
                        <Text style={styles.chestAppearedText}>A chest appeared!</Text>
                        <TouchableOpacity style={styles.openChestBtn} onPress={handleOpenChest}>
                          <Text style={styles.openChestBtnText}>Open Chest</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </Animated.View>
                ) : null}

                {/* Phase 2: Item reveal (rendered on top after chest shrinks) */}
                {chestPhase === 'reveal' && (
                  <Animated.View
                    style={[
                      styles.itemRevealWrapper,
                      {
                        opacity: itemOpacity,
                        transform: [{ scale: itemScale }],
                      },
                    ]}
                  >
                    {/* Item placeholder — swap for <Image source={{ uri: assetImageUrl }} /> when CDN is ready */}
                    <View
                      style={[
                        styles.itemPlaceholder,
                        { backgroundColor: RARITY_COLORS[chestDrop.asset.rarity] + '50' },
                      ]}
                    >
                      <Text style={styles.itemPlaceholderLetter}>
                        {chestDrop.asset.category.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <Text style={styles.revealAssetName}>{chestDrop.asset.name}</Text>

                    <View
                      style={[
                        styles.revealRarityBadge,
                        { backgroundColor: RARITY_COLORS[chestDrop.asset.rarity] },
                      ]}
                    >
                      <Text style={styles.revealRarityText}>
                        {RARITY_LABELS[chestDrop.asset.rarity]}
                      </Text>
                    </View>

                    <Text style={styles.revealCategory}>
                      {chestDrop.asset.category.charAt(0).toUpperCase() +
                        chestDrop.asset.category.slice(1)}
                    </Text>
                  </Animated.View>
                )}
              </View>
            )}

            {/* No chest case */}
            {!hasChest && didEarnXp && (
              <Text style={styles.noChest}>No chest this time...</Text>
            )}
          </>
        ) : practiceMode ? (
          <>
            <Text style={styles.loseTitle}>Better luck next time!</Text>
            <Text style={styles.practiceWinSubtitle}>
              No penalties in practice mode. Try again!
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.loseTitle}>Not this time...</Text>
            {locationLocked && (
              <Text style={styles.lockText}>
                This location is locked for today. Try a different spot!
              </Text>
            )}
          </>
        )}

        {/* Mini clan scoreboard — hidden in practice mode */}
        {!practiceMode && (
          <View style={styles.miniScoreboard}>
            {sortedClans.slice(0, 4).map((clan) => (
              <View key={clan.clanId} style={styles.miniClanRow}>
                <View
                  style={[
                    styles.miniClanDot,
                    { backgroundColor: CLAN_COLORS[clan.clanId] },
                  ]}
                />
                <Text style={styles.miniClanName}>
                  {clan.clanId.charAt(0).toUpperCase() + clan.clanId.slice(1)}
                </Text>
                <Text style={styles.miniClanXp}>{clan.todayXp}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Linked location nudge — only on win */}
      {isWin && !practiceMode && linkedLocation && (
        <View style={styles.linkedCard}>
          <Text style={styles.linkedText}>
            Bonus challenge nearby! → {linkedLocation.name}
          </Text>
          <TouchableOpacity
            style={styles.linkedBtn}
            onPress={() => {
              if (navigating) return;
              setNavigating(true);
              // TODO: MainMapScreen does not yet support highlighting a pin via selectedLocationId param.
              // For now, just navigate to the map.
              navigation.popToTop();
            }}
          >
            <Text style={styles.linkedBtnText}>Show on map</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.buttonRow}>
        {practiceMode ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => { if (!navigating) { setNavigating(true); navigation.popToTop(); } }}>
            <Text style={styles.backBtnText}>Continue</Text>
          </TouchableOpacity>
        ) : hasChest && showContinueBtn ? (
          <>
            <TouchableOpacity style={styles.backBtn} onPress={handleBackToMap}>
              <Text style={styles.backBtnText}>Continue</Text>
            </TouchableOpacity>
            {isWin && didEarnXp && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={handlePlayAgainHere}>
                <Text style={styles.secondaryBtnText}>Play Again Here</Text>
              </TouchableOpacity>
            )}
          </>
        ) : showNormalButtons ? (
          <>
            {isWin && didEarnXp ? (
              <>
                <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgainHere}>
                  <Text style={styles.playAgainBtnText}>Play Again Here</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backBtn} onPress={handleBackToMap}>
                  <Text style={styles.backBtnText}>Back to Map</Text>
                </TouchableOpacity>
              </>
            ) : isWin && !didEarnXp ? (
              <>
                <TouchableOpacity style={styles.backBtn} onPress={handleBackToMap}>
                  <Text style={styles.backBtnText}>Find Another Location</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handlePlayAgainHere}>
                  <Text style={styles.secondaryBtnText}>Play Again Here</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.backBtn} onPress={handleBackToMap}>
                <Text style={styles.backBtnText}>Find Another Location</Text>
              </TouchableOpacity>
            )}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  bgWin: {
    backgroundColor: PALETTE.parchmentBg,
  },
  bgLose: {
    backgroundColor: '#E8DCC8',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xpGain: {
    fontSize: 48,
    fontFamily: FONTS.headerBold,
    color: PALETTE.softGreen,
    marginBottom: 12,
  },
  clanXpText: {
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginBottom: 4,
  },
  playerXpText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.warmBrown,
    marginBottom: 20,
  },
  practiceWinTitle: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.warmBrown,
    marginBottom: 8,
  },
  practiceWinSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginBottom: 20,
  },
  loseTitle: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.warmBrown,
    marginBottom: 12,
  },
  lockText: {
    fontSize: 15,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginBottom: 20,
  },
  noChest: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 16,
  },

  // ── Chest reveal ──

  chestRevealArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    marginBottom: 8,
  },
  chestAnimWrapper: {
    alignItems: 'center',
  },
  // Chest placeholder — swap for <Image> when chest art is ready
  chestPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: PALETTE.warmBrown,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chestPlaceholderEmoji: {
    fontSize: 48,
  },
  chestAppearedText: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginTop: 12,
  },
  openChestBtn: {
    marginTop: 14,
    backgroundColor: PALETTE.honeyGold,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  openChestBtnText: {
    fontSize: 15,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.cream,
  },

  // ── Item reveal ──

  itemRevealWrapper: {
    position: 'absolute',
    alignItems: 'center',
  },
  // Item placeholder — swap for <Image source={{ uri: assetImageUrl }} /> when CDN is ready
  itemPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  itemPlaceholderLetter: {
    fontSize: 36,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
  revealAssetName: {
    fontSize: 24,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 8,
    textAlign: 'center',
  },
  revealRarityBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 6,
  },
  revealRarityText: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.cream,
    letterSpacing: 0.5,
  },
  revealCategory: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
  },

  // ── Scoreboard ──

  miniScoreboard: {
    marginTop: 24,
    backgroundColor: PALETTE.cream,
    borderRadius: 10,
    padding: 14,
    alignSelf: 'stretch',
  },
  miniClanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  miniClanDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  miniClanName: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  miniClanXp: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.stoneGrey,
  },

  // ── Buttons ──

  buttonRow: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
  },
  backBtn: {
    backgroundColor: PALETTE.warmBrown,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  backBtnText: {
    color: PALETTE.cream,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  playAgainBtn: {
    backgroundColor: PALETTE.softGreen,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  playAgainBtnText: {
    color: PALETTE.cream,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  secondaryBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.warmBrown,
  },
  secondaryBtnText: {
    color: PALETTE.warmBrown,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },

  // ── Bonus XP badge ──
  bonusXpBadge: {
    backgroundColor: PALETTE.honeyGold,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 16,
  },
  bonusXpText: {
    fontSize: 13,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.cream,
  },

  // ── Linked location nudge ──
  linkedCard: {
    backgroundColor: PALETTE.cream,
    borderWidth: 1,
    borderColor: PALETTE.warmBrown + '40',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  linkedText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginBottom: 10,
  },
  linkedBtn: {
    backgroundColor: PALETTE.warmBrown,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  linkedBtnText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
  },
});
