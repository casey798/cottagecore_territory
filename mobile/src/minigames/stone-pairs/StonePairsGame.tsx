/**
 * Stone Pairs — Memory matching minigame component (portrait mode).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  ImageBackground,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';

import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { STONE_PAIRS_TIME_LIMIT, XP_PER_WIN } from '@/constants/config';
import { generateClientCompletionHash } from '@/utils/hmac';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import {
  CardData,
  StonePairsPuzzle,
  checkMatch,
  generatePuzzle,
  validateSolution,
} from './StonePairsLogic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLIP_BACK_DELAY = 800;
const CARD_GAP = 6;
const GRID_PADDING = 12;

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

type PuzzleLoadState =
  | { status: 'loading' }
  | { status: 'ready'; puzzle: StonePairsPuzzle }
  | { status: 'error' };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StonePairsGame(props: MinigamePlayProps) {
  const { sessionId, onComplete, practiceMode } = props;

  // ---- Puzzle load state machine ------------------------------------------
  const [puzzleState, setPuzzleState] = useState<PuzzleLoadState>({ status: 'loading' });

  // ---- State --------------------------------------------------------------
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [selected, setSelected] = useState<number[]>([]);
  const [flipping, setFlipping] = useState(false);
  const [timeLeft, setTimeLeft] = useState(STONE_PAIRS_TIME_LIMIT);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

  const matchedPairsRef = useRef(0);
  const startTimeRef = useRef(0);
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const flipsRef = useRef<Array<{ first: number; second: number }>>([]);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flipBackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Loading spinner animation
  const spinAnim = useRef(new Animated.Value(0)).current;
  const timerBarAnim = useRef(new Animated.Value(1)).current;

  // ---- Portrait lock -------------------------------------------------------
  useEffect(() => {
    Orientation.lockToPortrait();
    return () => {
      Orientation.unlockAllOrientations();
    };
  }, []);

  // ---- Spinner loop --------------------------------------------------------
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim]);

  // ---- Load puzzle ---------------------------------------------------------
  const loadPuzzle = useCallback(() => {
    setPuzzleState({ status: 'loading' });
    try {
      const puzzle = generatePuzzle();
      setPuzzleState({ status: 'ready', puzzle });
      setRevealed(new Set());
      setMatched(new Set());
      setSelected([]);
      setFlipping(false);
      setTimeLeft(STONE_PAIRS_TIME_LIMIT);
      setGameOver(false);
      setShowCompleteOverlay(false);
      completedRef.current = false;
      matchedPairsRef.current = 0;
      flipsRef.current = [];
      timerBarAnim.setValue(1);
      startTimeRef.current = Date.now();
    } catch {
      setPuzzleState({ status: 'error' });
    }
  }, [timerBarAnim]);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  // ---- Complete handler (fire only once) -----------------------------------
  const finishGame = useCallback(
    (result: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      // Clear timer immediately
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, result, timeTaken);

      pendingResultRef.current = {
        result,
        timeTaken,
        completionHash,
        solutionData: {
          flips: flipsRef.current,
          totalFlips: flipsRef.current.length,
          solved: result === 'win',
        },
      };
      setOverlayResult(result === 'win' ? 'win' : 'lose');
      setShowCompleteOverlay(true);
    },
    [sessionId],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // ---- Timer (Date.now delta, NOT setTimeout drift) ------------------------
  useEffect(() => {
    if (puzzleState.status !== 'ready' || gameOver) return;
    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, STONE_PAIRS_TIME_LIMIT - elapsed);
      setTimeLeft(remaining);

      Animated.timing(timerBarAnim, {
        toValue: remaining / STONE_PAIRS_TIME_LIMIT,
        duration: 90,
        useNativeDriver: false,
      }).start();

      if (remaining <= 0) {
        clearInterval(interval);
        timerRef.current = null;
        finishGame('timeout');
      }
    }, 100);
    timerRef.current = interval;

    return () => {
      clearInterval(interval);
      timerRef.current = null;
    };
  }, [puzzleState.status, gameOver, timerBarAnim, finishGame]);

  // ---- Back-navigation interception ----------------------------------------
  useEffect(() => {
    if (gameOver) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      finishGame('lose');
      return true;
    });
    return () => sub.remove();
  }, [gameOver, finishGame]);

  // ---- HowToPlay modal pause/resume ----------------------------------------
  const openHowToPlay = useCallback(() => {
    if (gameOver) return;
    isPausedRef.current = true;
    pauseStartRef.current = Date.now();
    setIsHowToPlayVisible(true);
  }, [gameOver]);

  const closeHowToPlay = useCallback(() => {
    const pausedMs = Date.now() - pauseStartRef.current;
    startTimeRef.current += pausedMs;
    isPausedRef.current = false;
    setIsHowToPlayVisible(false);
  }, []);

  // ---- Cleanup on unmount --------------------------------------------------
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (flipBackTimeoutRef.current) clearTimeout(flipBackTimeoutRef.current);
    };
  }, []);

  // ---- Card tap handler ----------------------------------------------------
  const handleCardPress = useCallback(
    (cardId: number) => {
      if (puzzleState.status !== 'ready') return;
      const puzzle = puzzleState.puzzle;

      if (gameOver || flipping) return;
      if (matched.has(cardId) || revealed.has(cardId)) return;
      if (selected.length >= 2) return;

      const newRevealed = new Set(revealed);
      newRevealed.add(cardId);
      setRevealed(newRevealed);

      const newSelected = [...selected, cardId];
      setSelected(newSelected);

      if (newSelected.length === 2) {
        const card1 = puzzle.cards[newSelected[0]];
        const card2 = puzzle.cards[newSelected[1]];

        // Record flip pair (match or mismatch)
        flipsRef.current.push({ first: newSelected[0], second: newSelected[1] });

        if (checkMatch(card1, card2)) {
          // Match found — keep cards revealed
          const newMatched = new Set(matched);
          newMatched.add(newSelected[0]);
          newMatched.add(newSelected[1]);
          setMatched(newMatched);
          setSelected([]);

          matchedPairsRef.current += 1;

          // Check win
          const { solved } = validateSolution(puzzle, {
            matchedPairs: matchedPairsRef.current,
          });
          if (solved) {
            finishGame('win');
          }
        } else {
          // No match — flip back after delay
          setFlipping(true);
          flipBackTimeoutRef.current = setTimeout(() => {
            setRevealed((prev) => {
              const next = new Set(prev);
              next.delete(newSelected[0]);
              next.delete(newSelected[1]);
              return next;
            });
            setSelected([]);
            setFlipping(false);
            flipBackTimeoutRef.current = null;
          }, FLIP_BACK_DELAY);
        }
      }
    },
    [gameOver, flipping, matched, revealed, selected, puzzleState, finishGame],
  );

  // ---- Render helpers -------------------------------------------------------
  const spinInterpolated = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Loading screen
  if (puzzleState.status === 'loading') {
    return (
      <ImageBackground source={plainBg} style={styles.loadingRoot} resizeMode="cover">
        <Animated.Text
          style={[styles.spinnerEmoji, { transform: [{ rotate: spinInterpolated }] }]}
        >
          {'\uD83C\uDF43'}
        </Animated.Text>
        <Text style={styles.loadingText}>Preparing puzzle...</Text>
      </ImageBackground>
    );
  }

  // Error screen
  if (puzzleState.status === 'error') {
    return (
      <ImageBackground source={plainBg} style={styles.loadingRoot} resizeMode="cover">
        <Text style={styles.errorText}>Could not generate puzzle.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadPuzzle}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </ImageBackground>
    );
  }

  // ---- Ready state — render game -------------------------------------------
  const puzzle = puzzleState.puzzle;
  const { cols, rows } = puzzle;
  const { width: screenW, height: screenH } = Dimensions.get('window');
  // Reserve space for header (~80px) and top padding
  const availableHeight = screenH - 120;
  const availableWidth = screenW - GRID_PADDING * 2;
  const cardFromWidth = Math.floor((availableWidth - CARD_GAP * (cols - 1)) / cols);
  const cardFromHeight = Math.floor((availableHeight - CARD_GAP * (rows - 1)) / rows);
  const cardSize = Math.min(cardFromWidth, cardFromHeight);
  const gridWidth = cardSize * cols + CARD_GAP * (cols - 1);

  // Timer bar color — 3-tier: green → amber → red
  const timeRatio = timeLeft / STONE_PAIRS_TIME_LIMIT;
  const barColor =
    timeRatio > 0.5 ? PALETTE.softGreen : timeRatio > 0.25 ? PALETTE.honeyGold : PALETTE.errorRed;

  // Render grid rows
  const gridRows: CardData[][] = [];
  for (let r = 0; r < rows; r++) {
    gridRows.push(puzzle.cards.slice(r * cols, r * cols + cols));
  }

  const renderCard = (card: CardData) => {
    const isRevealed = revealed.has(card.id) || matched.has(card.id);

    return (
      <TouchableOpacity
        key={card.id}
        activeOpacity={0.7}
        onPress={() => handleCardPress(card.id)}
        disabled={gameOver || flipping || isRevealed}
        style={[
          styles.card,
          {
            width: cardSize,
            height: cardSize,
            backgroundColor: isRevealed ? PALETTE.cream : PALETTE.stoneGrey,
            borderColor: matched.has(card.id) ? PALETTE.softGreen : PALETTE.warmBrown,
            borderWidth: matched.has(card.id) ? 3 : 2,
          },
        ]}
      >
        {isRevealed ? (
          <Text style={[styles.cardIcon, { fontSize: cardSize * 0.45 }]}>
            {card.iconLabel}
          </Text>
        ) : (
          <Text style={[styles.cardBack, { fontSize: cardSize * 0.3 }]}>?</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar: timer text + help button */}
      <View style={styles.topBar}>
        <Text style={styles.timerText}>{Math.ceil(timeLeft)}s</Text>
        <Text style={styles.flipText}>Flips: {flipsRef.current.length}</Text>
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* Timer bar */}
      <View style={styles.timerBarContainer}>
        <Animated.View
          style={[
            styles.timerBarFill,
            {
              width: timerBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: barColor,
            },
          ]}
        />
      </View>

      {/* Card grid */}
      <View style={[styles.grid, { width: gridWidth }]}>
        {gridRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((card) => renderCard(card))}
          </View>
        ))}
      </View>

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          xpEarned={overlayResult === 'win' ? XP_PER_WIN : 0}
          practiceMode={practiceMode}
          onContinue={handleContinue}
        />
      )}

      {/* How to Play modal */}
      <Modal
        animationType="slide"
        transparent
        visible={isHowToPlayVisible}
        onRequestClose={closeHowToPlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeHowToPlay}>
          <Pressable style={styles.modalPanel} onPress={() => {}}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={closeHowToPlay}>
              <Text style={styles.modalCloseBtnText}>{'\u00D7'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Flip & Match</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap any face-down card to flip it over.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap a second card {'\u2014'} if the two cards match, they stay face-up.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} If they don{'\u2019'}t match, both cards flip back face-down after a moment.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Find all 8 pairs before time runs out.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Try to remember where cards are {'\u2014'} the fewer flips you use, the better.
            </Text>
            <Text style={styles.modalTip}>
              Tip: When you flip a card you{'\u2019'}ve seen before, try to recall its match before tapping a second card.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  loadingRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerEmoji: {
    fontFamily: FONTS.body,
    fontSize: 32,
    marginBottom: 12,
  },
  loadingText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.darkBrown,
  },
  errorText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.errorRed,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: PALETTE.parchmentDark,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.darkBrown,
  },
  topBar: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 18,
    color: UI.text,
  },
  flipText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 16,
    color: UI.textMuted,
  },
  helpBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.parchmentDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: PALETTE.darkBrown,
  },
  timerBarContainer: {
    width: '100%',
    height: 14,
    backgroundColor: PALETTE.parchmentDark,
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: 8,
    marginHorizontal: 20,
    alignSelf: 'center',
    maxWidth: '90%',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 7,
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
    color: PALETTE.cream,
    textAlign: 'center',
  },

  // How to Play modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalPanel: {
    backgroundColor: PALETTE.parchment,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.parchmentDark,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  modalCloseBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 18,
    color: PALETTE.darkBrown,
  },
  modalTitle: {
    fontFamily: FONTS.title,
    fontSize: 18,
    color: PALETTE.darkBrown,
    marginBottom: 16,
  },
  modalRule: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.darkBrown,
    lineHeight: 22,
    marginBottom: 8,
  },
  modalTip: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.darkBrown,
    lineHeight: 22,
    fontStyle: 'italic',
    marginTop: 12,
  },
});
