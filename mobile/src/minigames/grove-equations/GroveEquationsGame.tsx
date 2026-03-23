/**
 * Number Crunch — cycle operators between 4 fixed numbers to reach a target.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Modal,
  Pressable,
} from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { NUMBER_CRUNCH_TIME_LIMIT } from '@/constants/config';
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

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

const OP_DISPLAY: Record<string, string> = {
  '+': '+',
  '-': '\u2212',
  '*': '\u00D7',
  '/': '\u00F7',
};

export default function GroveEquationsGame(props: MinigamePlayProps): React.JSX.Element {
  const { sessionId, timeLimit, onComplete, practiceMode } = props;

  const puzzleData = props.puzzleData as { numbers?: number[]; target?: number } | undefined;
  const puzzleRef = useRef(generatePuzzle());
  const puzzle = puzzleRef.current;

  // Use server-provided numbers/target if available, otherwise client-generated
  const numbers = puzzleData?.numbers ?? puzzle.numbers;
  const target = puzzleData?.target ?? puzzle.target;
  const gameDuration = timeLimit > 0 ? timeLimit : NUMBER_CRUNCH_TIME_LIMIT;

  // ── State ────────────────────────────────────────────────────────────

  const [operators, setOperators] = useState<Operator[]>(() =>
    getInitialOperators(puzzle.solution),
  );
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [timeLeft, setTimeLeft] = useState(gameDuration);
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingCompleteRef = useRef<Parameters<typeof onComplete>[0] | null>(null);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);

  // Ref to always hold latest operators (fixes stale closure in finishGame)
  const operatorsRef = useRef<Operator[]>(operators);
  useEffect(() => {
    operatorsRef.current = operators;
  }, [operators]);

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
      if (isPausedRef.current) return;
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
          operators: [...operatorsRef.current],
        },
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId],
  );

  const handleContinue = useCallback(() => {
    if (pendingCompleteRef.current) {
      onComplete(pendingCompleteRef.current);
      pendingCompleteRef.current = null;
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
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar */}
      <View style={styles.topBar}>
        <View />
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay} disabled={gameOver}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Number Crunch</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} You are given 4 numbers and a target number to reach.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap the operator slots between the numbers to cycle through +, {'\u2212'}, {'\u00D7'}, {'\u00F7'}.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} The equation is evaluated with standard math rules {'\u2014'} {'\u00D7'} and {'\u00F7'} happen before + and {'\u2212'}.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Change the operators until the result shown equals the target.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} If the result shows --, that operator combo leads to a non-whole division {'\u2014'} try another.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} The puzzle is solved the moment your equation equals the target.
            </Text>
            <Text style={styles.modalTip}>
              Tip: If the target is large, try multiplying first. If it is small, try subtracting after a multiply.
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

  // Top bar
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
    fontFamily: FONTS.title,
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
    borderBottomColor: PALETTE.warmBrown,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: PALETTE.darkBrown,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  numberText: {
    fontFamily: FONTS.title,
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
    fontFamily: FONTS.title,
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
    fontFamily: FONTS.title,
    fontSize: 28,
    color: PALETTE.stoneGrey,
  },
  resultText: {
    fontFamily: FONTS.title,
    fontSize: 36,
    color: PALETTE.darkBrown,
  },
  resultTextMatch: {
    color: PALETTE.softGreen,
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
