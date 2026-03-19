import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import { CoopDivider } from '@/components/minigames/CoopDivider';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import type { ClanId } from '@/types';
import {
  applyTap,
  isSolved,
  generatePuzzle,
  type Grid,
} from '../pips/PipsLogic';

const GRID_SIZE = 5;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_SIZE = (SCREEN_WIDTH - 64) / GRID_SIZE;
const TILE_GAP = 4;

const P1_ROWS = [0, 1] as const;
const P2_ROWS = [3, 4] as const;
const SHARED_ROW = 2;

function clanColor(clan: string): string {
  return CLAN_COLORS[clan as ClanId] ?? PALETTE.stoneGrey;
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + a;
}

function canP1Tap(row: number): boolean {
  return row <= SHARED_ROW;
}

function canP2Tap(row: number): boolean {
  return row >= SHARED_ROW;
}

export default function PipsCoopGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, puzzleData } = props;

  const p1Name = (puzzleData?.p1Name as string) ?? 'Player 1';
  const p1Clan = (puzzleData?.p1Clan as string) ?? 'ember';
  const p2Name = (puzzleData?.p2Name as string) ?? 'Player 2';
  const p2Clan = (puzzleData?.p2Clan as string) ?? 'tide';

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
  const [lastTapRow, setLastTapRow] = useState<number | null>(null);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const tapsRef = useRef<Array<{ row: number; col: number; player: string }>>([]);

  const scaleAnims = useRef<Animated.Value[][]>(
    Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => new Animated.Value(1)),
    ),
  ).current;

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

  // Clear last tap flash
  useEffect(() => {
    if (lastTapRow === null) return;
    const timeout = setTimeout(() => setLastTapRow(null), 300);
    return () => clearTimeout(timeout);
  }, [lastTapRow]);

  const finishGame = useCallback(
    (result: 'win' | 'lose') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, result, timeTaken);

      const solutionData: Record<string, unknown> = {
        taps: tapsRef.current,
        finalGrid: grid,
        movesUsed: tapsRef.current.length,
        solved: result === 'win',
      };

      pendingResultRef.current = { result, timeTaken, completionHash, solutionData };
      setOverlayResult(result);
      setShowCompleteOverlay(true);
    },
    [sessionId, grid],
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
    (row: number, col: number, player: 'p1' | 'p2') => {
      if (gameOver) return;

      // Enforce zone ownership
      if (player === 'p1' && !canP1Tap(row)) return;
      if (player === 'p2' && !canP2Tap(row)) return;

      const newGrid = applyTap(grid, row, col);
      const newMoves = movesUsed + 1;

      tapsRef.current.push({ row, col, player });
      setGrid(newGrid);
      setMovesUsed(newMoves);
      setLastTapRow(row);

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

  const isMovesLow = movesUsed >= moveLimit - 1;

  const renderCell = (row: number, col: number, player: 'p1' | 'p2' | 'shared') => {
    const isOn = grid[row][col] === 1;
    const disabled = gameOver || (player === 'p1' ? !canP1Tap(row) : player === 'p2' ? !canP2Tap(row) : false);

    // For shared row cells, tapping is handled by whichever zone — but since shared row
    // is rendered once in the divider, we allow both players. We pick a neutral tap handler.
    const tapPlayer = player === 'shared' ? 'p1' : player;

    return (
      <TouchableOpacity
        key={col}
        onPress={() => handleTap(row, col, tapPlayer)}
        disabled={disabled}
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
  };

  const renderSharedRow = () => (
    <View style={styles.sharedRowContainer}>
      <View style={styles.sharedRowInner}>
        <Text style={styles.sharedLabel}>{'\u2195'}</Text>
        <View style={styles.gridRow}>
          {Array.from({ length: GRID_SIZE }).map((_, col) => {
            const isOn = grid[SHARED_ROW][col] === 1;
            return (
              <View key={col} style={styles.sharedCellWrapper}>
                {/* P1 tap zone — top half */}
                <TouchableOpacity
                  style={styles.halfTapZone}
                  onPress={() => handleTap(SHARED_ROW, col, 'p1')}
                  disabled={gameOver}
                  activeOpacity={1}
                />
                {/* P2 tap zone — bottom half */}
                <TouchableOpacity
                  style={styles.halfTapZone}
                  onPress={() => handleTap(SHARED_ROW, col, 'p2')}
                  disabled={gameOver}
                  activeOpacity={1}
                />
                {/* Visual cell overlay (not tappable, just visual) */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.tile,
                    styles.sharedCell,
                    isOn ? styles.tileOn : styles.tileOff,
                    { transform: [{ scale: scaleAnims[SHARED_ROW][col] }] },
                  ]}
                >
                  {isOn && <View style={styles.tileGlow} />}
                </Animated.View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );

  const renderZoneRows = (rows: readonly number[], player: 'p1' | 'p2') => (
    <View style={styles.zoneGrid}>
      {rows.map((row) => (
        <View key={row} style={styles.gridRow}>
          {Array.from({ length: GRID_SIZE }).map((_, col) =>
            renderCell(row, col, player),
          )}
        </View>
      ))}
    </View>
  );

  const p1BgColor = withAlpha(clanColor(p1Clan), 0.1);
  const p2BgColor = withAlpha(clanColor(p2Clan), 0.1);

  return (
    <View style={styles.root}>
      {/* P1 Zone */}
      <View style={[styles.zone, { backgroundColor: p1BgColor }]}>
        {renderZoneRows(P1_ROWS, 'p1')}
      </View>

      {/* CoopDivider with shared row + move counter */}
      <CoopDivider
        p1Name={p1Name}
        p1Clan={p1Clan}
        p2Name={p2Name}
        p2Clan={p2Clan}
        timeLeft={timeLeft}
        totalTime={timeLimit}
      >
        {renderSharedRow()}
        <Text style={[styles.movesText, isMovesLow && styles.textDanger]}>
          Moves: {movesUsed} / {moveLimit}
        </Text>
      </CoopDivider>

      {/* P2 Zone */}
      <View style={[styles.zone, { backgroundColor: p2BgColor }]}>
        {renderZoneRows(P2_ROWS, 'p2')}
      </View>

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
  },

  zone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  zoneGrid: {
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

  sharedRowContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: withAlpha(PALETTE.cream, 0.5),
  },
  sharedRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sharedLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: PALETTE.stoneGrey,
  },
  sharedCellWrapper: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    position: 'relative',
  },
  halfTapZone: {
    width: '100%',
    height: '50%',
    zIndex: 2,
  },
  sharedCell: {
    position: 'absolute',
    top: 0,
    left: 0,
  },

  movesText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI.text,
    marginTop: 2,
  },
  textDanger: {
    color: PALETTE.errorRed,
  },
});
