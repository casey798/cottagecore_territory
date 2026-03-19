/**
 * Grove Equations — cycle operators between 4 fixed numbers to reach a target.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps } from '@/types/minigame';
import {
  generatePuzzle,
  getInitialOperators,
  evaluate,
  cycleOperator,
  type Operator,
} from './GroveEquationsLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';

const OP_DISPLAY: Record<string, string> = {
  '+': '+',
  '-': '\u2212',
  '*': '\u00D7',
  '/': '\u00F7',
};

export default function GroveEquationsGame(props: MinigamePlayProps): React.JSX.Element {
  const { sessionId, timeLimit, onComplete } = props;

  const puzzleData = props.puzzleData as { numbers?: number[]; target?: number } | undefined;
  const puzzleRef = useRef(generatePuzzle());
  const puzzle = puzzleRef.current;

  // Use server-provided numbers/target if available, otherwise client-generated
  const numbers = puzzleData?.numbers ?? puzzle.numbers;
  const target = puzzleData?.target ?? puzzle.target;
  const gameDuration = timeLimit > 0 ? timeLimit : 120;

  // ── State ────────────────────────────────────────────────────────────

  const [operators, setOperators] = useState<Operator[]>(() =>
    getInitialOperators(puzzle.solution),
  );
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [timeLeft, setTimeLeft] = useState(gameDuration);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingCompleteRef = useRef<Parameters<typeof onComplete>[0] | null>(null);

  // ── Live result ──────────────────────────────────────────────────────

  const liveResult = evaluate(numbers, operators);

  // ── Auto-win check ───────────────────────────────────────────────────

  useEffect(() => {
    if (gameOver) return;
    if (liveResult === target) {
      finishGame('win');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operators]);

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
          operators: [...operators],
        },
      };
    },
    [operators, sessionId],
  );

  const handleContinue = useCallback(() => {
    if (pendingCompleteRef.current) {
      onComplete(pendingCompleteRef.current);
      pendingCompleteRef.current = null;
    }
  }, [onComplete]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleCycleOp = (index: number) => {
    if (gameOver) return;
    setOperators((prev) => {
      const next = [...prev] as Operator[];
      next[index] = cycleOperator(prev[index]);
      return next;
    });
  };

  // ── Render ───────────────────────────────────────────────────────────

  const timerFraction = timeLeft / gameDuration;
  const resultDisplay = liveResult !== null ? String(liveResult) : '--';
  const resultIsTarget = liveResult === target;

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

      {/* Target */}
      <View style={styles.targetPanel}>
        <Text style={styles.targetLabel}>Target</Text>
        <Text style={styles.targetNumber}>{target}</Text>
      </View>

      {/* Equation row */}
      <View style={styles.equationContainer}>
        <View style={styles.equationRow}>
          {/* N1 */}
          <View style={styles.numberTile}>
            <Text style={styles.numberText}>{numbers[0]}</Text>
          </View>

          {/* OP1 */}
          <TouchableOpacity
            style={styles.opSlot}
            onPress={() => handleCycleOp(0)}
            disabled={gameOver}
            activeOpacity={0.7}
          >
            <Text style={styles.opSlotText}>{OP_DISPLAY[operators[0]]}</Text>
          </TouchableOpacity>

          {/* N2 */}
          <View style={styles.numberTile}>
            <Text style={styles.numberText}>{numbers[1]}</Text>
          </View>

          {/* OP2 */}
          <TouchableOpacity
            style={styles.opSlot}
            onPress={() => handleCycleOp(1)}
            disabled={gameOver}
            activeOpacity={0.7}
          >
            <Text style={styles.opSlotText}>{OP_DISPLAY[operators[1]]}</Text>
          </TouchableOpacity>

          {/* N3 */}
          <View style={styles.numberTile}>
            <Text style={styles.numberText}>{numbers[2]}</Text>
          </View>

          {/* OP3 */}
          <TouchableOpacity
            style={styles.opSlot}
            onPress={() => handleCycleOp(2)}
            disabled={gameOver}
            activeOpacity={0.7}
          >
            <Text style={styles.opSlotText}>{OP_DISPLAY[operators[2]]}</Text>
          </TouchableOpacity>

          {/* N4 */}
          <View style={styles.numberTile}>
            <Text style={styles.numberText}>{numbers[3]}</Text>
          </View>
        </View>

        {/* = result */}
        <View style={styles.resultRow}>
          <Text style={styles.equalsSign}>=</Text>
          <Text style={[styles.resultText, resultIsTarget && styles.resultTextMatch]}>
            {resultDisplay}
          </Text>
        </View>
      </View>

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

  // Timer
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
    marginBottom: 16,
  },

  // Target
  targetPanel: {
    backgroundColor: PALETTE.cream,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 16,
    paddingHorizontal: 40,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  targetLabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.stoneGrey,
    marginBottom: 4,
  },
  targetNumber: {
    fontFamily: FONTS.headerBold,
    fontSize: 48,
    color: PALETTE.warmBrown,
  },

  // Equation
  equationContainer: {
    alignItems: 'center',
    gap: 12,
  },
  equationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  numberTile: {
    backgroundColor: PALETTE.stoneGrey,
    width: 44,
    height: 52,
    borderRadius: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#7A6F63',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  numberText: {
    fontFamily: FONTS.headerBold,
    fontSize: 24,
    color: PALETTE.cream,
  },
  opSlot: {
    backgroundColor: PALETTE.warmBrown,
    width: 40,
    height: 44,
    borderRadius: 8,
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.darkBrown,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opSlotText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    color: PALETTE.cream,
  },

  // Result
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  equalsSign: {
    fontFamily: FONTS.headerBold,
    fontSize: 28,
    color: PALETTE.stoneGrey,
  },
  resultText: {
    fontFamily: FONTS.headerBold,
    fontSize: 36,
    color: PALETTE.darkBrown,
  },
  resultTextMatch: {
    color: PALETTE.softGreen,
  },
});
