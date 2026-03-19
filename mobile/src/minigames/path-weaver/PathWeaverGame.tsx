import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Pressable,
} from 'react-native';
import {
  Canvas,
  Rect as SkiaRect,
  Group,
  Line,
  vec,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import { IMAGE_GRIDS } from './image_grids';
import { checkWin, type PathWeaverConfig } from './PathWeaverLogic';

// ── Constants ──────────────────────────────────────────────────────────

const TIME_LIMIT = 150;
const GRID_PADDING = 16;
const FILLED_COLOR = '#3D2B1F';
const REVEALED_COLOR = '#7BA3C4';
const FLASH_COLOR = '#D4A843';
const EMPTY_COLOR = '#F5EACB';
const BORDER_COLOR = '#A0937D';
const X_COLOR = '#A0937D';
const FLASH_DURATION = 300;
const REVEAL_DURATION = 2000;
const HINT_LOCK_SECONDS = 60;
const HINT_FADE_MS = 400;
const HINT_LABEL_MS = 1500;
const VALIDATION_CORRECT_COLOR = '#27AE60';
const VALIDATION_INCORRECT_COLOR = '#C0392B';
const VALIDATION_FLASH_MS = 800;
const MAX_CELL_REVEALS = 2;

// Cell state: 0 = empty, 1 = filled, 2 = x-marked
type CellState = 0 | 1 | 2;
type LineValidation = 'correct' | 'incorrect' | 'idle';

// ── Component ──────────────────────────────────────────────────────────

export default function PathWeaverGame(props: MinigamePlayProps): React.JSX.Element {
  const { sessionId, timeLimit: propTimeLimit, onComplete, puzzleData } = props;
  const gameDuration = propTimeLimit > 0 ? propTimeLimit : TIME_LIMIT;

  // Parse config from puzzleData
  const config = puzzleData as unknown as PathWeaverConfig | undefined;
  const puzzleName = config?.name ?? '';
  const gridSize = config?.gridSize ?? 7;
  const rowClues = config?.rowClues ?? [];
  const colClues = config?.colClues ?? [];

  // Find solution by matching clues to IMAGE_GRIDS
  const solutionRef = useRef<number[][] | null>(null);
  if (solutionRef.current === null) {
    const match = IMAGE_GRIDS.find(
      (p) =>
        JSON.stringify(p.rowClues) === JSON.stringify(rowClues) &&
        JSON.stringify(p.colClues) === JSON.stringify(colClues),
    );
    solutionRef.current = match?.grid ?? null;
  }

  // ── State ────────────────────────────────────────────────────────────

  const [cells, setCells] = useState<CellState[][]>(() =>
    Array.from({ length: gridSize }, () => Array<CellState>(gridSize).fill(0)),
  );
  const [timeLeft, setTimeLeft] = useState(gameDuration);
  const [gameOver, setGameOver] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

  // Hint state
  const [hintsUnlocked, setHintsUnlocked] = useState(false);
  const [showHintLabel, setShowHintLabel] = useState(false);
  const hintAreaOpacity = useRef(new Animated.Value(0)).current;
  const hintLabelOpacity = useRef(new Animated.Value(0)).current;
  const hintsUnlockedRef = useRef(false);

  // Line validation state
  const [rowValidation, setRowValidation] = useState<LineValidation[]>(
    () => Array<LineValidation>(gridSize).fill('idle'),
  );
  const [colValidation, setColValidation] = useState<LineValidation[]>(
    () => Array<LineValidation>(gridSize).fill('idle'),
  );

  // Cell reveal state
  const [revealsRemaining, setRevealsRemaining] = useState(MAX_CELL_REVEALS);
  const [revealedCells, setRevealedCells] = useState<Set<string>>(() => new Set());
  const [revealMessage, setRevealMessage] = useState('');

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);

  // ── Timer ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, gameDuration - elapsed);
      setTimeLeft(remaining);

      // Unlock hints at 60 seconds elapsed
      if (elapsed >= HINT_LOCK_SECONDS && !hintsUnlockedRef.current) {
        hintsUnlockedRef.current = true;
        setHintsUnlocked(true);
        setShowHintLabel(true);

        // Fade in hint area
        Animated.timing(hintAreaOpacity, {
          toValue: 1,
          duration: HINT_FADE_MS,
          useNativeDriver: true,
        }).start();

        // "Hints unlocked" label: fade in, wait, fade out
        Animated.timing(hintLabelOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setTimeout(() => {
            Animated.timing(hintLabelOpacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => setShowHintLabel(false));
          }, HINT_LABEL_MS);
        });
      }

      if (remaining <= 0) {
        finishGame('timeout');
      }
    }, 200);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, gameDuration]);

  // ── Win sequence helper ──────────────────────────────────────────────

  const triggerWinSequence = useCallback(
    (binaryGrid: number[][]) => {
      completedRef.current = true;
      setGameOver(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, 'win', timeTaken);
      pendingResultRef.current = {
        result: 'win',
        timeTaken,
        completionHash,
        solutionData: { grid: binaryGrid },
      };

      // Step 1: gold flash (300ms)
      setFlashing(true);
      setTimeout(() => {
        setFlashing(false);
        // Step 2: reveal state (2000ms)
        setRevealing(true);
        setTimeout(() => {
          setRevealing(false);
          // Step 3: show overlay
          setOverlayResult('win');
          setShowCompleteOverlay(true);
        }, REVEAL_DURATION);
      }, FLASH_DURATION);
    },
    [sessionId],
  );

  // ── Finish helper (lose/timeout) ────────────────────────────────────

  const finishGame = useCallback(
    (outcome: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, outcome, timeTaken);
      const binaryGrid = cells.map((row) => row.map((c) => (c === 1 ? 1 : 0)));

      pendingResultRef.current = {
        result: outcome,
        timeTaken,
        completionHash,
        solutionData: { grid: binaryGrid },
      };

      setOverlayResult(outcome === 'win' ? 'win' : 'lose');
      setShowCompleteOverlay(true);
    },
    [sessionId, cells],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // ── Reset validation for affected lines ──────────────────────────────

  const resetLineValidation = useCallback(
    (row: number, col: number) => {
      setRowValidation((prev) => {
        if (prev[row] === 'idle') return prev;
        const next = [...prev];
        next[row] = 'idle';
        return next;
      });
      setColValidation((prev) => {
        if (prev[col] === 'idle') return prev;
        const next = [...prev];
        next[col] = 'idle';
        return next;
      });
    },
    [],
  );

  // ── Cell toggle ──────────────────────────────────────────────────────

  const toggleCell = useCallback(
    (row: number, col: number, longPress: boolean) => {
      if (gameOver || completedRef.current || flashing || revealing) return;
      // Revealed cells are locked
      if (revealedCells.has(`${row},${col}`)) return;

      setCells((prev) => {
        const next = prev.map((r) => [...r]);
        if (longPress) {
          next[row][col] = next[row][col] === 2 ? 0 : 2;
        } else {
          next[row][col] = next[row][col] === 1 ? 0 : 1;
        }

        // Reset validation for this row and column
        resetLineValidation(row, col);

        // Check win after toggle
        if (solutionRef.current && !longPress) {
          const binaryGrid = next.map((r) => r.map((c) => (c === 1 ? 1 : 0)));
          if (checkWin(binaryGrid, solutionRef.current)) {
            triggerWinSequence(binaryGrid);
          }
        }

        return next;
      });
    },
    [gameOver, flashing, revealing, revealedCells, resetLineValidation, triggerWinSequence],
  );

  // ── Line validation handlers ─────────────────────────────────────────

  const handleRowCluePress = useCallback(
    (rowIdx: number) => {
      if (!hintsUnlocked || gameOver || !solutionRef.current) return;

      const currentRow = cells[rowIdx].map((c) => (c === 1 ? 1 : 0));
      const solutionRow = solutionRef.current[rowIdx];
      const isCorrect = currentRow.every((v, i) => v === solutionRow[i]);

      setRowValidation((prev) => {
        const next = [...prev];
        next[rowIdx] = isCorrect ? 'correct' : 'incorrect';
        return next;
      });

      if (!isCorrect) {
        setTimeout(() => {
          setRowValidation((prev) => {
            if (prev[rowIdx] !== 'incorrect') return prev;
            const next = [...prev];
            next[rowIdx] = 'idle';
            return next;
          });
        }, VALIDATION_FLASH_MS);
      }
    },
    [hintsUnlocked, gameOver, cells],
  );

  const handleColCluePress = useCallback(
    (colIdx: number) => {
      if (!hintsUnlocked || gameOver || !solutionRef.current) return;

      const solution = solutionRef.current;
      const isCorrect = solution.every((row, r) => {
        const current = cells[r][colIdx] === 1 ? 1 : 0;
        return current === row[colIdx];
      });

      setColValidation((prev) => {
        const next = [...prev];
        next[colIdx] = isCorrect ? 'correct' : 'incorrect';
        return next;
      });

      if (!isCorrect) {
        setTimeout(() => {
          setColValidation((prev) => {
            if (prev[colIdx] !== 'incorrect') return prev;
            const next = [...prev];
            next[colIdx] = 'idle';
            return next;
          });
        }, VALIDATION_FLASH_MS);
      }
    },
    [hintsUnlocked, gameOver, cells],
  );

  // ── Cell reveal handler ──────────────────────────────────────────────

  const handleCellReveal = useCallback(() => {
    if (revealsRemaining <= 0 || gameOver || !solutionRef.current) return;

    // Find candidates: solution is 1, current is not 1
    const candidates: Array<{ r: number; c: number }> = [];
    const solution = solutionRef.current;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (solution[r][c] === 1 && cells[r][c] !== 1) {
          candidates.push({ r, c });
        }
      }
    }

    if (candidates.length === 0) {
      setRevealMessage('Nothing left to reveal');
      setTimeout(() => setRevealMessage(''), 1000);
      return;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const key = `${chosen.r},${chosen.c}`;

    // Update cells
    setCells((prev) => {
      const next = prev.map((row) => [...row]);
      next[chosen.r][chosen.c] = 1;

      // Reset validation for affected lines
      resetLineValidation(chosen.r, chosen.c);

      // Check win after reveal
      if (solutionRef.current) {
        const binaryGrid = next.map((row) => row.map((c) => (c === 1 ? 1 : 0)));
        if (checkWin(binaryGrid, solutionRef.current)) {
          triggerWinSequence(binaryGrid);
        }
      }

      return next;
    });

    setRevealedCells((prev) => new Set(prev).add(key));
    setRevealsRemaining((prev) => prev - 1);
  }, [revealsRemaining, gameOver, gridSize, cells, resetLineValidation, triggerWinSequence]);

  // ── Layout calculations ──────────────────────────────────────────────

  const screenW = Dimensions.get('window').width;

  const maxRowClueCount = Math.max(...rowClues.map((c) => c.length), 1);
  const maxColClueCount = Math.max(...colClues.map((c) => c.length), 1);
  const rowClueAreaW = maxRowClueCount * 16 + 8;
  const colClueAreaH = maxColClueCount * 16 + 8;

  const availableW = screenW - GRID_PADDING * 2 - rowClueAreaW;
  const cellSize = Math.floor(availableW / gridSize);
  const gridW = cellSize * gridSize;
  const gridH = cellSize * gridSize;

  const canvasW = rowClueAreaW + gridW;
  const canvasH = colClueAreaH + gridH;

  // ── Gesture handling ─────────────────────────────────────────────────

  const handleTap = useCallback(
    (x: number, y: number) => {
      const col = Math.floor((x - rowClueAreaW) / cellSize);
      const row = Math.floor((y - colClueAreaH) / cellSize);
      if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
        toggleCell(row, col, false);
      }
    },
    [rowClueAreaW, colClueAreaH, cellSize, gridSize, toggleCell],
  );

  const handleLongPress = useCallback(
    (x: number, y: number) => {
      const col = Math.floor((x - rowClueAreaW) / cellSize);
      const row = Math.floor((y - colClueAreaH) / cellSize);
      if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
        toggleCell(row, col, true);
      }
    },
    [rowClueAreaW, colClueAreaH, cellSize, gridSize, toggleCell],
  );

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      'worklet';
      runOnJS(handleTap)(e.x, e.y);
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart((e) => {
      'worklet';
      runOnJS(handleLongPress)(e.x, e.y);
    });

  const composedGesture = Gesture.Exclusive(longPressGesture, tapGesture);

  // ── Clue color helpers ───────────────────────────────────────────────

  const getClueColor = useCallback(
    (validation: LineValidation): string => {
      if (validation === 'correct') return VALIDATION_CORRECT_COLOR;
      if (validation === 'incorrect') return VALIDATION_INCORRECT_COLOR;
      return PALETTE.stoneGrey;
    },
    [],
  );

  // ── Timer bar ────────────────────────────────────────────────────────

  const timerFraction = timeLeft / gameDuration;

  // ── Cell fill color ──────────────────────────────────────────────────

  const getCellFillColor = useCallback(
    (rowIdx: number, colIdx: number, cell: CellState): string => {
      if (cell !== 1) return EMPTY_COLOR;
      if (flashing || revealing) return FLASH_COLOR;
      if (revealedCells.has(`${rowIdx},${colIdx}`)) return REVEALED_COLOR;
      return FILLED_COLOR;
    },
    [flashing, revealing, revealedCells],
  );

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Path Weaver</Text>
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
      </View>

      {/* Grid + Clues */}
      <View style={styles.gridWrapper}>
        <GestureDetector gesture={composedGesture}>
          <Canvas style={{ width: canvasW, height: canvasH }}>
            {/* Grid cells */}
            {cells.map((row, rowIdx) =>
              row.map((cell, colIdx) => {
                const x = rowClueAreaW + colIdx * cellSize;
                const y = colClueAreaH + rowIdx * cellSize;
                const isXMarked = cell === 2;

                const fillColor = getCellFillColor(rowIdx, colIdx, cell);

                return (
                  <Group key={`cell-${rowIdx}-${colIdx}`}>
                    <SkiaRect
                      x={x + 0.5}
                      y={y + 0.5}
                      width={cellSize - 1}
                      height={cellSize - 1}
                      color={fillColor}
                    />
                    <SkiaRect
                      x={x}
                      y={y}
                      width={cellSize}
                      height={cellSize}
                      color={BORDER_COLOR}
                      style="stroke"
                      strokeWidth={0.5}
                    />
                    {isXMarked && (
                      <>
                        <Line
                          p1={vec(x + cellSize * 0.25, y + cellSize * 0.25)}
                          p2={vec(x + cellSize * 0.75, y + cellSize * 0.75)}
                          color={X_COLOR}
                          strokeWidth={1.5}
                        />
                        <Line
                          p1={vec(x + cellSize * 0.75, y + cellSize * 0.25)}
                          p2={vec(x + cellSize * 0.25, y + cellSize * 0.75)}
                          color={X_COLOR}
                          strokeWidth={1.5}
                        />
                      </>
                    )}
                  </Group>
                );
              }),
            )}
          </Canvas>
        </GestureDetector>

        {/* Column clue overlay */}
        <View
          style={[
            styles.colClueOverlay,
            {
              left: rowClueAreaW,
              width: gridW,
              height: colClueAreaH,
            },
          ]}
          pointerEvents={hintsUnlocked && !gameOver ? 'auto' : 'none'}
        >
          {colClues.map((clues, colIdx) => {
            const validation = colValidation[colIdx];
            const color = getClueColor(validation);
            return (
              <Pressable
                key={`col-text-${colIdx}`}
                onPress={() => handleColCluePress(colIdx)}
                style={[
                  styles.colClueCell,
                  { width: cellSize, height: colClueAreaH },
                  hintsUnlocked && !gameOver && styles.clueTappable,
                ]}
              >
                <View style={styles.colClueInner}>
                  {clues.map((num, i) => (
                    <Text key={i} style={[styles.clueNumber, { color }]}>
                      {num}
                    </Text>
                  ))}
                  {validation === 'correct' && (
                    <Text style={styles.clueCheck}>✓</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Row clue overlay */}
        <View
          style={[
            styles.rowClueOverlay,
            {
              top: colClueAreaH,
              width: rowClueAreaW,
              height: gridH,
            },
          ]}
          pointerEvents={hintsUnlocked && !gameOver ? 'auto' : 'none'}
        >
          {rowClues.map((clues, rowIdx) => {
            const validation = rowValidation[rowIdx];
            const color = getClueColor(validation);
            return (
              <Pressable
                key={`row-text-${rowIdx}`}
                onPress={() => handleRowCluePress(rowIdx)}
                style={[
                  styles.rowClueCell,
                  { height: cellSize, width: rowClueAreaW },
                  hintsUnlocked && !gameOver && styles.clueTappable,
                ]}
              >
                <View style={styles.rowClueInner}>
                  <Text style={[styles.clueNumber, { color }]}>
                    {clues.join(' ')}
                  </Text>
                  {validation === 'correct' && (
                    <Text style={styles.clueCheck}>✓</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Hint area (fades in after 60s) */}
      {hintsUnlocked && !revealing && !showCompleteOverlay && (
        <Animated.View style={[styles.hintArea, { opacity: hintAreaOpacity }]}>
          {/* "Hints unlocked" label */}
          {showHintLabel && (
            <Animated.Text style={[styles.hintUnlockedLabel, { opacity: hintLabelOpacity }]}>
              Hints unlocked
            </Animated.Text>
          )}

          {/* Reveal button */}
          <Pressable
            onPress={handleCellReveal}
            disabled={revealsRemaining <= 0 || gameOver}
            style={[
              styles.revealBtn,
              (revealsRemaining <= 0 || gameOver) && styles.revealBtnDisabled,
            ]}
          >
            <Text
              style={[
                styles.revealBtnText,
                (revealsRemaining <= 0 || gameOver) && styles.revealBtnTextDisabled,
              ]}
            >
              {revealsRemaining > 0
                ? `Reveal a cell  (${revealsRemaining} remaining)`
                : 'No reveals left'}
            </Text>
          </Pressable>

          {/* Reveal feedback message */}
          {revealMessage !== '' && (
            <Text style={styles.revealFeedback}>{revealMessage}</Text>
          )}
        </Animated.View>
      )}

      {/* Reveal text (post-win) */}
      {revealing && (
        <View style={styles.revealContainer}>
          <Text style={styles.revealName}>
            {puzzleName.charAt(0).toUpperCase() + puzzleName.slice(1)}
          </Text>
          <Text style={styles.revealSubtitle}>Puzzle complete!</Text>
        </View>
      )}

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

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
    alignItems: 'center',
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: GRID_PADDING,
    marginBottom: 12,
    gap: 10,
  },
  title: {
    fontFamily: FONTS.headerBold,
    fontSize: 22,
    color: PALETTE.darkBrown,
  },
  timerBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: PALETTE.stoneGrey,
    borderRadius: 4,
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI.text,
    minWidth: 36,
    textAlign: 'right',
  },
  gridWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  colClueOverlay: {
    position: 'absolute',
    top: 0,
    flexDirection: 'row',
  },
  colClueCell: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  colClueInner: {
    alignItems: 'center',
  },
  rowClueOverlay: {
    position: 'absolute',
    left: 0,
  },
  rowClueCell: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  rowClueInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  clueTappable: {
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.stoneGrey + '40',
  },
  clueNumber: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: PALETTE.stoneGrey,
    lineHeight: 14,
  },
  clueCheck: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: '#27AE60',
    marginLeft: 1,
  },

  // ── Hint area ──
  hintArea: {
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  hintUnlockedLabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: PALETTE.stoneGrey,
  },
  revealBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: UI.border,
    backgroundColor: 'transparent',
  },
  revealBtnDisabled: {
    opacity: 0.4,
  },
  revealBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: UI.text,
  },
  revealBtnTextDisabled: {
    color: PALETTE.stoneGrey,
  },
  revealFeedback: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: PALETTE.stoneGrey,
  },

  // ── Post-win reveal ──
  revealContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  revealName: {
    fontFamily: FONTS.headerBold,
    fontSize: 22,
    color: PALETTE.honeyGold,
  },
  revealSubtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: PALETTE.stoneGrey,
    marginTop: 2,
  },
});
