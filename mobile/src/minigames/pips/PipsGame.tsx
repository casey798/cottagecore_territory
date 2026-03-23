import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import { PIPS_TIME_LIMIT } from '@/constants/config';
import { generateClientCompletionHash } from '@/utils/hmac';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import {
  applyTap,
  createEmptyGrid,
  isSolved,
  generatePuzzle,
  GRID_SIZE,
  type Grid,
} from './PipsLogic';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_SIZE = (SCREEN_WIDTH - 64) / GRID_SIZE;
const TILE_GAP = 4;

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

type PuzzleLoadState =
  | { status: 'loading' }
  | { status: 'ready'; puzzle: ReturnType<typeof generatePuzzle> }
  | { status: 'error' };

// Puzzle is generated client-side for Pips. puzzleData from server is not used for puzzle content.
export default function PipsGame(props: MinigamePlayProps) {
  const { sessionId, onComplete, practiceMode, salt } = props;

  const [puzzleState, setPuzzleState] = useState<PuzzleLoadState>({ status: 'loading' });
  const [grid, setGrid] = useState<Grid>(createEmptyGrid);
  const [movesUsed, setMovesUsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(PIPS_TIME_LIMIT);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

  const startTimeRef = useRef(0);
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const tapsRef = useRef<Array<{ row: number; col: number }>>([]);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);
  const loseReasonRef = useRef<string | undefined>(undefined);

  const moveLimit = puzzleState.status === 'ready' ? puzzleState.puzzle.moveLimit : 0;

  // Per-tile scale animations
  const scaleAnims = useRef<Animated.Value[][]>(
    Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => new Animated.Value(1)),
    ),
  ).current;

  // Loading spinner animation
  const spinAnim = useRef(new Animated.Value(0)).current;
  const timerBarAnim = useRef(new Animated.Value(1)).current;

  // Portrait lock
  useEffect(() => {
    Orientation.lockToPortrait();
    return () => {
      Orientation.unlockAllOrientations();
    };
  }, []);

  // Spinner loop
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

  // Load puzzle
  const loadPuzzle = useCallback(() => {
    setPuzzleState({ status: 'loading' });
    try {
      const puzzle = generatePuzzle();
      setPuzzleState({ status: 'ready', puzzle });
      setGrid(puzzle.startGrid.map((r) => [...r]));
      setMovesUsed(0);
      setTimeLeft(PIPS_TIME_LIMIT);
      setGameOver(false);
      completedRef.current = false;
      tapsRef.current = [];
      timerBarAnim.setValue(1);
      startTimeRef.current = Date.now();
    } catch {
      setPuzzleState({ status: 'error' });
    }
  }, [timerBarAnim]);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  // Timer
  useEffect(() => {
    if (puzzleState.status !== 'ready' || gameOver) return;
    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, PIPS_TIME_LIMIT - elapsed);
      setTimeLeft(remaining);

      Animated.timing(timerBarAnim, {
        toValue: remaining / PIPS_TIME_LIMIT,
        duration: 90,
        useNativeDriver: false,
      }).start();

      if (remaining <= 0) {
        clearInterval(interval);
        loseReasonRef.current = "Time's up!";
        finishGame('lose');
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleState.status, gameOver]);

  const finishGame = useCallback(
    (result: 'win' | 'lose') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, result, salt ?? '');

      const solutionData: Record<string, unknown> = {
        taps: tapsRef.current,
        movesUsed: tapsRef.current.length,
        solved: result === 'win',
      };

      pendingResultRef.current = { result, timeTaken, completionHash, solutionData };
      setOverlayResult(result);
      setShowCompleteOverlay(true);
    },
    [sessionId, salt],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  const animateTap = useCallback(
    (row: number, col: number) => {
      const primary = scaleAnims[row][col];
      primary.setValue(0.85);
      Animated.spring(primary, {
        toValue: 1,
        friction: 4,
        tension: 200,
        useNativeDriver: true,
      }).start();

      const neighbors = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ];
      for (const [r, c] of neighbors) {
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
          const anim = scaleAnims[r][c];
          anim.setValue(0.92);
          Animated.spring(anim, {
            toValue: 1,
            friction: 5,
            tension: 180,
            useNativeDriver: true,
          }).start();
        }
      }
    },
    [scaleAnims],
  );

  const playWinAnimation = useCallback(() => {
    const animations: Animated.CompositeAnimation[] = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      for (let r = 0; r < GRID_SIZE; r++) {
        const anim = scaleAnims[r][c];
        animations.push(
          Animated.sequence([
            Animated.delay(c * 80),
            Animated.spring(anim, {
              toValue: 1.15,
              friction: 3,
              tension: 200,
              useNativeDriver: true,
            }),
            Animated.spring(anim, {
              toValue: 1,
              friction: 5,
              useNativeDriver: true,
            }),
          ]),
        );
      }
    }
    Animated.parallel(animations).start();
  }, [scaleAnims]);

  const handleTap = useCallback(
    (row: number, col: number) => {
      if (gameOver) return;

      const newGrid = applyTap(grid, row, col);
      const newMoves = movesUsed + 1;

      tapsRef.current.push({ row, col });
      setGrid(newGrid);
      setMovesUsed(newMoves);

      animateTap(row, col);

      if (isSolved(newGrid)) {
        setGameOver(true);
        playWinAnimation();
        setTimeout(() => finishGame('win'), 800);
        return;
      }

      if (newMoves >= moveLimit) {
        setGameOver(true);
        loseReasonRef.current = 'Out of moves';
        setTimeout(() => finishGame('lose'), 400);
      }
    },
    [gameOver, grid, movesUsed, moveLimit, finishGame, animateTap, playWinAnimation],
  );

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

  const isMovesLow = movesUsed >= moveLimit - 1;
  const timeRatio = timeLeft / PIPS_TIME_LIMIT;
  const barColor =
    timeRatio > 0.5 ? PALETTE.softGreen : timeRatio > 0.25 ? PALETTE.honeyGold : PALETTE.errorRed;

  return (
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={[styles.movesText, isMovesLow && styles.textDanger]}>
          Moves: {movesUsed} / {moveLimit}
        </Text>
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* Seconds countdown + Time bar */}
      <Text style={[styles.timerSecondsText, timeRatio <= 0.25 && styles.textDanger]}>
        {Math.ceil(timeLeft)}s
      </Text>
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

      {/* Grid */}
      <View style={styles.gridContainer}>
        {Array.from({ length: GRID_SIZE }).map((_, row) => (
          <View key={row} style={styles.gridRow}>
            {Array.from({ length: GRID_SIZE }).map((_, col) => {
              const isOn = grid[row][col] === 1;
              return (
                <TouchableOpacity
                  key={col}
                  onPress={() => handleTap(row, col)}
                  disabled={gameOver}
                  activeOpacity={0.7}
                >
                  <Animated.View
                    style={[
                      styles.tile,
                      isOn ? styles.tileOn : styles.tileOff,
                      { transform: [{ scale: scaleAnims[row][col] }] },
                    ]}
                  >
                    {isOn && <View style={styles.tileGlow} />}
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Instruction */}
      <Text style={styles.instruction}>Tap tiles to turn them all off</Text>

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          practiceMode={practiceMode}
          onContinue={handleContinue}
          loseTitle={loseReasonRef.current}
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
            <Text style={styles.modalTitle}>How to Play — Snuff Out</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} You have a 5{'\u00D7'}5 grid of lit cells.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap any cell to toggle it and its 4 neighbours (up, down, left, right).
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Goal: turn ALL cells dark.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} You have a limited number of moves — plan ahead.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Run out of moves or time and you lose.
            </Text>
            <Text style={styles.modalTip}>
              Tip: Each tap ripples outward — think a step ahead before you tap.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

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
  movesText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: UI.text,
  },
  textDanger: {
    color: PALETTE.errorRed,
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

  timerSecondsText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI.text,
    alignSelf: 'flex-start',
    marginLeft: '5%',
    marginBottom: 2,
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

  gridContainer: {
    gap: TILE_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    gap: TILE_GAP,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tileOff: {
    backgroundColor: PALETTE.parchmentBg,
    borderColor: PALETTE.warmBrown,
  },
  tileOn: {
    backgroundColor: PALETTE.deepGreen,
    borderColor: PALETTE.tileOnBorder,
  },
  tileGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PALETTE.softGreen,
    opacity: 0.6,
    borderRadius: 7,
  },

  instruction: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.stoneGrey,
    marginTop: 24,
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
