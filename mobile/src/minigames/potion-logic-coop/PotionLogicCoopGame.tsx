/**
 * Potion Logic Co-op — split-screen variant of Potion Logic.
 * P1 sees ONLY the clue list. P2 sees ONLY the deduction grid.
 * Players must verbally communicate to solve the puzzle together.
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
import { CLAN_COLORS, PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import type { ClanId } from '@/types';
import {
  generatePuzzle,
  validateSubmission,
  extractAssignments,
  countConfirmations,
  computeGridState,
  emptyManualMarks,
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
} from '../potion-logic/PotionLogicLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import { CoopDivider } from '@/components/minigames/CoopDivider';

// ── Display constants ──────────────────────────────────────────────

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

const POTION_NAMES: Record<string, Potion> = { Red: 'red', Blue: 'blue', Green: 'green' };
const INGREDIENT_NAMES: Record<string, Ingredient> = { Herb: 'herb', Crystal: 'crystal', Mushroom: 'mushroom' };
const EFFECT_NAMES: Record<string, Effect> = { Healing: 'healing', Speed: 'speed', Shield: 'shield' };

// ── Helpers ────────────────────────────────────────────────────────

function clanColor(clan: string): string {
  return CLAN_COLORS[clan as ClanId] ?? PALETTE.stoneGrey;
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + a;
}

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

/**
 * Parse a clue's text to find which potions, ingredients, and effects it references.
 * Returns indices for row/col highlighting in the grid.
 */
export function parseClueReferences(text: string): {
  potionRows: number[];
  ingredientCols: number[];
  effectCols: number[];
} {
  const potionRows: number[] = [];
  const ingredientCols: number[] = [];
  const effectCols: number[] = [];

  for (const [name, potion] of Object.entries(POTION_NAMES)) {
    if (text.includes(name)) {
      potionRows.push(POTIONS.indexOf(potion));
    }
  }
  for (const [name, ingredient] of Object.entries(INGREDIENT_NAMES)) {
    if (text.includes(name)) {
      ingredientCols.push(INGREDIENTS.indexOf(ingredient));
    }
  }
  for (const [name, effect] of Object.entries(EFFECT_NAMES)) {
    if (text.includes(name)) {
      effectCols.push(EFFECTS.indexOf(effect));
    }
  }

  return { potionRows, ingredientCols, effectCols };
}

// ── Component ──────────────────────────────────────────────────────

export default function PotionLogicCoopGame(props: MinigamePlayProps): React.JSX.Element {
  const { sessionId, timeLimit, onComplete, puzzleData } = props;

  const p1Name = (puzzleData?.p1Name as string) ?? 'Player 1';
  const p1Clan = (puzzleData?.p1Clan as string) ?? 'ember';
  const p2Name = (puzzleData?.p2Name as string) ?? 'Player 2';
  const p2Clan = (puzzleData?.p2Clan as string) ?? 'tide';

  const puzzleRef = useRef<Puzzle | null>(null);
  if (puzzleRef.current === null) {
    puzzleRef.current = generatePuzzle();
  }
  const puzzle = puzzleRef.current;
  const gameDuration = timeLimit > 0 ? timeLimit : 120;

  // ── State ────────────────────────────────────────────────────────

  const [manualMarks, setManualMarks] = useState<ManualMarks>(emptyManualMarks);
  const [highlightedClue, setHighlightedClue] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [timeLeft, setTimeLeft] = useState(gameDuration);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingCompleteRef = useRef<MinigameResult | null>(null);

  // ── Derived grid state ───────────────────────────────────────────

  const computed = useMemo(() => computeGridState(manualMarks), [manualMarks]);
  const grid = computed.grid;
  const origins = computed.origins;
  const computedRef = useRef<ComputedGridState>(computed);
  computedRef.current = computed;

  // ── Clue highlight references ────────────────────────────────────

  const clueRefs = useMemo(
    () => highlightedClue !== null
      ? parseClueReferences(puzzle.clues[highlightedClue].text)
      : null,
    [highlightedClue, puzzle.clues],
  );

  // ── Cell animations ──────────────────────────────────────────────

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

  // ── Timer ────────────────────────────────────────────────────────

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

  // ── Finish helper ────────────────────────────────────────────────

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
          manualMarks,
          solved: outcome === 'win',
        },
      };
    },
    [sessionId, manualMarks],
  );

  const handleContinue = useCallback(() => {
    if (pendingCompleteRef.current) {
      onComplete(pendingCompleteRef.current);
      pendingCompleteRef.current = null;
    }
  }, [onComplete]);

  // ── Auto-win check ──────────────────────────────────────────────

  useEffect(() => {
    if (gameOver) return;
    const counts = countConfirmations(grid);
    if (counts.ingredients !== 3 || counts.effects !== 3) return;

    const assignments = extractAssignments(grid);
    const correct = validateSubmission(
      assignments.ingredients as Record<Potion, Ingredient>,
      assignments.effects as Record<Potion, Effect>,
      puzzle.solution,
    );

    if (correct) {
      const timer = setTimeout(() => finishGame('win'), 350);
      return () => clearTimeout(timer);
    }
  }, [grid, gameOver, puzzle.solution, finishGame]);

  // ── Cell tap handler (P2 only) ──────────────────────────────────

  const handleCellTap = useCallback(
    (gridType: GridId, row: number, col: number) => {
      if (gameOver) return;

      const origin = origins[gridType][row][col];

      if (origin === 'auto_eliminated' || origin === 'auto_confirmed') {
        setMessage('Auto-derived mark');
        setTimeout(() => setMessage(null), 1000);
        return;
      }

      setManualMarks(prev => {
        if (origin === 'empty') {
          return {
            ...prev,
            eliminations: [...prev.eliminations, { grid: gridType, row, col }],
          };
        }

        if (origin === 'manual_eliminated') {
          const newElims = prev.eliminations.filter(
            e => !(e.grid === gridType && e.row === row && e.col === col),
          );
          const newConfirms = [...prev.confirms, { grid: gridType, row, col }];
          const testComputed = computeGridState({ confirms: newConfirms, eliminations: newElims });

          if (!isValidGridState(testComputed.grid[gridType])) {
            setMessage('Only one per row and column');
            setTimeout(() => setMessage(null), 1500);
            return prev;
          }

          return { confirms: newConfirms, eliminations: newElims };
        }

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

      setMessage(null);
    },
    [gameOver, origins],
  );

  // ── Submit handler ──────────────────────────────────────────────

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
      setMessage('Not quite \u2014 keep talking!');
      setTimeout(() => {
        setWrongFlash(false);
        setMessage(null);
      }, 1200);
    }
  }, [gameOver, puzzle.solution, finishGame]);

  // ── Layout calculations ──────────────────────────────────────────

  const screenWidth = Dimensions.get('window').width;
  const gridPadH = 16;
  const labelColWidth = 40;
  const cellGap = 2;
  const availableForCells = screenWidth - gridPadH * 2 - labelColWidth - cellGap * 2;
  const cellSize = Math.min(Math.floor(availableForCells / 3), 54);

  const counts = countConfirmations(grid);
  const canSubmit = counts.ingredients === 3 && counts.effects === 3;

  const p1BgColor = withAlpha(clanColor(p1Clan), 0.1);
  const p2BgColor = withAlpha(clanColor(p2Clan), 0.1);
  const p1HighlightColor = clanColor(p1Clan);

  // ── Render helpers ──────────────────────────────────────────────

  const isRowHighlighted = (gridType: GridId, row: number): boolean => {
    if (!clueRefs) return false;
    return clueRefs.potionRows.includes(row);
  };

  const isColHighlighted = (gridType: GridId, col: number): boolean => {
    if (!clueRefs) return false;
    if (gridType === 'ingredients') return clueRefs.ingredientCols.includes(col);
    return clueRefs.effectCols.includes(col);
  };

  const renderGrid = (
    gridType: GridId,
    colLabels: string[],
    title: string,
  ) => {
    const gridData = grid[gridType];
    const gridOrigins = origins[gridType];

    return (
      <View style={gridStyles.gridSection}>
        <Text style={gridStyles.gridTitle}>{title}</Text>
        {/* Column headers */}
        <View style={gridStyles.gridHeaderRow}>
          <View style={{ width: labelColWidth }} />
          {colLabels.map((label, c) => {
            const highlighted = isColHighlighted(gridType, c);
            return (
              <View
                key={c}
                style={[
                  gridStyles.colHeader,
                  { width: cellSize },
                  highlighted && { borderBottomWidth: 2, borderBottomColor: p1HighlightColor },
                ]}
              >
                <Text
                  style={[
                    gridStyles.colHeaderText,
                    highlighted && { color: p1HighlightColor, fontFamily: FONTS.bodyBold },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
        {/* Grid rows */}
        {POTIONS.map((potion, r) => {
          const rowHighlighted = isRowHighlighted(gridType, r);
          return (
            <View key={potion} style={gridStyles.gridRow}>
              {/* Row header — colored dot */}
              <View
                style={[
                  gridStyles.rowHeader,
                  { width: labelColWidth },
                  rowHighlighted && {
                    borderLeftWidth: 3,
                    borderLeftColor: p1HighlightColor,
                    borderRadius: 4,
                  },
                ]}
              >
                <View style={[gridStyles.potionDot, { backgroundColor: POTION_DISPLAY[potion].color }]} />
              </View>
              {/* Cells */}
              {[0, 1, 2].map(c => {
                const state = gridData[r][c];
                const origin = gridOrigins[r][c];
                const isAuto = origin === 'auto_confirmed' || origin === 'auto_eliminated';
                const anim = getCellAnim(gridType, r, c);
                const cellHighlighted = isRowHighlighted(gridType, r) && isColHighlighted(gridType, c);

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
                        gridStyles.cell,
                        {
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: bg,
                        },
                        isAuto && gridStyles.cellAuto,
                        cellHighlighted && {
                          borderColor: p1HighlightColor,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => handleCellTap(gridType, r, c)}
                      disabled={gameOver}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        gridStyles.cellSymbol,
                        state === 'confirmed' && (isAuto ? gridStyles.cellSymbolAutoConfirmed : gridStyles.cellSymbolConfirmed),
                        state === 'eliminated' && (isAuto ? gridStyles.cellSymbolAutoEliminated : gridStyles.cellSymbolEliminated),
                      ]}>
                        {cellSymbol(state)}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* P1 Zone — clue list only */}
      <View style={[styles.zone, { backgroundColor: p1BgColor }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.clueScrollContent}
          style={styles.clueScroll}
        >
          {puzzle.clues.map((clue, i) => {
            const isHighlighted = highlightedClue === i;
            const isDimmed = highlightedClue !== null && highlightedClue !== i;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.clueCard,
                  isHighlighted && [
                    styles.clueCardHighlighted,
                    { borderLeftColor: p1HighlightColor, borderLeftWidth: 4 },
                  ],
                  isDimmed && styles.clueCardDimmed,
                ]}
                onPress={() => setHighlightedClue(prev => prev === i ? null : i)}
                activeOpacity={0.8}
              >
                <Text style={styles.clueNumber}>{i + 1}.</Text>
                <Text style={styles.clueText}>{clue.text}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* CoopDivider with submit button */}
      <CoopDivider
        p1Name={p1Name}
        p1Clan={p1Clan}
        p2Name={p2Name}
        p2Clan={p2Clan}
        timeLeft={timeLeft}
        totalTime={gameDuration}
      >
        {message !== null && (
          <Text style={styles.message}>{message}</Text>
        )}
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
      </CoopDivider>

      {/* P2 Zone — grid only */}
      <View style={[styles.zone, { backgroundColor: p2BgColor }]}>
        {/* Potion bottles strip */}
        <View style={gridStyles.potionStrip}>
          {POTIONS.map(p => (
            <View key={p} style={gridStyles.potionBottle}>
              <View style={[gridStyles.bottleBody, { backgroundColor: POTION_DISPLAY[p].color }]}>
                <View style={gridStyles.bottleNeck} />
              </View>
              <Text style={gridStyles.potionLabel}>{POTION_DISPLAY[p].label}</Text>
            </View>
          ))}
        </View>

        <ScrollView
          style={gridStyles.gridsScroll}
          contentContainerStyle={gridStyles.gridsContent}
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

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.background,
  },

  zone: {
    flex: 1,
    paddingVertical: 6,
  },

  // Clue list (P1)
  clueScroll: {
    flex: 1,
    paddingHorizontal: 12,
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

  // Message
  message: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.mutedRose,
    marginBottom: 2,
  },

  // Submit
  submitBtn: {
    backgroundColor: PALETTE.honeyGold,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#A0784C',
    minWidth: 160,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: PALETTE.stoneGrey + '60',
    borderBottomColor: PALETTE.stoneGrey + '40',
  },
  submitBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: PALETTE.darkBrown,
  },
  submitBtnTextDisabled: {
    color: PALETTE.stoneGrey,
  },
});

// Grid styles (P2 zone) — mirrors PotionLogicGame.tsx
const gridStyles = StyleSheet.create({
  potionStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 4,
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

  gridsScroll: {
    flex: 1,
    width: '100%',
  },
  gridsContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
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
});
