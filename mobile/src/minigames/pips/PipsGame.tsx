import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import {
  applyTap,
  isSolved,
  generatePuzzle,
  type Grid,
} from './PipsLogic';

const GRID_SIZE = 5;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_SIZE = (SCREEN_WIDTH - 64) / GRID_SIZE;
const TILE_GAP = 4;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PipsGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete } = props;

  const puzzleRef = useRef(generatePuzzle());
  const puzzle = puzzleRef.current;
  const moveLimit = puzzle.moveLimit;

  const [grid, setGrid] = useState<Grid>(() =>
    puzzle.startGrid.map((r) => [...r]),
  );
  const [movesUsed, setMovesUsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const tapsRef = useRef<Array<{ row: number; col: number }>>([]);

  // Per-tile scale animations
  const scaleAnims = useRef<Animated.Value[][]>(
    Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => new Animated.Value(1)),
    ),
  ).current;

  // Portrait lock
  useEffect(() => {
    Orientation.lockToPortrait();
    return () => {
      Orientation.unlockAllOrientations();
    };
  }, []);

  // Timer
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        finishGame('lose');
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, timeLimit]);

  const finishGame = useCallback(
    (result: 'win' | 'lose') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, result, timeTaken);

      const solutionData: Record<string, unknown> = {
        taps: tapsRef.current,
        movesUsed: tapsRef.current.length,
        solved: result === 'win',
      };

      pendingResultRef.current = { result, timeTaken, completionHash, solutionData };
      setOverlayResult(result);
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

  const animateTap = useCallback(
    (row: number, col: number) => {
      // Primary tap: deeper bounce
      const primary = scaleAnims[row][col];
      primary.setValue(0.85);
      Animated.spring(primary, {
        toValue: 1,
        friction: 4,
        tension: 200,
        useNativeDriver: true,
      }).start();

      // Neighbor pulse: subtler
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
        setTimeout(() => finishGame('lose'), 400);
      }
    },
    [gameOver, grid, movesUsed, moveLimit, finishGame, animateTap, playWinAnimation],
  );

  const isTimeLow = timeLeft < 10;
  const isMovesLow = movesUsed >= moveLimit - 1;

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={[styles.timerText, isTimeLow && styles.textDanger]}>
          {'\u23F1'} {formatTime(timeLeft)}
        </Text>
        <Text style={[styles.movesText, isMovesLow && styles.textDanger]}>
          Moves: {movesUsed} / {moveLimit}
        </Text>
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
          onContinue={handleContinue}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.background,
    alignItems: 'center',
    paddingTop: 8,
  },

  topBar: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: UI.text,
  },
  movesText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: UI.text,
  },
  textDanger: {
    color: '#C0392B',
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
    borderColor: '#1a3a18',
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
});
