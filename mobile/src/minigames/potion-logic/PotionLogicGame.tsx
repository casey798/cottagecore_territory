/**
 * Potion Logic - Logic deduction minigame (portrait mode).
 * 3 potions, 3 ingredients, 3 effects. Use clues to deduce all assignments.
 * Features an auto-marking cascade system for satisfying grid-fill UX.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import {
  generatePuzzle,
  validateSubmission,
  extractAssignments,
  countConfirmations,
  computeGridState,
  emptyManualMarks,
  isGridComplete,
  isValidGridState,
  POTIONS,
  INGREDIENTS,
  EFFECTS,
  type CellState,
  type GridId,
  type Puzzle,
  type Potion,
  type Ingredient,
  type Effect,
  type ManualMarks,
  type CellOrigin,
  type ComputedGridState,
} from './PotionLogicLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';

// ── Constants ────────────────────────────────────────────────────────

const POTION_DISPLAY: Record<Potion, { color: string; label: string }> = {
  red: { color: '#C0392B', label: 'Red' },
  blue: { color: '#2980B9', label: 'Blue' },
  green: { color: '#27AE60', label: 'Green' },
};

const INGREDIENT_LABELS: Record<Ingredient, string> = {
  herb: '\u{1F33F}Herb',
  crystal: '\u{1F48E}Crys',
  mushroom: '\u{1F344}Mush',
};

const EFFECT_LABELS: Record<Effect, string> = {
  healing: '\u{1F49A}Heal',
  speed: '\u26A1Spd',
  shield: '\u{1F6E1}Shld',
};

function cellBg(origin: CellOrigin, state: CellState): string {
  if (state === 'empty') return PALETTE.cream;
  if (origin === 'auto_eliminated') return '#EAE4DA';
  if (origin === 'manual_eliminated') return '#E0D8CC';
  if (origin === 'auto_confirmed') return '#C4E0B0';
  if (origin === 'manual_confirmed') return '#B8D9A0';
  return PALETTE.cream;
}

function cellSymbol(state: CellState): string {
  if (state === 'confirmed') return '\u2713';
  if (state === 'eliminated') return '\u2717';
  return '';
}

// ── Component ────────────────────────────────────────────────────────

export default function PotionLogicGame(props: MinigamePlayProps): React.JSX.Element {
  const { sessionId, timeLimit, onComplete } = props;

  const puzzleRef = useRef<Puzzle | null>(null);
  if (puzzleRef.current === null) {
    puzzleRef.current = generatePuzzle();
  }
  const puzzle = puzzleRef.current;
  const gameDuration = timeLimit > 0 ? timeLimit : 120;

  // ── State ──────────────────────────────────────────────────────────

  const [manualMarks, setManualMarks] = useState<ManualMarks>(emptyManualMarks);
  const [highlightedClue, setHighlightedClue] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [wrongFlash, setWrongFlash] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [timeLeft, setTimeLeft] = useState(gameDuration);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingCompleteRef = useRef<MinigameResult | null>(null);

  // ── Derived grid state (recomputed from manual marks) ──────────────

  const computed = useMemo(() => computeGridState(manualMarks), [manualMarks]);
  const grid = computed.grid;
  const origins = computed.origins;

  // Keep a ref for finishGame to read without stale closure
  const computedRef = useRef<ComputedGridState>(computed);
  computedRef.current = computed;

  // ── Cell animations ────────────────────────────────────────────────

  const cellAnimRefs = useRef<Record<string, Animated.Value>>({});
  const prevOriginsRef = useRef<ComputedGridState['origins'] | null>(null);

  function getCellAnim(gridId: string, r: number, c: number): Animated.Value {
    const key = `${gridId}-${r}-${c}`;
    if (!cellAnimRefs.current[key]) {
      cellAnimRefs.current[key] = new Animated.Value(1);
    }
    return cellAnimRefs.current[key];
  }

  useEffect(() => {
    const prev = prevOriginsRef.current;
    prevOriginsRef.current = origins;
    if (!prev) return;

    const anims: Animated.CompositeAnimation[] = [];

    for (const gridId of ['ingredients', 'effects'] as const) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const prevO = prev[gridId][r][c];
          const newO = origins[gridId][r][c];
          if (prevO !== newO && (newO === 'auto_confirmed' || newO === 'auto_eliminated')) {
            const anim = getCellAnim(gridId, r, c);
            anim.setValue(0.85);
            anims.push(
              Animated.spring(anim, {
                toValue: 1,
                friction: 8,
                tension: 200,
                useNativeDriver: true,
              }),
            );
          }
        }
      }
    }

    if (anims.length > 0) {
      Animated.stagger(50, anims).start();
    }
  }, [origins]);

  // ── Timer ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, gameDuration - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
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
      setOverlayResult(outcome === 'win' ? 'win' : 'lose');
      setShowCompleteOverlay(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, outcome, timeTaken);

      const assignments = extractAssignments(computedRef.current.grid);
      pendingCompleteRef.current = {
        result: outcome,
        timeTaken,
        completionHash,
        solutionData: {
          playerIngredients: assignments.ingredients,
          playerEffects: assignments.effects,
          solved: outcome === 'win',
        },
      };
    },
    [sessionId],
  );

  const handleContinue = useCallback(() => {
    if (pendingCompleteRef.current) {
      onComplete(pendingCompleteRef.current);
      pendingCompleteRef.current = null;
    }
  }, [onComplete]);

  // ── Auto-win check (after every recompute) ─────────────────────────

  useEffect(() => {
    if (gameOver) return;
    if (!isGridComplete(grid)) return;

    const assignments = extractAssignments(grid);
    const correct = validateSubmission(
      assignments.ingredients as Record<Potion, Ingredient>,
      assignments.effects as Record<Potion, Effect>,
      puzzle.solution,
    );

    if (correct) {
      // Brief delay so the cascade animation finishes visually
      const timer = setTimeout(() => finishGame('win'), 350);
      return () => clearTimeout(timer);
    }
  }, [grid, gameOver, puzzle.solution, finishGame]);

  // ── Cell tap handler ───────────────────────────────────────────────

  const handleCellTap = useCallback(
    (gridType: GridId, row: number, col: number) => {
      if (gameOver) return;

      const origin = origins[gridType][row][col];

      // Auto-derived cells are locked
      if (origin === 'auto_eliminated' || origin === 'auto_confirmed') {
        setMessage('Auto-derived mark');
        setTimeout(() => setMessage(''), 1000);
        return;
      }

      setManualMarks(prev => {
        // empty → manual ✗
        if (origin === 'empty') {
          return {
            ...prev,
            eliminations: [...prev.eliminations, { grid: gridType, row, col }],
          };
        }

        // manual ✗ → try manual ✓
        if (origin === 'manual_eliminated') {
          const newElims = prev.eliminations.filter(
            e => !(e.grid === gridType && e.row === row && e.col === col),
          );
          const newConfirms = [...prev.confirms, { grid: gridType, row, col }];
          const testComputed = computeGridState({ confirms: newConfirms, eliminations: newElims });

          if (!isValidGridState(testComputed.grid[gridType])) {
            setMessage('Only one per row and column');
            setTimeout(() => setMessage(''), 1500);
            return prev;
          }

          return { confirms: newConfirms, eliminations: newElims };
        }

        // manual ✓ → empty
        if (origin === 'manual_confirmed') {
          return {
            ...prev,
            confirms: prev.confirms.filter(
              co => !(co.grid === gridType && co.row === row && co.col === col),
            ),
          };
        }

        return prev;
      });

      setMessage('');
    },
    [gameOver, origins],
  );

  // ── Submit handler (fallback if auto-win doesn't fire) ─────────────

  const handleSubmit = useCallback(() => {
    if (gameOver) return;

    const counts = countConfirmations(computedRef.current.grid);
    if (counts.ingredients !== 3 || counts.effects !== 3) return;

    const assignments = extractAssignments(computedRef.current.grid);
    const isCorrect = validateSubmission(
      assignments.ingredients as Record<Potion, Ingredient>,
      assignments.effects as Record<Potion, Effect>,
      puzzle.solution,
    );

    if (isCorrect) {
      finishGame('win');
    } else {
      setWrongFlash(true);
      setMessage('Not quite right... keep trying!');
      setTimeout(() => {
        setWrongFlash(false);
        setMessage('');
      }, 1200);
    }
  }, [gameOver, puzzle.solution, finishGame]);

  // ── Layout calculations ────────────────────────────────────────────

  const screenWidth = Dimensions.get('window').width;
  const gridPadH = 16;
  const labelColWidth = 40;
  const cellGap = 2;
  const availableForCells = screenWidth - gridPadH * 2 - labelColWidth - cellGap * 2;
  const cellSize = Math.min(Math.floor(availableForCells / 3), 54);

  const counts = countConfirmations(grid);
  const canSubmit = counts.ingredients === 3 && counts.effects === 3;

  const timerFraction = timeLeft / gameDuration;

  // ── Render helpers ─────────────────────────────────────────────────

  const renderGrid = (
    gridType: GridId,
    colLabels: string[],
    title: string,
  ) => {
    const gridData = grid[gridType];
    const gridOrigins = origins[gridType];

    return (
      <View style={styles.gridSection}>
        <Text style={styles.gridTitle}>{title}</Text>
        {/* Column headers */}
        <View style={styles.gridHeaderRow}>
          <View style={{ width: labelColWidth }} />
          {colLabels.map((label, c) => (
            <View key={c} style={[styles.colHeader, { width: cellSize }]}>
              <Text style={styles.colHeaderText} numberOfLines={1} adjustsFontSizeToFit>
                {label}
              </Text>
            </View>
          ))}
        </View>
        {/* Grid rows */}
        {POTIONS.map((potion, r) => (
          <View key={potion} style={styles.gridRow}>
            {/* Row header — colored dot */}
            <View style={[styles.rowHeader, { width: labelColWidth }]}>
              <View style={[styles.potionDot, { backgroundColor: POTION_DISPLAY[potion].color }]} />
            </View>
            {/* Cells */}
            {[0, 1, 2].map(c => {
              const state = gridData[r][c];
              const origin = gridOrigins[r][c];
              const isAuto = origin === 'auto_confirmed' || origin === 'auto_eliminated';
              const anim = getCellAnim(gridType, r, c);

              const bg = wrongFlash && state === 'confirmed'
                ? PALETTE.mutedRose
                : cellBg(origin, state);

              return (
                <Animated.View
                  key={c}
                  style={{ transform: [{ scale: anim }] }}
                >
                  <TouchableOpacity
                    style={[
                      styles.cell,
                      {
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: bg,
                      },
                      isAuto && styles.cellAuto,
                    ]}
                    onPress={() => handleCellTap(gridType, r, c)}
                    disabled={gameOver}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.cellSymbol,
                      state === 'confirmed' && (isAuto ? styles.cellSymbolAutoConfirmed : styles.cellSymbolConfirmed),
                      state === 'eliminated' && (isAuto ? styles.cellSymbolAutoEliminated : styles.cellSymbolEliminated),
                    ]}>
                      {cellSymbol(state)}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────

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

      {/* Clue panel */}
      <View style={styles.cluePanel}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.clueScrollContent}
        >
          {puzzle.clues.map((clue, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.clueCard,
                highlightedClue === i && styles.clueCardHighlighted,
                highlightedClue !== null && highlightedClue !== i && styles.clueCardDimmed,
              ]}
              onPress={() => setHighlightedClue(prev => prev === i ? null : i)}
              activeOpacity={0.8}
            >
              <Text style={styles.clueNumber}>{i + 1}.</Text>
              <Text style={styles.clueText}>{clue.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Potion bottles strip */}
      <View style={styles.potionStrip}>
        {POTIONS.map(p => (
          <View key={p} style={styles.potionBottle}>
            <View style={[styles.bottleBody, { backgroundColor: POTION_DISPLAY[p].color }]}>
              <View style={styles.bottleNeck} />
            </View>
            <Text style={styles.potionLabel}>{POTION_DISPLAY[p].label}</Text>
          </View>
        ))}
      </View>

      {/* Message */}
      {message !== '' && <Text style={styles.message}>{message}</Text>}

      {/* Logic grids */}
      <ScrollView
        style={styles.gridsScroll}
        contentContainerStyle={styles.gridsContent}
        showsVerticalScrollIndicator={false}
      >
        {renderGrid(
          'ingredients',
          INGREDIENTS.map(i => INGREDIENT_LABELS[i]),
          'Ingredients',
        )}
        {renderGrid(
          'effects',
          EFFECTS.map(e => EFFECT_LABELS[e]),
          'Effects',
        )}
      </ScrollView>

      {/* Submit button — hidden once game ends */}
      {!gameOver && (
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.7}
        >
          <Text style={[styles.submitBtnText, !canSubmit && styles.submitBtnTextDisabled]}>
            Submit Answer
          </Text>
        </TouchableOpacity>
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

// ── Styles ───────────────────────────────────────────────────────────

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
    marginBottom: 4,
  },

  // Clue panel
  cluePanel: {
    width: '100%',
    maxHeight: '28%',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  clueScrollContent: {
    gap: 4,
    paddingBottom: 4,
  },
  clueCard: {
    flexDirection: 'row',
    backgroundColor: PALETTE.cream,
    borderWidth: 1,
    borderColor: PALETTE.warmBrown + '60',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'flex-start',
  },
  clueCardHighlighted: {
    borderColor: PALETTE.honeyGold,
    borderWidth: 2,
    backgroundColor: '#FFF8E7',
  },
  clueCardDimmed: {
    opacity: 0.5,
  },
  clueNumber: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: PALETTE.warmBrown,
    marginRight: 6,
    minWidth: 18,
  },
  clueText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: PALETTE.darkBrown,
    flex: 1,
    lineHeight: 18,
  },

  // Potion bottles strip
  potionStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 6,
  },
  potionBottle: {
    alignItems: 'center',
  },
  bottleBody: {
    width: 28,
    height: 34,
    borderRadius: 8,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: 'center',
  },
  bottleNeck: {
    width: 12,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginTop: -4,
  },
  potionLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: PALETTE.darkBrown,
    marginTop: 2,
  },

  // Message
  message: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.mutedRose,
    marginBottom: 2,
    height: 18,
  },

  // Grids
  gridsScroll: {
    flex: 1,
    width: '100%',
  },
  gridsContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  gridSection: {
    alignItems: 'center',
  },
  gridTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 18,
    color: PALETTE.darkBrown,
    marginBottom: 4,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 2,
    gap: 2,
  },
  colHeader: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  colHeaderText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    color: PALETTE.darkBrown,
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 2,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  potionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  cell: {
    borderWidth: 1,
    borderColor: PALETTE.warmBrown + '80',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellAuto: {
    borderStyle: 'dashed',
  },
  cellSymbol: {
    fontSize: 20,
    fontFamily: FONTS.bodyBold,
  },
  cellSymbolConfirmed: {
    color: PALETTE.deepGreen,
  },
  cellSymbolAutoConfirmed: {
    color: PALETTE.softGreen,
  },
  cellSymbolEliminated: {
    color: PALETTE.stoneGrey,
  },
  cellSymbolAutoEliminated: {
    color: PALETTE.stoneGrey,
    opacity: 0.45,
  },

  // Submit
  submitBtn: {
    backgroundColor: PALETTE.honeyGold,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#A0784C',
    minWidth: 180,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: PALETTE.stoneGrey + '60',
    borderBottomColor: PALETTE.stoneGrey + '40',
  },
  submitBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: PALETTE.darkBrown,
  },
  submitBtnTextDisabled: {
    color: PALETTE.stoneGrey,
  },
});
