/**
 * Spot the Pattern — 3-round pattern recognition minigame.
 * Each round: 5-item sequence + pick the correct 6th item from 4 options.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  ImageBackground,
  Modal,
  Pressable,
} from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { SPOT_THE_PATTERN_TIME_LIMIT } from '@/constants/config';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import {
  generateGame,
  validateAnswer,
  type SequenceItem,
  type Round,
  type BloomSequenceGame as GameData,
} from './BloomSequenceLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';

// ── Constants ─────────────────────────────────────────────────────────

const SIZE_PX = { small: 24, medium: 36, large: 52 } as const;
const ITEM_BOX = 56;
const OPTION_BOX = 72;

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

// ── SequenceItem renderer ──────────────────────────────────────────────

function renderItem(item: SequenceItem, boxSize: number): React.JSX.Element {
  if (item.kind === 'number') {
    return (
      <View style={[styles.numTile, styles.itemBox, { width: boxSize, height: boxSize }]}>
        <Text style={styles.numText}>{item.value}</Text>
      </View>
    );
  }

  if (item.kind === 'color') {
    const sz = item.size ? SIZE_PX[item.size] : 36;
    const borderR = item.shape === 'square' ? 4 : sz / 2;
    return (
      <View style={[styles.itemCenter, { width: boxSize, height: boxSize }]}>
        <View style={[styles.colorSwatch, { width: sz, height: sz, borderRadius: borderR, backgroundColor: item.color! }]} />
      </View>
    );
  }

  if (item.kind === 'shape') {
    const sz = 36;
    const borderR = item.shape === 'circle' ? sz / 2 : 4;
    return (
      <View style={[styles.itemCenter, { width: boxSize, height: boxSize }]}>
        <View style={[styles.colorSwatch, { width: sz, height: sz, borderRadius: borderR, backgroundColor: item.color! }]} />
      </View>
    );
  }

  if (item.kind === 'size') {
    const sz = item.size ? SIZE_PX[item.size] : 36;
    const borderR = item.shape === 'square' ? 4 : sz / 2;
    return (
      <View style={[styles.itemCenter, { width: boxSize, height: boxSize }]}>
        <View style={[styles.colorSwatch, { width: sz, height: sz, borderRadius: borderR, backgroundColor: item.color! }]} />
      </View>
    );
  }

  if (item.kind === 'dots') {
    return renderDots(item.dotCount!, boxSize);
  }

  if (item.kind === 'compound') {
    const sz = item.size ? SIZE_PX[item.size] : 36;
    const borderR = item.shape === 'circle' ? sz / 2 : 4;
    return (
      <View style={[styles.itemCenter, { width: boxSize, height: boxSize }]}>
        <View style={[styles.colorSwatch, { width: sz, height: sz, borderRadius: borderR, backgroundColor: item.color! }]} />
      </View>
    );
  }

  return <View style={{ width: boxSize, height: boxSize }} />;
}

function renderDots(count: number, boxSize: number): React.JSX.Element {
  const cols = Math.ceil(Math.sqrt(count));
  const dotSize = Math.max(4, Math.min(8, Math.floor((boxSize - 8) / cols) - 2));
  const dots: React.JSX.Element[] = [];
  for (let i = 0; i < count; i++) {
    dots.push(
      <View
        key={i}
        style={[styles.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2 }]}
      />,
    );
  }
  return (
    <View style={[styles.dotContainer, { width: boxSize, height: boxSize }]}>
      {dots}
    </View>
  );
}

// ── Option card with shake animation ───────────────────────────────────

interface OptionCardProps {
  item: SequenceItem;
  index: number;
  onPress: (index: number) => void;
  disabled: boolean;
  state: 'default' | 'correct' | 'wrong';
}

function OptionCard({ item, index, onPress, disabled, state }: OptionCardProps) {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'wrong') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [state, shakeAnim]);

  const bgColor =
    state === 'correct' ? PALETTE.softGreen :
    state === 'wrong' ? PALETTE.errorRed :
    PALETTE.cream;

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      <TouchableOpacity
        style={[styles.optionCard, { backgroundColor: bgColor }]}
        onPress={() => onPress(index)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {renderItem(item, OPTION_BOX)}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function BloomSequenceGameComponent(props: MinigamePlayProps): React.JSX.Element {
  const { sessionId, timeLimit, onComplete, practiceMode } = props;
  const gameDuration = timeLimit > 0 ? timeLimit : SPOT_THE_PATTERN_TIME_LIMIT;

  // Use server puzzleData if available, otherwise generate client-side
  const puzzleData = props.puzzleData as { rounds?: Round[] } | undefined;
  const gameRef = useRef<GameData>(
    puzzleData?.rounds
      ? { rounds: puzzleData.rounds }
      : generateGame(),
  );

  // ── State ────────────────────────────────────────────────────────────

  const [currentRound, setCurrentRound] = useState(0);
  const [optionStates, setOptionStates] = useState<Array<'default' | 'correct' | 'wrong'>>(['default', 'default', 'default', 'default']);
  const [roundLocked, setRoundLocked] = useState(false);
  const [showRoundOverlay, setShowRoundOverlay] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [timeLeft, setTimeLeft] = useState(gameDuration);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);

  // Refs for stale-closure fix (CHANGE 5)
  const answersRef = useRef<number[]>([]);
  const currentRoundRef = useRef(0);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);

  const round = gameRef.current.rounds[currentRound];

  // ── Timer ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, gameDuration - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        finishGame('timeout');
      }
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  // ── Finish helper ────────────────────────────────────────────────────

  const finishGame = useCallback(
    (outcome: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);
      setOverlayResult(outcome === 'win' ? 'win' : 'lose');
      setShowCompleteOverlay(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, outcome, timeTaken);

      pendingResultRef.current = {
        result: outcome,
        timeTaken,
        completionHash,
        solutionData: {
          answers: answersRef.current,
          roundReached: currentRoundRef.current + 1,
        },
      };
    },
    [sessionId],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // ── How to Play ────────────────────────────────────────────────────

  const openHowToPlay = useCallback(() => {
    isPausedRef.current = true;
    pauseStartRef.current = Date.now();
    setIsHowToPlayVisible(true);
  }, []);

  const closeHowToPlay = useCallback(() => {
    const pausedMs = Date.now() - pauseStartRef.current;
    startTimeRef.current += pausedMs;
    isPausedRef.current = false;
    setIsHowToPlayVisible(false);
  }, []);

  // ── Option tap handler ───────────────────────────────────────────────

  const handleOptionPress = useCallback(
    (optionIndex: number) => {
      if (gameOver || roundLocked) return;

      const chosen = round.options[optionIndex];
      const isCorrect = validateAnswer(round, chosen);

      if (isCorrect) {
        // Mark correct
        setOptionStates((prev) => {
          const next = [...prev];
          next[optionIndex] = 'correct';
          return next;
        });
        setRoundLocked(true);

        const newAnswers = [...answers, optionIndex];
        setAnswers(newAnswers);

        if (currentRound >= 2) {
          // Won all 3 rounds — set guard IMMEDIATELY before setTimeout (CHANGE 4)
          completedRef.current = true;

          setTimeout(() => {
            setGameOver(true);
            setOverlayResult('win');
            setShowCompleteOverlay(true);

            const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
            const completionHash = generateClientCompletionHash(sessionId, 'win', timeTaken);
            pendingResultRef.current = {
              result: 'win',
              timeTaken,
              completionHash,
              solutionData: { answers: newAnswers, roundReached: 3 },
            };
          }, 400);
        } else {
          // Show round complete overlay, advance
          setTimeout(() => {
            if (!completedRef.current) {
              setShowRoundOverlay(true);
              setTimeout(() => {
                if (!completedRef.current) {
                  setShowRoundOverlay(false);
                  setCurrentRound((r) => r + 1);
                  setOptionStates(['default', 'default', 'default', 'default']);
                  setRoundLocked(false);
                }
              }, 600);
            }
          }, 400);
        }
      } else {
        // Wrong answer — immediate loss (CHANGE 3)
        // Set guard IMMEDIATELY to prevent timer race
        completedRef.current = true;

        setOptionStates((prev) => {
          const next = [...prev];
          next[optionIndex] = 'wrong';
          return next;
        });
        setRoundLocked(true);

        // Brief red flash, then finishGame
        setTimeout(() => {
          setGameOver(true);
          setOverlayResult('lose');
          setShowCompleteOverlay(true);

          const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
          const completionHash = generateClientCompletionHash(sessionId, 'lose', timeTaken);
          pendingResultRef.current = {
            result: 'lose',
            timeTaken,
            completionHash,
            solutionData: {
              answers: [...answersRef.current],
              roundReached: currentRoundRef.current + 1,
            },
          };
        }, 300);
      }
    },
    [gameOver, roundLocked, round, answers, currentRound, sessionId],
  );

  // ── Render ───────────────────────────────────────────────────────────

  const timerFraction = timeLeft / gameDuration;

  return (
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar */}
      <View style={styles.topBar}>
        <View />
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* Timer */}
      <Text style={styles.timerText}>{Math.ceil(timeLeft)}s</Text>
      <View style={styles.timerBarBg}>
        <View
          style={[
            styles.timerBarFill,
            {
              width: `${timerFraction * 100}%`,
              backgroundColor: timerFraction > 0.25 ? PALETTE.softGreen : PALETTE.mutedRose,
            },
          ]}
        />
      </View>

      {/* Round indicator */}
      <Text style={styles.roundLabel}>Round {currentRound + 1} of 3</Text>

      {/* Sequence row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sequenceScroll} contentContainerStyle={styles.sequenceContent}>
        {round.sequence.map((item, i) => (
          <View key={i} style={styles.sequenceSlot}>
            {renderItem(item, ITEM_BOX)}
          </View>
        ))}
        <View style={styles.blankSlot}>
          <Text style={styles.blankText}>?</Text>
        </View>
      </ScrollView>

      {/* Answer options 2×2 grid */}
      <View style={styles.optionsGrid}>
        <View style={styles.optionsRow}>
          <OptionCard
            item={round.options[0]}
            index={0}
            onPress={handleOptionPress}
            disabled={gameOver || roundLocked}
            state={optionStates[0]}
          />
          <OptionCard
            item={round.options[1]}
            index={1}
            onPress={handleOptionPress}
            disabled={gameOver || roundLocked}
            state={optionStates[1]}
          />
        </View>
        <View style={styles.optionsRow}>
          <OptionCard
            item={round.options[2]}
            index={2}
            onPress={handleOptionPress}
            disabled={gameOver || roundLocked}
            state={optionStates[2]}
          />
          <OptionCard
            item={round.options[3]}
            index={3}
            onPress={handleOptionPress}
            disabled={gameOver || roundLocked}
            state={optionStates[3]}
          />
        </View>
      </View>

      {/* Round complete overlay */}
      {showRoundOverlay && (
        <View style={styles.roundOverlay}>
          <Text style={styles.roundOverlayText}>
            {'\u2713'} Round {currentRound + 1} complete!
          </Text>
        </View>
      )}

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          xpEarned={overlayResult === 'win' ? 25 : 0}
          onContinue={handleContinue}
          practiceMode={practiceMode}
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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Spot the Pattern</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} You are shown 5 items in a row following a pattern.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} The pattern may be numeric (counting, doubling), a color cycle, shape progression, or dot count.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Pick the correct 6th item from the 4 options below.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Complete all 3 rounds to win. One wrong answer ends the game.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} The timer runs across all 3 rounds {'\u2014'} open this sheet to pause it.
            </Text>
            <Text style={styles.modalTip}>
              Tip: Look at the gap between items {'\u2014'} is it constant, multiplying, or cycling?
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  timerBarBg: {
    width: '90%',
    height: 8,
    backgroundColor: PALETTE.stoneGrey,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 2,
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI.text,
    alignSelf: 'flex-start',
    marginLeft: '5%',
    marginBottom: 2,
  },
  roundLabel: {
    fontFamily: FONTS.title,
    fontSize: 16,
    color: PALETTE.darkBrown,
    marginBottom: 12,
    marginTop: 4,
  },
  sequenceScroll: {
    flexGrow: 0,
    marginBottom: 20,
  },
  sequenceContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  sequenceSlot: {
    backgroundColor: PALETTE.cream,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 10,
    width: ITEM_BOX + 8,
    height: ITEM_BOX + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankSlot: {
    width: ITEM_BOX + 8,
    height: ITEM_BOX + 8,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  blankText: {
    fontFamily: FONTS.title,
    fontSize: 28,
    color: PALETTE.stoneGrey,
  },
  optionsGrid: {
    gap: 12,
    paddingHorizontal: 24,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  optionCard: {
    width: OPTION_BOX * 1.6,
    height: OPTION_BOX * 1.3,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  // ── Sequence item styles ──
  itemCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatch: {
    // dimensions, borderRadius, backgroundColor applied dynamically
  },
  numTile: {
    backgroundColor: PALETTE.stoneGrey,
    borderRadius: 8,
    borderBottomWidth: 3,
    borderBottomColor: PALETTE.warmGreyBrown,
  },
  numText: {
    fontSize: 22,
    color: PALETTE.cream,
  },
  dot: {
    backgroundColor: PALETTE.darkBrown,
    margin: 1,
  },
  dotContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  // ── Overlays ──
  roundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(61, 43, 31, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundOverlayText: {
    fontFamily: FONTS.title,
    fontSize: 24,
    color: PALETTE.cream,
    backgroundColor: PALETTE.softGreen,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    overflow: 'hidden',
  },
  // ── How to Play modal ──
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
