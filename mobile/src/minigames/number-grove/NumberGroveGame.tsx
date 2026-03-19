/**
 * Number Grove — 6×6 Sudoku minigame component (portrait mode).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
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

const COLORS = {
  cellBg: '#F5EACB',
  givenCellBg: '#E8D9B0',
  selectedFill: '#D4A84359',       // #D4A843 at 35% opacity
  selectedBorder: '#D4A843',
  sameDigitTint: '#D4A84326',      // #D4A843 at 15% opacity
  thinBorder: '#8B6914',
  thickBorder: '#3D2B1F',
  givenDigit: '#3D2B1F',
  playerDigit: '#2980B9',
  conflictDot: '#E74C3C',
  completedFlash: '#27AE6033',
  padDisabledText: '#A0937D',
  padDisabledBg: '#D6CAAD',
  padBg: '#E8D9B0',
  padBorder: '#8B6914',
  padSelectedBorder: '#D4A843',
  eraseBg: '#D6CAAD',
} as const;

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

// ── Component ────────────────────────────────────────────────────────

export default function NumberGroveGame(props: MinigamePlayProps): React.JSX.Element {
  const { sessionId, timeLimit, onComplete } = props;

  // Generate puzzle on mount
  const puzzleRef = useRef<NumberGrovePuzzle | null>(null);
  if (puzzleRef.current === null) {
    puzzleRef.current = generatePuzzle();
  }
  const puzzle = puzzleRef.current;
  const gameDuration = timeLimit > 0 ? timeLimit : puzzle.timeLimit;

  // Fixed cells (given cells from the puzzle)
  const fixedRef = useRef<Set<string>>(new Set());
  if (fixedRef.current.size === 0) {
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (puzzle.puzzle[r][c] !== 0) {
          fixedRef.current.add(`${r},${c}`);
        }
      }
    }
  }
  const fixedCells = fixedRef.current;

  // ── State ──────────────────────────────────────────────────────────

  const [board, setBoard] = useState<number[][]>(() =>
    puzzle.puzzle.map((row) => [...row]),
  );
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [selectedDigit, setSelectedDigit] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<Set<string>>(() => new Set());
  const [flashCells, setFlashCells] = useState<Set<string>>(() => new Set());
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [timeLeft, setTimeLeft] = useState(gameDuration);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const flashAnim = useRef(new Animated.Value(1)).current;

  // ── Timer ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
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

  // ── Finish helper ──────────────────────────────────────────────────

  const finishGame = useCallback(
    (outcome: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current) return;
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
        setTimeout(() => {
          setOverlayResult('lose');
          setShowCompleteOverlay(true);
        }, 800);
      } else {
        setOverlayResult(outcome === 'win' ? 'win' : 'lose');
        setShowCompleteOverlay(true);
      }
    },
    [sessionId, puzzle.solution],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

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
      if (gameOver || !selectedCell) return;
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
    [gameOver, selectedCell, fixedCells, board, puzzle.solution, finishGame, checkCompletions],
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

  const timerFraction = timeLeft / gameDuration;

  // Determine which digit the selected cell holds (for same-digit highlight)
  const highlightDigit =
    selectedCell && board[selectedCell.r][selectedCell.c] !== 0
      ? board[selectedCell.r][selectedCell.c]
      : selectedDigit;

  return (
    <View style={styles.container}>
      {/* Timer bar */}
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
      <Text style={styles.timerText}>{Math.ceil(timeLeft)}s</Text>

      {/* Title */}
      <Text style={styles.title}>Number Grove</Text>

      {/* Grid */}
      <View style={[styles.gridOuter, { width: GRID_WIDTH, height: GRID_WIDTH }]}>
        {Array.from({ length: GRID_SIZE }, (_, r) =>
          Array.from({ length: GRID_SIZE }, (__, c) => {
            const key = `${r},${c}`;
            const isFixed = fixedCells.has(key);
            const value = board[r][c];
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
              c === 2 ? COLORS.thickBorder : COLORS.thinBorder;
            const borderBottomColor =
              r === 1 || r === 3 ? COLORS.thickBorder : COLORS.thinBorder;

            // Layer order: cell bg → selected/same-digit tint → borders → digit → conflict dot
            const baseBg = isFixed ? COLORS.givenCellBg : COLORS.cellBg;
            const tintColor = isSelected
              ? COLORS.selectedFill
              : isSameDigit
                ? COLORS.sameDigitTint
                : isFlashing
                  ? COLORS.completedFlash
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
                        color: isFixed ? COLORS.givenDigit : COLORS.playerDigit,
                        fontFamily: isFixed ? FONTS.bodyBold : FONTS.bodyRegular,
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
                  disabled={gameOver}
                  style={[
                    styles.padBtn,
                    {
                      width: PAD_BTN_WIDTH,
                      height: PAD_BTN_HEIGHT,
                      backgroundColor: isDigitFull
                        ? COLORS.padDisabledBg
                        : COLORS.padBg,
                      borderColor: isSelectedPad
                        ? COLORS.padSelectedBorder
                        : COLORS.padBorder,
                      borderWidth: isSelectedPad ? 2.5 : 1.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.padDigit,
                      {
                        color: isDigitFull
                          ? COLORS.padDisabledText
                          : COLORS.givenDigit,
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
                  disabled={gameOver}
                  style={[
                    styles.padBtn,
                    {
                      width: PAD_BTN_WIDTH,
                      height: PAD_BTN_HEIGHT,
                      backgroundColor: isDigitFull
                        ? COLORS.padDisabledBg
                        : COLORS.padBg,
                      borderColor: isSelectedPad
                        ? COLORS.padSelectedBorder
                        : COLORS.padBorder,
                      borderWidth: isSelectedPad ? 2.5 : 1.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.padDigit,
                      {
                        color: isDigitFull
                          ? COLORS.padDisabledText
                          : COLORS.givenDigit,
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
          onContinue={handleContinue}
        />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
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
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.headerBold,
    fontSize: 28,
    color: UI.text,
    marginBottom: 8,
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
    borderColor: COLORS.thickBorder,
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
    borderColor: COLORS.selectedBorder,
  },
  cellDigit: {
    textAlign: 'center',
  },
  conflictDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: COLORS.conflictDot,
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
    fontFamily: FONTS.bodyBold,
    textAlign: 'center',
  },
  eraseBtn: {
    backgroundColor: COLORS.eraseBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.padBorder,
    marginTop: 2,
  },
  eraseBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: COLORS.givenDigit,
  },
});
