/**
 * Number Grove — 6×6 Sudoku minigame component (portrait mode).
 */
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
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { NUMBER_FILL_TIME_LIMIT } from '@/constants/config';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import {
  generatePuzzle,
  getConflicts,
  isComplete,
  type NumberGrovePuzzle,
} from './NumberGroveLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';

// ── Constants ────────────────────────────────────────────────────────

const GRID_SIZE = 6;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = Math.floor((SCREEN_WIDTH * 0.85) / GRID_SIZE);
const GRID_WIDTH = CELL_SIZE * GRID_SIZE;
const PAD_BTN_WIDTH = Math.floor((SCREEN_WIDTH * 0.85) / 3);
const PAD_BTN_HEIGHT = CELL_SIZE;

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

const FLASH_DURATION = 600;

// ── Helpers ──────────────────────────────────────────────────────────

/** Count how many times digit d appears on the board (non-zero). */
function digitCount(board: number[][], d: number): number {
  let count = 0;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (board[r][c] === d) count++;
    }
  }
  return count;
}

/** Check if a row is fully and correctly filled. */
function isRowComplete(board: number[][], row: number): boolean {
  const seen = new Set<number>();
  for (let c = 0; c < 6; c++) {
    const v = board[row][c];
    if (v === 0 || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

/** Check if a column is fully and correctly filled. */
function isColComplete(board: number[][], col: number): boolean {
  const seen = new Set<number>();
  for (let r = 0; r < 6; r++) {
    const v = board[r][col];
    if (v === 0 || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

/** Check if a box is fully and correctly filled. */
function isBoxComplete(board: number[][], br: number, bc: number): boolean {
  const seen = new Set<number>();
  for (let dr = 0; dr < 2; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      const v = board[br * 2 + dr][bc * 3 + dc];
      if (v === 0 || seen.has(v)) return false;
      seen.add(v);
    }
  }
  return true;
}

type PuzzleLoadState =
  | { status: 'loading' }
  | { status: 'ready'; puzzle: NumberGrovePuzzle }
  | { status: 'error' };

// ── Component ────────────────────────────────────────────────────────

export default function NumberGroveGame(props: MinigamePlayProps): React.JSX.Element {
  const { sessionId, timeLimit, onComplete, practiceMode } = props;

  const [puzzleState, setPuzzleState] = useState<PuzzleLoadState>({ status: 'loading' });
  const [board, setBoard] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [selectedDigit, setSelectedDigit] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<Set<string>>(() => new Set());
  const [flashCells, setFlashCells] = useState<Set<string>>(() => new Set());
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [timeLeft, setTimeLeft] = useState(NUMBER_FILL_TIME_LIMIT);
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

  const startTimeRef = useRef(0);
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const flashAnim = useRef(new Animated.Value(1)).current;
  const fixedRef = useRef<Set<string>>(new Set());
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Loading spinner animation
  const spinAnim = useRef(new Animated.Value(0)).current;

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
      setBoard(puzzle.puzzle.map((row) => [...row]));
      setGameOver(false);
      setShowCompleteOverlay(false);
      setTimeLeft(NUMBER_FILL_TIME_LIMIT);
      completedRef.current = false;
      const fixed = new Set<string>();
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if (puzzle.puzzle[r][c] !== 0) {
            fixed.add(`${r},${c}`);
          }
        }
      }
      fixedRef.current = fixed;
      startTimeRef.current = Date.now();
    } catch {
      setPuzzleState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  const puzzle = puzzleState.status === 'ready' ? puzzleState.puzzle : null;
  const fixedCells = fixedRef.current;
  const gameDuration = timeLimit > 0 ? timeLimit : (puzzle?.timeLimit ?? NUMBER_FILL_TIME_LIMIT);

  // ── Timer ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (puzzleState.status !== 'ready' || gameOver) return;

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
  }, [puzzleState.status, gameOver]);

  // Cleanup reveal timer on unmount
  useEffect(() => {
    return () => {
      if (revealTimerRef.current !== null) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, []);

  // ── Finish helper ──────────────────────────────────────────────────

  const finishGame = useCallback(
    (outcome: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current || !puzzle) return;
      completedRef.current = true;
      setGameOver(true);
      setSelectedCell(null);
      setSelectedDigit(null);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, outcome, timeTaken);

      pendingResultRef.current = {
        result: outcome,
        timeTaken,
        completionHash,
        solutionData: {
          solved: outcome === 'win',
        },
      };

      if (outcome === 'timeout') {
        // Show solution briefly before overlay
        setBoard(puzzle.solution.map((row) => [...row]));
        revealTimerRef.current = setTimeout(() => {
          revealTimerRef.current = null;
          setOverlayResult('lose');
          setShowCompleteOverlay(true);
        }, 800);
      } else {
        setOverlayResult(outcome === 'win' ? 'win' : 'lose');
        setShowCompleteOverlay(true);
      }
    },
    [sessionId, puzzle],
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

  // ── Flash animation for completed lines ────────────────────────────

  const triggerFlash = useCallback(
    (cells: Set<string>) => {
      if (cells.size === 0) return;
      setFlashCells(cells);
      flashAnim.setValue(1);
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: FLASH_DURATION,
        useNativeDriver: false,
      }).start(() => {
        setFlashCells(new Set());
      });
    },
    [flashAnim],
  );

  // ── Check for newly completed rows/cols/boxes ──────────────────────

  const checkCompletions = useCallback(
    (newBoard: number[][]) => {
      const cellsToFlash = new Set<string>();

      for (let r = 0; r < 6; r++) {
        if (isRowComplete(newBoard, r)) {
          for (let c = 0; c < 6; c++) cellsToFlash.add(`${r},${c}`);
        }
      }
      for (let c = 0; c < 6; c++) {
        if (isColComplete(newBoard, c)) {
          for (let r = 0; r < 6; r++) cellsToFlash.add(`${r},${c}`);
        }
      }
      for (let br = 0; br < 3; br++) {
        for (let bc = 0; bc < 2; bc++) {
          if (isBoxComplete(newBoard, br, bc)) {
            for (let dr = 0; dr < 2; dr++) {
              for (let dc = 0; dc < 3; dc++) {
                cellsToFlash.add(`${br * 2 + dr},${bc * 3 + dc}`);
              }
            }
          }
        }
      }

      triggerFlash(cellsToFlash);
    },
    [triggerFlash],
  );

  // ── Place digit ────────────────────────────────────────────────────

  const placeDigit = useCallback(
    (digit: number) => {
      if (gameOver || !selectedCell || !puzzle) return;
      const { r, c } = selectedCell;
      if (fixedCells.has(`${r},${c}`)) return;

      const newBoard = board.map((row) => [...row]);
      newBoard[r][c] = digit;
      setBoard(newBoard);
      setSelectedDigit(digit);

      const newConflicts = getConflicts(newBoard);
      setConflicts(newConflicts);

      // Check if puzzle is complete
      if (isComplete(newBoard, puzzle.solution)) {
        finishGame('win');
        return;
      }

      checkCompletions(newBoard);
    },
    [gameOver, selectedCell, fixedCells, board, puzzle, finishGame, checkCompletions],
  );

  // ── Erase ──────────────────────────────────────────────────────────

  const eraseCell = useCallback(() => {
    if (gameOver || !selectedCell) return;
    const { r, c } = selectedCell;
    if (fixedCells.has(`${r},${c}`)) return;
    if (board[r][c] === 0) return;

    const newBoard = board.map((row) => [...row]);
    newBoard[r][c] = 0;
    setBoard(newBoard);
    setSelectedDigit(null);

    const newConflicts = getConflicts(newBoard);
    setConflicts(newConflicts);
  }, [gameOver, selectedCell, fixedCells, board]);

  // ── Cell tap ───────────────────────────────────────────────────────

  const handleCellTap = useCallback(
    (r: number, c: number) => {
      if (gameOver) return;

      // Tap already-selected cell → deselect
      if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
        setSelectedCell(null);
        setSelectedDigit(null);
        return;
      }

      setSelectedCell({ r, c });
      const cellValue = board[r][c];
      setSelectedDigit(cellValue !== 0 ? cellValue : null);
    },
    [gameOver, selectedCell, board],
  );

  // ── Render ─────────────────────────────────────────────────────────

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

  const timerFraction = timeLeft / gameDuration;

  // Determine which digit the selected cell holds (for same-digit highlight)
  const highlightDigit =
    selectedCell && board[selectedCell.r]?.[selectedCell.c] !== 0
      ? board[selectedCell.r][selectedCell.c]
      : selectedDigit;

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
              backgroundColor:
                timerFraction > 0.25 ? PALETTE.softGreen : PALETTE.mutedRose,
            },
          ]}
        />
      </View>

      {/* Grid */}
      <View style={[styles.gridOuter, { width: GRID_WIDTH, height: GRID_WIDTH }]}>
        {Array.from({ length: GRID_SIZE }, (_, r) =>
          Array.from({ length: GRID_SIZE }, (__, c) => {
            const key = `${r},${c}`;
            const isFixed = fixedCells.has(key);
            const value = board[r]?.[c] ?? 0;
            const isSelected =
              selectedCell !== null && selectedCell.r === r && selectedCell.c === c;
            const hasConflict = conflicts.has(key);
            const isSameDigit =
              highlightDigit !== null &&
              highlightDigit !== 0 &&
              value === highlightDigit &&
              !isSelected;
            const isFlashing = flashCells.has(key);

            // Borders: thick between boxes
            const borderRightWidth = c === 2 ? 3 : c < 5 ? 1 : 0;
            const borderBottomWidth = r === 1 || r === 3 ? 3 : r < 5 ? 1 : 0;
            const borderRightColor =
              c === 2 ? PALETTE.darkBrown : PALETTE.warmBrown;
            const borderBottomColor =
              r === 1 || r === 3 ? PALETTE.darkBrown : PALETTE.warmBrown;

            // Layer order: cell bg → selected/same-digit tint → borders → digit → conflict dot
            const baseBg = isFixed ? PALETTE.parchmentMid : PALETTE.parchmentBg;
            const tintColor = isSelected
              ? 'rgba(212, 168, 67, 0.35)'
              : isSameDigit
                ? 'rgba(212, 168, 67, 0.15)'
                : isFlashing
                  ? 'rgba(39, 174, 96, 0.2)'
                  : null;

            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.7}
                onPress={() => handleCellTap(r, c)}
                disabled={gameOver}
                style={[
                  styles.cell,
                  {
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    left: c * CELL_SIZE,
                    top: r * CELL_SIZE,
                    backgroundColor: baseBg,
                    borderRightWidth,
                    borderBottomWidth,
                    borderRightColor,
                    borderBottomColor,
                  },
                ]}
              >
                {/* Tint overlay (selected / same-digit / flash) */}
                {tintColor !== null && (
                  <View
                    style={[
                      styles.tintOverlay,
                      { backgroundColor: tintColor },
                    ]}
                    pointerEvents="none"
                  />
                )}

                {/* Selected cell border — 3px inset */}
                {isSelected && (
                  <View style={styles.selectedBorder} pointerEvents="none" />
                )}

                {value !== 0 && (
                  <Text
                    style={[
                      styles.cellDigit,
                      {
                        color: isFixed ? PALETTE.darkBrown : PALETTE.playerBlue,
                        fontSize: CELL_SIZE * 0.5,
                      },
                    ]}
                  >
                    {value}
                  </Text>
                )}

                {/* Conflict indicator */}
                {hasConflict && value !== 0 && (
                  <View
                    style={[
                      styles.conflictDot,
                      {
                        width: CELL_SIZE * 0.2,
                        height: CELL_SIZE * 0.2,
                        borderRadius: CELL_SIZE * 0.1,
                      },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          }),
        )}

        {/* Outer border */}
        <View style={styles.gridBorder} pointerEvents="none" />
      </View>

      {/* Number pad */}
      {!showCompleteOverlay && (
        <View style={styles.padContainer}>
          {/* Row 1: 1-3 */}
          <View style={styles.padRow}>
            {[1, 2, 3].map((d) => {
              const isDigitFull = digitCount(board, d) >= 6;
              const isSelectedPad = selectedDigit === d;

              return (
                <TouchableOpacity
                  key={d}
                  activeOpacity={0.7}
                  onPress={() => placeDigit(d)}
                  disabled={gameOver || isDigitFull}
                  style={[
                    styles.padBtn,
                    {
                      width: PAD_BTN_WIDTH,
                      height: PAD_BTN_HEIGHT,
                      backgroundColor: isDigitFull
                        ? PALETTE.parchmentLight
                        : PALETTE.parchmentMid,
                      borderColor: isSelectedPad
                        ? PALETTE.honeyGold
                        : PALETTE.warmBrown,
                      borderWidth: isSelectedPad ? 2.5 : 1.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.padDigit,
                      {
                        color: isDigitFull
                          ? PALETTE.stoneGrey
                          : PALETTE.darkBrown,
                        fontSize: CELL_SIZE * 0.5,
                      },
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Row 2: 4-6 */}
          <View style={styles.padRow}>
            {[4, 5, 6].map((d) => {
              const isDigitFull = digitCount(board, d) >= 6;
              const isSelectedPad = selectedDigit === d;

              return (
                <TouchableOpacity
                  key={d}
                  activeOpacity={0.7}
                  onPress={() => placeDigit(d)}
                  disabled={gameOver || isDigitFull}
                  style={[
                    styles.padBtn,
                    {
                      width: PAD_BTN_WIDTH,
                      height: PAD_BTN_HEIGHT,
                      backgroundColor: isDigitFull
                        ? PALETTE.parchmentLight
                        : PALETTE.parchmentMid,
                      borderColor: isSelectedPad
                        ? PALETTE.honeyGold
                        : PALETTE.warmBrown,
                      borderWidth: isSelectedPad ? 2.5 : 1.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.padDigit,
                      {
                        color: isDigitFull
                          ? PALETTE.stoneGrey
                          : PALETTE.darkBrown,
                        fontSize: CELL_SIZE * 0.5,
                      },
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Erase button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={eraseCell}
            disabled={gameOver}
            style={[
              styles.eraseBtn,
              { width: GRID_WIDTH, height: PAD_BTN_HEIGHT * 0.7 },
            ]}
          >
            <Text style={styles.eraseBtnText}>Erase</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          xpEarned={overlayResult === 'win' ? 25 : 0}
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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Mini Sudoku</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} You have a 6{'\u00D7'}6 grid, partially filled with numbers.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Fill every empty cell so each row has 1 to 6, each column has 1 to 6, and each 2{'\u00D7'}3 box has 1 to 6.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} No number can repeat in a row, column, or box.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap a cell to select it, then tap a number below to fill it in.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap Erase to clear a cell you filled in. Given cells (darker) cannot be changed.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} The grid is complete when every cell is correctly filled.
            </Text>
            <Text style={styles.modalTip}>
              Tip: If a number appears 5 times in the grid, the missing cell in its row, column, or box is forced.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI.text,
    alignSelf: 'flex-start',
    marginLeft: '5%',
    marginBottom: 2,
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
  // Grid
  gridOuter: {
    position: 'relative',
  },
  gridBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: PALETTE.darkBrown,
    borderRadius: 2,
  },
  cell: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  tintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  selectedBorder: {
    position: 'absolute',
    top: 1.5,
    left: 1.5,
    right: 1.5,
    bottom: 1.5,
    borderWidth: 3,
    borderColor: PALETTE.honeyGold,
  },
  cellDigit: {
    textAlign: 'center',
  },
  conflictDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: PALETTE.errorRed,
  },

  // Number pad
  padContainer: {
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  padRow: {
    flexDirection: 'row',
    gap: 0,
  },
  padBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  padDigit: {
    textAlign: 'center',
  },
  eraseBtn: {
    backgroundColor: PALETTE.parchmentLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: PALETTE.warmBrown,
    marginTop: 2,
  },
  eraseBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: PALETTE.darkBrown,
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
