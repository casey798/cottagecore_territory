/**
 * Bloom Sequence — 3-round pattern recognition minigame.
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
} from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps } from '@/types/minigame';
import {
  generateGame,
  validateAnswer,
  type SequenceItem,
  type Round,
  type BloomSequenceGame as GameData,
} from './BloomSequenceLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';

// ── Sizes for visual items ─────────────────────────────────────────────

const SIZE_PX = { small: 24, medium: 36, large: 52 } as const;
const ITEM_BOX = 56;
const OPTION_BOX = 72;

// ── SequenceItem renderer ──────────────────────────────────────────────

function renderItem(item: SequenceItem, boxSize: number): React.JSX.Element {
  const center = { alignItems: 'center' as const, justifyContent: 'center' as const };

  if (item.kind === 'number') {
    return (
      <View style={[styles.numTile, { width: boxSize, height: boxSize }]}>
        <Text style={styles.numText}>{item.value}</Text>
      </View>
    );
  }

  if (item.kind === 'color') {
    const sz = item.size ? SIZE_PX[item.size] : 36;
    const borderR = item.shape === 'square' ? 4 : sz / 2;
    return (
      <View style={[center, { width: boxSize, height: boxSize }]}>
        <View style={{ width: sz, height: sz, borderRadius: borderR, backgroundColor: item.color! }} />
      </View>
    );
  }

  if (item.kind === 'shape') {
    const sz = 36;
    const borderR = item.shape === 'circle' ? sz / 2 : 4;
    return (
      <View style={[center, { width: boxSize, height: boxSize }]}>
        <View style={{ width: sz, height: sz, borderRadius: borderR, backgroundColor: item.color! }} />
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
      <View style={[center, { width: boxSize, height: boxSize }]}>
        <View style={{ width: sz, height: sz, borderRadius: borderR, backgroundColor: item.color! }} />
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
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: PALETTE.darkBrown,
          margin: 1,
        }}
      />,
    );
  }
  return (
    <View style={{ width: boxSize, height: boxSize, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
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
        style={[styles.optionCard, { backgroundColor: bgColor, width: OPTION_BOX * 1.6, height: OPTION_BOX * 1.3 }]}
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
  const { sessionId, timeLimit, onComplete } = props;
  const gameDuration = timeLimit > 0 ? timeLimit : 90;

  // Use server puzzleData if available, otherwise generate client-side
  const puzzleData = props.puzzleData as { rounds?: Round[] } | undefined;
  const gameRef = useRef<GameData>(
    puzzleData?.rounds
      ? { rounds: puzzleData.rounds }
      : generateGame(),
  );

  // ── State ────────────────────────────────────────────────────────────

  const [currentRound, setCurrentRound] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [optionStates, setOptionStates] = useState<Array<'default' | 'correct' | 'wrong'>>(['default', 'default', 'default', 'default']);
  const [roundLocked, setRoundLocked] = useState(false);
  const [showRoundOverlay, setShowRoundOverlay] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [timeLeft, setTimeLeft] = useState(gameDuration);
  const [answers, setAnswers] = useState<number[]>([]);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingCompleteRef = useRef<Parameters<typeof onComplete>[0] | null>(null);

  const round = gameRef.current.rounds[currentRound];

  // ── Timer ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, gameDuration - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) finishGame('timeout');
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

      pendingCompleteRef.current = {
        result: outcome,
        timeTaken,
        completionHash,
        solutionData: {
          answers,
          roundReached: currentRound + 1,
        },
      };
    },
    [answers, currentRound, sessionId],
  );

  const handleContinue = useCallback(() => {
    if (pendingCompleteRef.current) {
      onComplete(pendingCompleteRef.current);
      pendingCompleteRef.current = null;
    }
  }, [onComplete]);

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
          // Won all 3 rounds
          setTimeout(() => {
            if (!completedRef.current) {
              completedRef.current = true;
              setGameOver(true);
              setOverlayResult('win');
              setShowCompleteOverlay(true);

              const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
              const completionHash = generateClientCompletionHash(sessionId, 'win', timeTaken);
              pendingCompleteRef.current = {
                result: 'win',
                timeTaken,
                completionHash,
                solutionData: { answers: newAnswers, roundReached: 3 },
              };
            }
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
                  setWrongCount(0);
                  setOptionStates(['default', 'default', 'default', 'default']);
                  setRoundLocked(false);
                }
              }, 600);
            }
          }, 400);
        }
      } else {
        // Wrong answer
        setOptionStates((prev) => {
          const next = [...prev];
          next[optionIndex] = 'wrong';
          return next;
        });

        const newWrong = wrongCount + 1;
        setWrongCount(newWrong);

        if (newWrong >= 2) {
          // Two wrong in same round → LOSE
          setTimeout(() => finishGame('lose'), 300);
        }
      }
    },
    [gameOver, roundLocked, round, answers, currentRound, wrongCount, sessionId, finishGame],
  );

  // ── Render ───────────────────────────────────────────────────────────

  const timerFraction = timeLeft / gameDuration;

  return (
    <View style={styles.container}>
      {/* Timer bar */}
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
      <Text style={styles.timerText}>{Math.ceil(timeLeft)}s</Text>

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
            disabled={gameOver || roundLocked || optionStates[0] === 'wrong'}
            state={optionStates[0]}
          />
          <OptionCard
            item={round.options[1]}
            index={1}
            onPress={handleOptionPress}
            disabled={gameOver || roundLocked || optionStates[1] === 'wrong'}
            state={optionStates[1]}
          />
        </View>
        <View style={styles.optionsRow}>
          <OptionCard
            item={round.options[2]}
            index={2}
            onPress={handleOptionPress}
            disabled={gameOver || roundLocked || optionStates[2] === 'wrong'}
            state={optionStates[2]}
          />
          <OptionCard
            item={round.options[3]}
            index={3}
            onPress={handleOptionPress}
            disabled={gameOver || roundLocked || optionStates[3] === 'wrong'}
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
        />
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
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
    marginBottom: 8,
  },
  roundLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.stoneGrey,
    marginBottom: 12,
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
    fontFamily: FONTS.headerBold,
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
  numTile: {
    backgroundColor: PALETTE.stoneGrey,
    borderRadius: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#7A6F63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    fontFamily: FONTS.headerBold,
    fontSize: 22,
    color: PALETTE.cream,
  },
  roundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(61, 43, 31, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundOverlayText: {
    fontFamily: FONTS.headerBold,
    fontSize: 24,
    color: PALETTE.cream,
    backgroundColor: PALETTE.softGreen,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    overflow: 'hidden',
  },
});
