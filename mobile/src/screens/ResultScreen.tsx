import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ImageBackground,
  ViewStyle,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, CLAN_COLORS, CLAN_LABELS } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { ASSET_MAP } from '@/constants/assets';
import { useClanStore } from '@/store/useClanStore';
import { useGameStore } from '@/store/useGameStore';
import { useMapStore } from '@/store/useMapStore';
import { useAssetStore } from '@/store/useAssetStore';
import { AssetRarity } from '@/types';
import { useLocationLockTimer } from '@/hooks/useLocationLockTimer';

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');
const chestSprite = require('../assets/ui/chest_open.png');

type Nav = NativeStackNavigationProp<MainModalParamList>;
type ResultRoute = RouteProp<MainModalParamList, 'Result'>;

const RARITY_COLORS: Record<AssetRarity, string> = {
  common: PALETTE.warmBrown,
  uncommon: CLAN_COLORS.gale,
  rare: CLAN_COLORS.tide,
  legendary: PALETTE.honeyGold,
};

const RARITY_LABELS: Record<AssetRarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

type ChestPhase = 'none' | 'chest' | 'opening' | 'reveal';

// ── Chest open spritesheet animation ──────────────────────────────────

const SPRITE_FRAMES = 8;
const FRAME_W = 150; // 250 × 0.6
const FRAME_H = 174; // 290 × 0.6
const SPRITE_TOTAL_W = FRAME_W * SPRITE_FRAMES; // 1200

interface ChestOpenAnimationProps {
  onComplete: () => void;
}

function ChestOpenAnimation({ onComplete }: ChestOpenAnimationProps) {
  const frameIndex = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    frameIndex.value = withSequence(
      withTiming(1, { duration: 80, easing: Easing.linear }),
      withTiming(2, { duration: 80, easing: Easing.linear }),
      withTiming(3, { duration: 80, easing: Easing.linear }),
      withTiming(4, { duration: 80, easing: Easing.linear }),
      withTiming(5, { duration: 80, easing: Easing.linear }),
      withTiming(6, { duration: 80, easing: Easing.linear }),
      withTiming(7, { duration: 80, easing: Easing.linear }),
    );
    // 7 transitions × 80ms = 560ms animation, then 300ms hold on final frame
    timerRef.current = setTimeout(onComplete, 860);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [frameIndex, onComplete]);

  const translateX = useDerivedValue(() => {
    return Math.floor(frameIndex.value) * -FRAME_W;
  });

  const spriteStyle = useAnimatedStyle(() => ({
    width: SPRITE_TOTAL_W,
    height: FRAME_H,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.chestFrameContainer}>
      <Reanimated.Image
        source={chestSprite}
        style={spriteStyle}
        resizeMode="cover"
      />
    </View>
  );
}

// ── ResultScreen ──────────────────────────────────────────────────────

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
    lockedUntil,
    locationId,
    locationName,
    minigameId,
    xpAwarded,
    sessionId,
    practiceMode,
  } = route.params;

  const lockTimer = useLocationLockTimer(locationLocked ? lockedUntil : undefined);

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

  // ISSUE 7 — Ref-guarded setTimeout for continue button
  const continueTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    return () => {
      if (continueTimerRef.current) clearTimeout(continueTimerRef.current);
    };
  }, []);

  // ISSUE 6 — Memoized rarity badge style
  const rarityBadgeStyle = useMemo<ViewStyle>(() => ({
    ...styles.revealRarityBadge,
    backgroundColor: chestDrop?.asset
      ? RARITY_COLORS[chestDrop.asset.rarity]
      : PALETTE.warmBrown,
  }), [chestDrop]);

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

      if (minigameId && lastScanResult && 'availableMinigames' in lastScanResult && lastScanResult.availableMinigames) {
        const patched = lastScanResult.availableMinigames.map((m) =>
          m.minigameId === minigameId ? { ...m, completed: true } : m,
        );
        patchLastScanResult({ availableMinigames: patched, xpAvailable: false });
      }
    }
    if (!isWin && locationLocked && locationId && lockedUntil) {
      lockLocation(locationId, lockedUntil);
      loadTodayLocations();
      patchLastScanResult({ xpAvailable: false });
    }
    // Optimistic badge increment after chest drop
    if (hasChest) {
      useAssetStore.getState().setUnplacedCount(
        useAssetStore.getState().unplacedCount + 1,
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animations ──

  // XP bounce
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Phase 1: chest slide up
  const chestSlideAnim = useRef(new Animated.Value(200)).current;
  const chestOpacityAnim = useRef(new Animated.Value(0)).current;

  // Phase 3: item reveal
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

  // Tap "Open Chest" → start spritesheet animation
  const handleOpenChest = useCallback(() => {
    setChestPhase('opening');
  }, []);

  // Spritesheet complete → reveal item
  const handleChestComplete = useCallback(() => {
    setChestPhase('reveal');
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
      continueTimerRef.current = setTimeout(() => setShowContinueBtn(true), 800);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBackToMap = () => {
    if (navigating) return;
    setNavigating(true);
    if (sessionId && locationName && locationId) {
      navigation.replace('SpaceSentiment', { sessionId, locationId, locationName });
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

  // ISSUE 8 — Navigate to asset inventory to decorate
  const handleDecorateSpace = () => {
    if (navigating) return;
    setNavigating(true);
    navigation.replace('AssetInventory', { fromSpaceId: undefined });
  };

  const sortedClans = [...clans].sort((a, b) => b.todayXp - a.todayXp);

  // When in chest reveal flow, hide the normal buttons until Continue appears
  const showNormalButtons = !hasChest || chestPhase === 'none';

  // ISSUE 5 — Look up asset def for image
  const assetDef = chestDrop?.asset
    ? ASSET_MAP[chestDrop.asset.assetId]
    : undefined;

  return (
    <ImageBackground source={plainBg} style={styles.container} resizeMode="cover">
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
              </>
            ) : (
              <>
                <Text style={styles.practiceWinTitle}>Challenge Complete!</Text>
                <Text style={styles.practiceWinSubtitle}>
                  No XP earned — you've already harvested this grove today.
                </Text>
                {/* ISSUE 9 — Sync notice for API failure / offline */}
                <Text style={styles.syncNotice}>
                  XP will sync when you're back online
                </Text>
              </>
            )}

            {/* ── Chest reveal sequence ── */}
            {hasChest && chestPhase !== 'none' && chestDrop?.asset && (
              <View style={styles.chestRevealArea}>
                {/* Phase 1: Static chest + "Open" button */}
                {chestPhase === 'chest' && (
                  <Animated.View
                    style={[
                      styles.chestAnimWrapper,
                      {
                        opacity: chestOpacityAnim,
                        transform: [{ translateY: chestSlideAnim }],
                      },
                    ]}
                  >
                    <View style={styles.chestFrameContainer}>
                      <Image
                        source={chestSprite}
                        style={styles.chestSpriteStatic}
                        resizeMode="cover"
                      />
                    </View>
                    <Text style={styles.chestAppearedText}>A chest appeared!</Text>
                    <TouchableOpacity style={styles.openChestBtn} onPress={handleOpenChest}>
                      <Text style={styles.openChestBtnText}>Open Chest</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {/* Phase 2: Spritesheet animation */}
                {chestPhase === 'opening' && (
                  <ChestOpenAnimation onComplete={handleChestComplete} />
                )}

                {/* Phase 3: Item reveal */}
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
                    {assetDef ? (
                      <Image
                        source={assetDef.image}
                        style={styles.assetRevealImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.itemPlaceholder}>
                        <Text style={styles.itemPlaceholderLetter}>
                          {chestDrop.asset.category.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.revealAssetName}>{chestDrop.asset.name}</Text>

                    <View style={rarityBadgeStyle}>
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
              <View style={styles.lockNotice}>
                {lockTimer.isLocked ? (
                  <>
                    <Text style={styles.lockHeader}>This grove is sealed for now.</Text>
                    <Text style={styles.lockCountdown}>
                      Reopens in {lockTimer.formattedTime}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.lockHeader}>This grove is now open again.</Text>
                )}
              </View>
            )}
          </>
        )}

        {/* Mini clan scoreboard — hidden in practice mode */}
        {!practiceMode && (
          <View style={styles.miniScoreboard}>
            {sortedClans.length === 0 ? (
              <Text style={styles.scoreboardLoading}>Loading scores...</Text>
            ) : (
              sortedClans.slice(0, 4).map((clan) => (
                <View key={clan.clanId} style={styles.miniClanRow}>
                  <View
                    style={[
                      styles.miniClanDot,
                      { backgroundColor: CLAN_COLORS[clan.clanId] },
                    ]}
                  />
                  <Text style={styles.miniClanName}>
                    {CLAN_LABELS[clan.clanId] ?? clan.clanId}
                  </Text>
                  <Text style={styles.miniClanXp}>{clan.todayXp}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>

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
            {/* ISSUE 8 — Decorate button after chest drop */}
            <TouchableOpacity onPress={handleDecorateSpace}>
              <Text style={styles.decorateLinkText}>Decorate a Space</Text>
            </TouchableOpacity>
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
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
  syncNotice: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginBottom: 8,
  },
  loseTitle: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.warmBrown,
    marginBottom: 12,
  },
  lockNotice: {
    alignItems: 'center',
    backgroundColor: PALETTE.warmBrownFaint,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 20,
  },
  lockHeader: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
    textAlign: 'center',
  },
  lockCountdown: {
    fontSize: 22,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.amberStrong,
    textAlign: 'center',
    marginTop: 6,
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
  chestFrameContainer: {
    width: FRAME_W,
    height: FRAME_H,
    overflow: 'hidden',
  },
  chestSpriteStatic: {
    width: SPRITE_TOTAL_W,
    height: FRAME_H,
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
    alignItems: 'center',
  },
  assetRevealImage: {
    width: 64,
    height: 64,
    marginBottom: 12,
  },
  itemPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: PALETTE.warmBrownMild,
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
  scoreboardLoading: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
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
  decorateLinkText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
    paddingVertical: 4,
  },
});
