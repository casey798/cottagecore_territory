import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CLAN_COLORS, PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import type { ClanId } from '@/types';
import { generatePuzzle, checkGroup, MAX_MISTAKES } from '../kindred/KindredLogic';
import type { KindredPuzzle } from '../kindred/KindredLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import { CoopDivider } from '@/components/minigames/CoopDivider';

// ── Solved-group colors (cottagecore palette) ─────────────────────
const SOLVED_COLOR_MOSS = PALETTE.softGreen;
const SOLVED_COLOR_AMBER = PALETTE.honeyGold;
const SOLVED_COLOR_ROSE = PALETTE.mutedRose;
const SOLVED_COLOR_SKY = PALETTE.softBlue;

const SOLVED_COLORS: readonly string[] = [
  SOLVED_COLOR_MOSS,
  SOLVED_COLOR_AMBER,
  SOLVED_COLOR_ROSE,
  SOLVED_COLOR_SKY,
];

const FLASH_DURATION_MS = 400;

// ── Types ─────────────────────────────────────────────────────────

interface SolvedGroup {
  groupIndex: number;
  label: string;
  words: string[];
  color: string;
}

interface BalancedSplit {
  topWords: string[];
  bottomWords: string[];
}

// ── Balanced shuffle ──────────────────────────────────────────────

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Split puzzle words so each group has exactly 2 in top and 2 in bottom.
 * Then shuffle each half independently.
 */
export function balancedSplit(puzzle: KindredPuzzle): BalancedSplit {
  const top: string[] = [];
  const bottom: string[] = [];

  for (const group of puzzle.groups) {
    const shuffledGroup = fisherYatesShuffle([...group.words]);
    top.push(shuffledGroup[0], shuffledGroup[1]);
    bottom.push(shuffledGroup[2], shuffledGroup[3]);
  }

  return {
    topWords: fisherYatesShuffle(top),
    bottomWords: fisherYatesShuffle(bottom),
  };
}

// ── Helpers ───────────────────────────────────────────────────────

function clanColor(clan: string): string {
  return CLAN_COLORS[clan as ClanId] ?? PALETTE.stoneGrey;
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return hex + a;
}

// ── Component ─────────────────────────────────────────────────────

export default function KindredCoopGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, puzzleData } = props;

  // Extract player identity from puzzleData
  const p1Name = (puzzleData?.p1Name as string | undefined) ?? 'Player 1';
  const p1Clan = (puzzleData?.p1Clan as string | undefined) ?? 'ember';
  const p2Name = (puzzleData?.p2Name as string | undefined) ?? 'Player 2';
  const p2Clan = (puzzleData?.p2Clan as string | undefined) ?? 'tide';

  // ── Puzzle generation (once on mount) ───────────────────────────
  const puzzleRef = useRef<KindredPuzzle | null>(null);
  const splitRef = useRef<BalancedSplit | null>(null);
  if (puzzleRef.current === null) {
    puzzleRef.current = generatePuzzle();
    splitRef.current = balancedSplit(puzzleRef.current);
  }
  const puzzle = puzzleRef.current;
  const { topWords, bottomWords } = splitRef.current!;

  // ── Shared state ────────────────────────────────────────────────
  const [selectedP1, setSelectedP1] = useState<string[]>([]);
  const [selectedP2, setSelectedP2] = useState<string[]>([]);
  const [solvedGroups, setSolvedGroups] = useState<SolvedGroup[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [gameOver, setGameOver] = useState(false);
  const [wrongFlashP1, setWrongFlashP1] = useState(false);
  const [wrongFlashP2, setWrongFlashP2] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const isSubmittingRef = useRef(false);

  // ── Derived state ───────────────────────────────────────────────
  const solvedWords = useMemo(() => {
    const set = new Set<string>();
    solvedGroups.forEach((sg) => sg.words.forEach((w) => set.add(w)));
    return set;
  }, [solvedGroups]);

  // ── Timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        finishGame('timeout');
      }
    }, 200);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, timeLimit]);

  // ── Finish game ─────────────────────────────────────────────────
  const finishGame = useCallback(
    (result: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);
      isSubmittingRef.current = false;

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, result, timeTaken);

      const solutionData: Record<string, unknown> = {
        solvedGroups: solvedGroups.map((sg) => sg.words),
        mistakes,
        totalWords: 16,
        solved: result === 'win',
      };

      pendingResultRef.current = { result, timeTaken, completionHash, solutionData };
      setOverlayResult(result === 'win' ? 'win' : 'lose');
      setOverlayVisible(true);
    },
    [sessionId, solvedGroups, mistakes],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // ── Submission ──────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (gameOver || isSubmittingRef.current) return;
    if (selectedP1.length !== 2 || selectedP2.length !== 2) return;

    isSubmittingRef.current = true;
    const combined = [...selectedP1, ...selectedP2];
    const result = checkGroup(combined, puzzle.groups);

    if (result.correct && result.groupIndex !== null && result.label !== null) {
      const newSolved: SolvedGroup = {
        groupIndex: result.groupIndex,
        label: result.label,
        words: [...combined],
        color: SOLVED_COLORS[solvedGroups.length % SOLVED_COLORS.length],
      };
      const updatedGroups = [...solvedGroups, newSolved];
      setSolvedGroups(updatedGroups);
      setSelectedP1([]);
      setSelectedP2([]);
      isSubmittingRef.current = false;

      if (updatedGroups.length === 4) {
        finishGame('win');
      }
    } else {
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      setWrongFlashP1(true);
      setWrongFlashP2(true);

      setTimeout(() => {
        setWrongFlashP1(false);
        setWrongFlashP2(false);
        setSelectedP1([]);
        setSelectedP2([]);
        isSubmittingRef.current = false;

        if (newMistakes >= MAX_MISTAKES) {
          finishGame('lose');
        }
      }, FLASH_DURATION_MS);
    }
  }, [gameOver, selectedP1, selectedP2, puzzle.groups, solvedGroups, mistakes, finishGame]);

  // ── Tap handlers ────────────────────────────────────────────────
  const interactionDisabled = gameOver || wrongFlashP1 || wrongFlashP2 || overlayVisible;

  const tapP1 = useCallback(
    (word: string) => {
      if (interactionDisabled || isSubmittingRef.current) return;
      setSelectedP1((prev) => {
        if (prev.includes(word)) {
          return prev.filter((w) => w !== word);
        }
        if (prev.length >= 2) {
          // FIFO: drop first, add new
          return [prev[1], word];
        }
        return [...prev, word];
      });
    },
    [interactionDisabled],
  );

  const tapP2 = useCallback(
    (word: string) => {
      if (interactionDisabled || isSubmittingRef.current) return;
      setSelectedP2((prev) => {
        if (prev.includes(word)) {
          return prev.filter((w) => w !== word);
        }
        if (prev.length >= 2) {
          return [prev[1], word];
        }
        return [...prev, word];
      });
    },
    [interactionDisabled],
  );

  // ── Layout computation ──────────────────────────────────────────
  const { width: screenW } = Dimensions.get('window');
  const gridPadH = 12;
  const gap = 6;
  const availableW = screenW - gridPadH * 2;
  const cellW = (availableW - gap * 3) / 4;
  const cellH = cellW * 0.65;

  const canSubmit =
    selectedP1.length === 2 && selectedP2.length === 2 && !gameOver && !isSubmittingRef.current;

  // ── Word card renderer ──────────────────────────────────────────
  const renderWordGrid = (
    words: string[],
    selected: string[],
    onTap: (word: string) => void,
    wrongFlash: boolean,
  ) => (
    <View style={[styles.grid, { paddingHorizontal: gridPadH, gap }]}>
      {words.map((word) => {
        const isSolved = solvedWords.has(word);
        const solvedGroup = isSolved
          ? solvedGroups.find((sg) => sg.words.includes(word))
          : undefined;
        const isSelected = selected.includes(word);

        return (
          <Pressable
            key={word}
            onPress={() => onTap(word)}
            disabled={isSolved || interactionDisabled || isSubmittingRef.current}
            style={[
              styles.cell,
              { width: cellW, height: cellH },
              isSolved && solvedGroup
                ? { backgroundColor: solvedGroup.color, borderColor: solvedGroup.color }
                : isSelected
                  ? wrongFlash
                    ? styles.cellWrong
                    : styles.cellSelected
                  : styles.cellDefault,
            ]}
          >
            <Text
              style={[
                styles.cellText,
                (isSelected && !isSolved) ? styles.cellTextSelected : null,
                isSolved ? styles.cellTextSolved : null,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {word}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Kindred Co-op</Text>
        <View style={styles.mistakeRow}>
          {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.mistakeDot,
                i < mistakes ? styles.mistakeUsed : styles.mistakeRemaining,
              ]}
            />
          ))}
          <Text style={styles.mistakeLabel}>{MAX_MISTAKES - mistakes} left</Text>
        </View>
      </View>

      {/* P1 Zone */}
      <View
        style={[
          styles.playerZone,
          { backgroundColor: withAlpha(clanColor(p1Clan), 0.1) },
          wrongFlashP1 && styles.zoneFlash,
        ]}
      >
        {renderWordGrid(topWords, selectedP1, tapP1, wrongFlashP1)}
      </View>

      {/* Divider */}
      <CoopDivider
        p1Name={p1Name}
        p1Clan={p1Clan}
        p2Name={p2Name}
        p2Clan={p2Clan}
        timeLeft={timeLeft}
        totalTime={timeLimit}
      >
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        >
          <Text style={[styles.submitBtnText, !canSubmit && styles.submitBtnTextDisabled]}>
            Submit Group
          </Text>
        </Pressable>
      </CoopDivider>

      {/* P2 Zone */}
      <View
        style={[
          styles.playerZone,
          { backgroundColor: withAlpha(clanColor(p2Clan), 0.1) },
          wrongFlashP2 && styles.zoneFlash,
        ]}
      >
        {renderWordGrid(bottomWords, selectedP2, tapP2, wrongFlashP2)}
      </View>

      {/* Solved groups banner */}
      {solvedGroups.length > 0 && (
        <View style={styles.solvedContainer}>
          {solvedGroups.map((sg) => (
            <View
              key={sg.groupIndex}
              style={[styles.solvedBanner, { backgroundColor: sg.color }]}
            >
              <Text style={styles.solvedCategory}>{sg.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Game complete overlay */}
      {overlayVisible && (
        <GameCompleteOverlay result={overlayResult} onContinue={handleContinue} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.background,
  },

  // ── Header ──────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    maxHeight: 40,
  },
  headerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI.text,
  },

  // ── Mistake markers ──────────────────────────────────
  mistakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mistakeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mistakeUsed: {
    backgroundColor: '#A0937D',
  },
  mistakeRemaining: {
    backgroundColor: '#7CAA5E',
  },
  mistakeLabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: PALETTE.stoneGrey,
    marginLeft: 4,
  },

  // ── Player zones ────────────────────────────────────
  playerZone: {
    flex: 1,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  zoneFlash: {
    borderColor: PALETTE.errorRed,
  },

  // ── Grid ────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  // ── Cells (mirrors KindredGame styling) ─────────────
  cell: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    paddingHorizontal: 2,
  },
  cellDefault: {
    backgroundColor: PALETTE.cream,
    borderColor: UI.border,
  },
  cellSelected: {
    backgroundColor: PALETTE.warmBrown,
    borderColor: PALETTE.darkBrown,
  },
  cellWrong: {
    backgroundColor: PALETTE.mutedRose,
    borderColor: PALETTE.errorRed,
  },
  cellText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: UI.text,
    textTransform: 'uppercase',
  },
  cellTextSelected: {
    color: PALETTE.cream,
  },
  cellTextSolved: {
    color: PALETTE.darkBrown,
    opacity: 0.7,
  },

  // ── Submit button ───────────────────────────────────
  submitBtn: {
    backgroundColor: PALETTE.deepGreen,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 140,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: PALETTE.stoneGrey,
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.cream,
  },
  submitBtnTextDisabled: {
    color: PALETTE.cream,
  },

  // ── Solved banners ──────────────────────────────────
  solvedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 4,
  },
  solvedBanner: {
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  solvedCategory: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: PALETTE.darkBrown,
  },
});
