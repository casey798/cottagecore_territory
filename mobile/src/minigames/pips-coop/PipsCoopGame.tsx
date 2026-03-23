import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CLAN_COLORS, PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { PIPS_TIME_LIMIT } from '@/constants/config';
import { generateClientCompletionHash } from '@/utils/hmac';
import { withAlpha } from '@/utils/colorUtils';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import { CoopDivider } from '@/components/minigames/CoopDivider';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import type { ClanId } from '@/types';
import {
  applyTap,
  createEmptyGrid,
  isSolved,
  generatePuzzle,
  GRID_SIZE,
  type Grid,
} from '../pips/PipsLogic';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_SIZE = (SCREEN_WIDTH - 64) / GRID_SIZE;
const TILE_GAP = 4;

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

const P1_ROWS = [0, 1] as const;
const P2_ROWS = [3, 4] as const;
const SHARED_ROW = 2;

type PuzzleLoadState =
  | { status: 'loading' }
  | { status: 'ready'; puzzle: ReturnType<typeof generatePuzzle> }
  | { status: 'error' };

function clanColor(clan: string): string {
  return CLAN_COLORS[clan as ClanId] ?? PALETTE.stoneGrey;
}

function canP1Tap(row: number): boolean {
  return row <= SHARED_ROW;
}

function canP2Tap(row: number): boolean {
  return row >= SHARED_ROW;
}

// Puzzle is generated client-side for Pips. puzzleData from server is not used for puzzle content.
export default function PipsCoopGame(props: MinigamePlayProps) {
  const { sessionId, onComplete, puzzleData, practiceMode, salt } = props;

  const p1Name = (puzzleData?.p1Name as string) ?? 'Player 1';
  const p1Clan = (puzzleData?.p1Clan as string) ?? 'ember';
  const p2Name = (puzzleData?.p2Name as string) ?? 'Player 2';
  const p2Clan = (puzzleData?.p2Clan as string) ?? 'tide';
  const coopPartnerId = (puzzleData?.coopPartnerId as string) ?? undefined;

  const [puzzleState, setPuzzleState] = useState<PuzzleLoadState>({ status: 'loading' });
  const [grid, setGrid] = useState<Grid>(createEmptyGrid);
  const [movesUsed, setMovesUsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(PIPS_TIME_LIMIT);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [lastTapRow, setLastTapRow] = useState<number | null>(null);
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);
  const [activeTurn, setActiveTurn] = useState<'p1' | 'p2'>('p1');

  const startTimeRef = useRef(0);
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const tapsRef = useRef<Array<{ row: number; col: number; player: string }>>([]);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);
  const loseReasonRef = useRef<string | undefined>(undefined);

  const moveLimit = puzzleState.status === 'ready' ? puzzleState.puzzle.moveLimit : 0;

  const scaleAnims = useRef<Animated.Value[][]>(
    Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => new Animated.Value(1)),
    ),
  ).current;

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

  // Clear last tap flash
  useEffect(() => {
    if (lastTapRow === null) return;
    const timeout = setTimeout(() => setLastTapRow(null), 300);
    return () => clearTimeout(timeout);
  }, [lastTapRow]);

  // Win detection — driven by grid state changes (Fix 2)
  useEffect(() => {
    if (gameOver || puzzleState.status !== 'ready') return;
    if (isSolved(grid)) {
      setGameOver(true);
      playWinAnimation();
      setTimeout(() => finishGame('win'), 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, gameOver, puzzleState.status]);

  // Move limit detection — driven by movesUsed state changes (Fix 1)
  useEffect(() => {
    if (gameOver || moveLimit === 0) return;
    if (movesUsed >= moveLimit) {
      setGameOver(true);
      loseReasonRef.current = 'Out of moves';
      setTimeout(() => finishGame('lose'), 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movesUsed, gameOver, moveLimit]);

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
        ...(coopPartnerId ? { coopPartnerId } : {}),
      };

      pendingResultRef.current = { result, timeTaken, completionHash, solutionData };
      setOverlayResult(result);
      setShowCompleteOverlay(true);
    },
    [sessionId, salt, coopPartnerId],
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

      tapsRef.current.push({ row, col, player });
      setLastTapRow(row);
      animateTap(row, col);

      setGrid((prevGrid) => applyTap(prevGrid, row, col));
      setMovesUsed((prev) => prev + 1);

      // Soft turn toggle
      setActiveTurn((prev) => (prev === 'p1' ? 'p2' : 'p1'));
    },
    [gameOver, animateTap],
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

  const renderCell = (row: number, col: number, player: 'p1' | 'p2' | 'shared') => {
    const isOn = grid[row][col] === 1;
    const disabled = gameOver || (player === 'p1' ? !canP1Tap(row) : player === 'p2' ? !canP2Tap(row) : false);
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
  const p1ZoneStyle = useMemo(() => ({ backgroundColor: p1BgColor }), [p1BgColor]);
  const p2ZoneStyle = useMemo(() => ({ backgroundColor: p2BgColor }), [p2BgColor]);

  const turnName = activeTurn === 'p1' ? p1Name : p2Name;

  return (
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Time bar */}
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

      {/* Help button */}
      <View style={styles.helpRow}>
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* P1 Zone */}
      <View style={[styles.zone, p1ZoneStyle]}>
        {renderZoneRows(P1_ROWS, 'p1')}
      </View>

      {/* Turn indicator */}
      <View style={styles.turnBanner}>
        <Text style={styles.turnBannerText}>{turnName}&apos;s Turn</Text>
      </View>

      {/* CoopDivider with shared row + move counter */}
      <CoopDivider
        p1Name={p1Name}
        p1Clan={p1Clan}
        p2Name={p2Name}
        p2Clan={p2Clan}
        timeLeft={timeLeft}
        totalTime={PIPS_TIME_LIMIT}
      >
        {renderSharedRow()}
        <Text style={[styles.movesText, isMovesLow && styles.textDanger]}>
          Moves: {movesUsed} / {moveLimit}
        </Text>
      </CoopDivider>

      {/* P2 Zone */}
      <View style={[styles.zone, p2ZoneStyle]}>
        {renderZoneRows(P2_ROWS, 'p2')}
      </View>

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          onContinue={handleContinue}
          loseTitle={loseReasonRef.current}
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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Snuff Out Co-op</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} A grid of lit and dark cells is shown on a shared board.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tapping a cell toggles it and its neighbours. Turn all cells to the target state.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Players alternate turns {'\u2014'} Player 1 taps first, then Player 2, then Player 1, and so on.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Plan your taps together {'\u2014'} every tap affects your partner{'\u2019'}s next turn too.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Solve the grid before time runs out to win together.
            </Text>
            <Text style={styles.modalTip}>
              Tip: Talk through your next move before tapping {'\u2014'} a single misplaced tap can make the board much harder to solve.
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

  timerBarContainer: {
    width: '90%',
    height: 14,
    backgroundColor: PALETTE.parchmentDark,
    borderRadius: 7,
    overflow: 'hidden',
    marginTop: 8,
    alignSelf: 'center',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 7,
  },

  helpRow: {
    width: '100%',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 2,
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
    borderColor: PALETTE.tileOnBorder,
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

  turnBanner: {
    alignSelf: 'center',
    backgroundColor: PALETTE.honeyGold,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 8,
    marginVertical: 2,
  },
  turnBannerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.darkBrown,
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
