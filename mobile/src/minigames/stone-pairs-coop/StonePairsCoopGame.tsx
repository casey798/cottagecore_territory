import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CLAN_COLORS, PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import type { ClanId } from '@/types';
import { ICON_SETS, checkMatch } from '../stone-pairs/StonePairsLogic';
import type { CardData } from '../stone-pairs/StonePairsLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import { CoopDivider } from '@/components/minigames/CoopDivider';

// ── Grid constants ────────────────────────────────────────────────
const COOP_ROWS = 6;
const COOP_COLS = 4;
const TOTAL_CARDS = 24;
const TOTAL_PAIRS = 12;
const CROSS_BOUNDARY_TARGET = 4;
const P1_ROW_END = 3; // P1 owns rows 0,1,2 → card indices 0–11
const CARDS_PER_HALF = 12;

const FLIP_BACK_DELAY = 800;
const SYNC_TIMEOUT_MS = 2000;
const CARD_GAP = 6;

// ── Helpers ───────────────────────────────────────────────────────

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function clanColor(clan: string): string {
  return CLAN_COLORS[clan as ClanId] ?? PALETTE.stoneGrey;
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return hex + a;
}

function isP1Card(cardId: number): boolean {
  return cardId < CARDS_PER_HALF;
}

function isP2Card(cardId: number): boolean {
  return cardId >= CARDS_PER_HALF;
}

// ── Puzzle generation (6×4 grid, 12 pairs, cross-boundary constraint) ──

export interface CoopCardData extends CardData {
  pairId: number; // 0–11, identifies which pair this card belongs to
}

export interface CrossBoundaryInfo {
  crossPairIds: Set<number>;
  cards: CoopCardData[];
}

/**
 * Generate 24 cards (12 pairs) with exactly `targetCross` cross-boundary pairs
 * (one card in P1 zone rows 0–2, matching card in P2 zone rows 3–5).
 */
export function generateCoopPuzzle(targetCross: number = CROSS_BOUNDARY_TARGET): CrossBoundaryInfo {
  // Pick two icon sets and merge to get at least 12 unique icons
  const setIndices = fisherYatesShuffle(Array.from({ length: ICON_SETS.length }, (_, i) => i));
  const allIcons: string[] = [];
  for (const idx of setIndices) {
    for (const icon of ICON_SETS[idx]) {
      if (!allIcons.includes(icon)) allIcons.push(icon);
      if (allIcons.length >= TOTAL_PAIRS) break;
    }
    if (allIcons.length >= TOTAL_PAIRS) break;
  }
  const chosenIcons = allIcons.slice(0, TOTAL_PAIRS);

  // Build 12 pairs (each pair = two cards with same iconIndex)
  const pairs: Array<{ iconIndex: number; iconLabel: string }> = chosenIcons.map(
    (icon, idx) => ({ iconIndex: idx, iconLabel: icon }),
  );

  // Decide which pairs are cross-boundary
  const pairIndices = Array.from({ length: TOTAL_PAIRS }, (_, i) => i);
  const shuffledPairIndices = fisherYatesShuffle(pairIndices);
  const crossPairIds = new Set(shuffledPairIndices.slice(0, targetCross));

  // Pre-allocate within-zone pairs evenly: each half needs
  // (CARDS_PER_HALF - targetCross) / 2 within-zone pairs
  const withinPairIds = shuffledPairIndices.slice(targetCross);
  const withinPerHalf = (CARDS_PER_HALF - targetCross) / 2;
  const topWithinIds = new Set(withinPairIds.slice(0, withinPerHalf));
  // Rest go to bottom

  // Place cards deterministically
  const topCards: CoopCardData[] = [];
  const bottomCards: CoopCardData[] = [];

  for (let pairId = 0; pairId < TOTAL_PAIRS; pairId++) {
    const { iconIndex, iconLabel } = pairs[pairId];
    const card1: CoopCardData = { id: -1, iconIndex, iconLabel, pairId };
    const card2: CoopCardData = { id: -1, iconIndex, iconLabel, pairId };

    if (crossPairIds.has(pairId)) {
      topCards.push(card1);
      bottomCards.push(card2);
    } else if (topWithinIds.has(pairId)) {
      topCards.push(card1, card2);
    } else {
      bottomCards.push(card1, card2);
    }
  }

  // Shuffle each half independently
  const shuffledTop = fisherYatesShuffle(topCards);
  const shuffledBottom = fisherYatesShuffle(bottomCards);

  // Assign sequential IDs: top = 0–11, bottom = 12–23
  const cards: CoopCardData[] = [];
  shuffledTop.forEach((card, i) => {
    cards.push({ ...card, id: i });
  });
  shuffledBottom.forEach((card, i) => {
    cards.push({ ...card, id: CARDS_PER_HALF + i });
  });

  return { crossPairIds, cards };
}

/**
 * Check if a pair spans both zones.
 */
export function isCrossBoundary(cardA: CoopCardData, cardB: CoopCardData): boolean {
  return (isP1Card(cardA.id) && isP2Card(cardB.id)) || (isP2Card(cardA.id) && isP1Card(cardB.id));
}

// ── Component ─────────────────────────────────────────────────────

export default function StonePairsCoopGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, puzzleData } = props;

  const p1Name = (puzzleData?.p1Name as string | undefined) ?? 'Player 1';
  const p1Clan = (puzzleData?.p1Clan as string | undefined) ?? 'ember';
  const p2Name = (puzzleData?.p2Name as string | undefined) ?? 'Player 2';
  const p2Clan = (puzzleData?.p2Clan as string | undefined) ?? 'tide';

  // ── Puzzle (once on mount) ──────────────────────────────────────
  const puzzleRef = useRef<CrossBoundaryInfo | null>(null);
  if (puzzleRef.current === null) {
    puzzleRef.current = generateCoopPuzzle();
  }
  const { cards, crossPairIds } = puzzleRef.current;

  // ── State ───────────────────────────────────────────────────────
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [selectedP1, setSelectedP1] = useState<number | null>(null);
  const [selectedP2, setSelectedP2] = useState<number | null>(null);
  const [flippingBack, setFlippingBack] = useState<Set<number>>(() => new Set());
  const [pendingSync, setPendingSync] = useState<number | null>(null);
  const [syncSecondsLeft, setSyncSecondsLeft] = useState<number | null>(null);
  const [totalFlips, setTotalFlips] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit > 0 ? timeLimit : 60);
  const [gameOver, setGameOver] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const matchedPairsRef = useRef(0);
  const crossMatchedRef = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSyncCardRef = useRef<number | null>(null);

  // Sync animation
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────
  const findMatchingCard = useCallback(
    (cardId: number): CoopCardData | undefined => {
      const card = cards[cardId];
      return cards.find((c) => c.id !== cardId && c.iconIndex === card.iconIndex);
    },
    [cards],
  );

  // ── Timer ───────────────────────────────────────────────────────
  const effectiveTimeLimit = timeLimit > 0 ? timeLimit : 60;

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, effectiveTimeLimit - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        finishGame('timeout');
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, effectiveTimeLimit]);

  // ── Finish game ─────────────────────────────────────────────────
  const finishGame = useCallback(
    (result: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      // Clean up sync timers
      if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
      if (syncIntervalRef.current) { clearInterval(syncIntervalRef.current); syncIntervalRef.current = null; }

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, result, timeTaken);

      pendingResultRef.current = {
        result,
        timeTaken,
        completionHash,
        solutionData: {
          totalFlips,
          matchedPairs: matchedPairsRef.current,
          crossBoundaryMatches: crossMatchedRef.current,
          solved: result === 'win',
        },
      };
      setOverlayResult(result === 'win' ? 'win' : 'lose');
      setOverlayVisible(true);
    },
    [sessionId, totalFlips],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // ── Start sync countdown ────────────────────────────────────────
  const startSyncTimer = useCallback(
    (initiatorCardId: number) => {
      setPendingSync(initiatorCardId);
      pendingSyncCardRef.current = initiatorCardId;
      setSyncSecondsLeft(2);

      // Pulse animation
      if (pulseAnimRef.current) pulseAnimRef.current.stop();
      pulseAnim.setValue(0.4);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        ]),
      );
      pulseAnimRef.current = loop;
      loop.start();

      // Countdown interval
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = setInterval(() => {
        setSyncSecondsLeft((prev) => (prev !== null && prev > 1 ? prev - 1 : prev));
      }, 1000);

      // Timeout: flip both back
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        const initCard = pendingSyncCardRef.current;
        if (initCard === null) return;
        const matchCard = cards.find(
          (c) => c.id !== initCard && c.iconIndex === cards[initCard].iconIndex,
        );

        setRevealed((prev) => {
          const next = new Set(prev);
          next.delete(initCard);
          if (matchCard) next.delete(matchCard.id);
          return next;
        });

        // Clear initiator selection
        if (isP1Card(initCard)) setSelectedP1(null);
        else setSelectedP2(null);

        clearSyncState();
      }, SYNC_TIMEOUT_MS);
    },
    [cards, pulseAnim],
  );

  const clearSyncState = useCallback(() => {
    setPendingSync(null);
    pendingSyncCardRef.current = null;
    setSyncSecondsLeft(null);
    if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
    if (syncIntervalRef.current) { clearInterval(syncIntervalRef.current); syncIntervalRef.current = null; }
    if (pulseAnimRef.current) { pulseAnimRef.current.stop(); pulseAnimRef.current = null; }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      if (pulseAnimRef.current) pulseAnimRef.current.stop();
    };
  }, []);

  // ── Match a pair ────────────────────────────────────────────────
  const matchPair = useCallback(
    (id1: number, id2: number) => {
      const newMatched = new Set(matched);
      newMatched.add(id1);
      newMatched.add(id2);
      setMatched(newMatched);
      matchedPairsRef.current += 1;

      // Track cross-boundary matches
      if (isCrossBoundary(cards[id1], cards[id2])) {
        crossMatchedRef.current += 1;
      }

      // Clear selections
      if (isP1Card(id1) || isP1Card(id2)) setSelectedP1(null);
      if (isP2Card(id1) || isP2Card(id2)) setSelectedP2(null);

      // Win check
      if (newMatched.size === TOTAL_CARDS) {
        finishGame('win');
      }
    },
    [matched, cards, finishGame],
  );

  // ── Within-zone mismatch flip-back ──────────────────────────────
  const flipBackPair = useCallback((id1: number, id2: number) => {
    setFlippingBack((prev) => {
      const next = new Set(prev);
      next.add(id1);
      next.add(id2);
      return next;
    });

    setTimeout(() => {
      setRevealed((prev) => {
        const next = new Set(prev);
        next.delete(id1);
        next.delete(id2);
        return next;
      });
      setFlippingBack((prev) => {
        const next = new Set(prev);
        next.delete(id1);
        next.delete(id2);
        return next;
      });
      if (isP1Card(id1)) setSelectedP1(null);
      else setSelectedP2(null);
    }, FLIP_BACK_DELAY);
  }, []);

  // ── Card tap handler ────────────────────────────────────────────
  const handleCardPress = useCallback(
    (cardId: number, player: 'p1' | 'p2') => {
      if (gameOver) return;
      if (matched.has(cardId) || revealed.has(cardId)) return;
      if (flippingBack.has(cardId)) return;

      // Enforce zone ownership
      if (player === 'p1' && !isP1Card(cardId)) return;
      if (player === 'p2' && !isP2Card(cardId)) return;

      // Reveal card
      setRevealed((prev) => {
        const next = new Set(prev);
        next.add(cardId);
        return next;
      });
      setTotalFlips((prev) => prev + 1);

      const card = cards[cardId];

      // ── Check if this completes a pending sync ──────────────
      if (pendingSync !== null) {
        const syncCard = cards[pendingSync];
        if (card.iconIndex === syncCard.iconIndex && card.id !== syncCard.id) {
          // Sync match!
          clearSyncState();
          matchPair(pendingSync, cardId);
          return;
        }
        // Not the matching card — treat as a normal flip in their zone
        // (sync timer keeps running for the original pair)
      }

      // ── Within-zone logic ──────────────────────────────────
      const currentSelected = player === 'p1' ? selectedP1 : selectedP2;

      if (currentSelected === null) {
        // First card in this player's zone
        if (player === 'p1') setSelectedP1(cardId);
        else setSelectedP2(cardId);

        // If this card's pair is cross-boundary, start sync
        const matchingCard = findMatchingCard(cardId);
        if (matchingCard && isCrossBoundary(card, matchingCard) && pendingSync === null) {
          startSyncTimer(cardId);
        }
      } else {
        // Second card in same zone
        const firstCard = cards[currentSelected];

        if (checkMatch(firstCard, card)) {
          matchPair(currentSelected, cardId);
        } else {
          flipBackPair(currentSelected, cardId);
        }
      }
    },
    [
      gameOver, matched, revealed, flippingBack, cards, pendingSync,
      selectedP1, selectedP2, findMatchingCard, startSyncTimer,
      clearSyncState, matchPair, flipBackPair,
    ],
  );

  // ── Layout ──────────────────────────────────────────────────────
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const zoneHeight = (screenH - 160) / 2; // Approximate zone height minus divider + header
  const availableW = screenW - 24;
  const cardFromWidth = Math.floor((availableW - CARD_GAP * (COOP_COLS - 1)) / COOP_COLS);
  const cardFromHeight = Math.floor((zoneHeight - CARD_GAP * (P1_ROW_END - 1) - 16) / P1_ROW_END);
  const cardSize = Math.min(cardFromWidth, cardFromHeight);
  const gridWidth = cardSize * COOP_COLS + CARD_GAP * (COOP_COLS - 1);

  // ── Derived ─────────────────────────────────────────────────────
  const timerFraction = Math.max(0, Math.min(1, timeLeft / effectiveTimeLimit));
  const matchedPairCount = Math.floor(matched.size / 2);

  // ── Pending sync target card (the one in the OTHER zone) ────────
  const pendingSyncTargetId = useMemo(() => {
    if (pendingSync === null) return null;
    const matchCard = cards.find(
      (c) => c.id !== pendingSync && c.iconIndex === cards[pendingSync].iconIndex,
    );
    return matchCard?.id ?? null;
  }, [pendingSync, cards]);

  // ── Render card ─────────────────────────────────────────────────
  const renderCard = useCallback(
    (card: CoopCardData, player: 'p1' | 'p2') => {
      const isRevealed = revealed.has(card.id) || matched.has(card.id);
      const isMatched = matched.has(card.id);
      const isFlipping = flippingBack.has(card.id);
      const isSyncTarget = pendingSyncTargetId === card.id;
      const disabled = gameOver || isRevealed || isFlipping;

      return (
        <TouchableOpacity
          key={card.id}
          activeOpacity={0.7}
          onPress={() => handleCardPress(card.id, player)}
          disabled={disabled}
          style={[
            styles.card,
            {
              width: cardSize,
              height: cardSize,
              backgroundColor: isRevealed ? PALETTE.cream : PALETTE.stoneGrey,
              borderColor: isMatched
                ? PALETTE.softGreen
                : isSyncTarget
                  ? PALETTE.honeyGold
                  : PALETTE.warmBrown,
              borderWidth: isMatched ? 3 : isSyncTarget ? 3 : 2,
            },
          ]}
        >
          {isRevealed ? (
            <Text style={[styles.cardIcon, { fontSize: cardSize * 0.4 }]}>
              {card.iconLabel}
            </Text>
          ) : isSyncTarget ? (
            <Animated.View style={{ opacity: pulseAnim }}>
              <Text style={[styles.cardBack, { fontSize: cardSize * 0.25, color: PALETTE.honeyGold }]}>
                !
              </Text>
              {syncSecondsLeft !== null && (
                <Text style={styles.syncBadge}>{syncSecondsLeft}</Text>
              )}
            </Animated.View>
          ) : (
            <Text style={[styles.cardBack, { fontSize: cardSize * 0.25 }]}>?</Text>
          )}
        </TouchableOpacity>
      );
    },
    [
      revealed, matched, flippingBack, pendingSyncTargetId,
      gameOver, handleCardPress, cardSize, pulseAnim, syncSecondsLeft,
    ],
  );

  // ── Split grid into P1 (rows 0-2) and P2 (rows 3-5) ───────────
  const p1Cards = cards.slice(0, CARDS_PER_HALF);
  const p2Cards = cards.slice(CARDS_PER_HALF);

  const renderGrid = (zoneCards: CoopCardData[], player: 'p1' | 'p2') => {
    const rows: CoopCardData[][] = [];
    for (let r = 0; r < P1_ROW_END; r++) {
      rows.push(zoneCards.slice(r * COOP_COLS, r * COOP_COLS + COOP_COLS));
    }
    return (
      <View style={[styles.grid, { width: gridWidth }]}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.gridRow}>
            {row.map((card) => renderCard(card, player))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* P1 Zone */}
      <View style={[styles.playerZone, { backgroundColor: withAlpha(clanColor(p1Clan), 0.1) }]}>
        {renderGrid(p1Cards, 'p1')}
      </View>

      {/* Divider */}
      <CoopDivider
        p1Name={p1Name}
        p1Clan={p1Clan}
        p2Name={p2Name}
        p2Clan={p2Clan}
        timeLeft={timeLeft}
        totalTime={effectiveTimeLimit}
      >
        <Text style={styles.matchCount}>
          Matched: {matchedPairCount} / {TOTAL_PAIRS}
        </Text>
      </CoopDivider>

      {/* P2 Zone */}
      <View style={[styles.playerZone, { backgroundColor: withAlpha(clanColor(p2Clan), 0.1) }]}>
        {renderGrid(p2Cards, 'p2')}
      </View>

      {/* Game complete overlay */}
      {overlayVisible && (
        <GameCompleteOverlay result={overlayResult} onContinue={handleContinue} />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.background,
  },
  playerZone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  grid: {
    alignItems: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  card: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  cardIcon: {
    textAlign: 'center',
  },
  cardBack: {
    fontFamily: FONTS.headerBold,
    color: PALETTE.cream,
    textAlign: 'center',
  },
  syncBadge: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: PALETTE.honeyGold,
    textAlign: 'center',
    marginTop: 2,
  },
  matchCount: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: UI.text,
  },
});
