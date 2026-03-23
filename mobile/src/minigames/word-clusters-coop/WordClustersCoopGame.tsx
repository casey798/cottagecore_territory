import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  ImageBackground,
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
import { generatePuzzle, checkGroup, MAX_MISTAKES } from '../word-clusters/WordClustersLogic';
import type { WordClustersPuzzle } from '../word-clusters/WordClustersLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import { CoopDivider } from '@/components/minigames/CoopDivider';

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

// ── Solved-group colors (cottagecore palette) ─────────────────────
const SOLVED_COLORS: readonly string[] = [
  PALETTE.softGreen,
  PALETTE.honeyGold,
  PALETTE.mutedRose,
  PALETTE.softBlue,
];

const FLASH_DURATION_MS = 400;

// ── Hint constants ────────────────────────────────────────────────
const HINT_INITIAL_WAIT = 30;
const HINT_COOLDOWN = 60;
const HINT_MAX_COUNT = 3;

type HintPhase = 'waiting' | 'ready' | 'cooldown' | 'exhausted';

// ── Types ─────────────────────────────────────────────────────────

interface SolvedGroup {
  groupIndex: number;
  label: string;
  words: string[];
  color: string;
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

export default function WordClustersCoopGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, puzzleData, practiceMode } = props;

  // Extract player identity from puzzleData
  const p1Name = (puzzleData?.p1Name as string | undefined) ?? 'Player 1';
  const p1Clan = (puzzleData?.p1Clan as string | undefined) ?? 'ember';
  const p2Name = (puzzleData?.p2Name as string | undefined) ?? 'Player 2';
  const p2Clan = (puzzleData?.p2Clan as string | undefined) ?? 'tide';

  // ── Puzzle generation (once on mount) ───────────────────────────
  const puzzleRef = useRef<WordClustersPuzzle | null>(null);
  if (puzzleRef.current === null) {
    puzzleRef.current = generatePuzzle();
  }
  const puzzle = puzzleRef.current;

  // ── Shared state ────────────────────────────────────────────────
  const [selected, setSelected] = useState<string[]>([]);
  const [solvedGroups, setSolvedGroups] = useState<SolvedGroup[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [gameOver, setGameOver] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // Hint state (shared between both players)
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintCooldownRemaining, setHintCooldownRemaining] = useState(HINT_INITIAL_WAIT);
  const [revealedHintLabels, setRevealedHintLabels] = useState<string[]>([]);
  const [hintPhase, setHintPhase] = useState<HintPhase>('waiting');

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const isSubmittingRef = useRef(false);
  const hintTimerStartRef = useRef(Date.now());
  const hintIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs to avoid stale closures in finishGame
  const mistakesRef = useRef(0);
  const solvedGroupsRef = useRef<string[][]>([]);

  // ── Derived state ───────────────────────────────────────────────
  const solvedWords = useMemo(() => {
    const set = new Set<string>();
    solvedGroups.forEach((sg) => sg.words.forEach((w) => set.add(w)));
    return set;
  }, [solvedGroups]);

  const remainingWords = useMemo(
    () => puzzle.words.filter((w) => !solvedWords.has(w)),
    [puzzle.words, solvedWords],
  );

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

  // ── Hint Timer ──────────────────────────────────────────────────
  const startHintCountdown = useCallback((duration: number) => {
    hintTimerStartRef.current = Date.now();
    setHintCooldownRemaining(duration);

    if (hintIntervalRef.current !== null) {
      clearInterval(hintIntervalRef.current);
    }

    hintIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - hintTimerStartRef.current) / 1000;
      const remaining = Math.max(0, Math.ceil(duration - elapsed));
      setHintCooldownRemaining(remaining);

      if (remaining <= 0) {
        if (hintIntervalRef.current !== null) {
          clearInterval(hintIntervalRef.current);
          hintIntervalRef.current = null;
        }
        setHintPhase('ready');
      }
    }, 1000);
  }, []);

  // Start initial hint countdown on mount
  useEffect(() => {
    startHintCountdown(HINT_INITIAL_WAIT);
    return () => {
      if (hintIntervalRef.current !== null) {
        clearInterval(hintIntervalRef.current);
        hintIntervalRef.current = null;
      }
      isSubmittingRef.current = false;
    };
  }, [startHintCountdown]);

  // Stop hint timer when game ends
  useEffect(() => {
    if (gameOver) {
      isSubmittingRef.current = false;
      if (hintIntervalRef.current !== null) {
        clearInterval(hintIntervalRef.current);
        hintIntervalRef.current = null;
      }
    }
  }, [gameOver]);

  const handleHint = useCallback(() => {
    if (hintPhase !== 'ready' || gameOver) return;

    const solvedLabels = new Set(solvedGroups.map((sg) => sg.label));
    const candidates = puzzle.groups.filter(
      (g) => !solvedLabels.has(g.label) && !revealedHintLabels.includes(g.label),
    );

    if (candidates.length === 0) {
      setHintPhase('exhausted');
      return;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const newRevealed = [...revealedHintLabels, chosen.label];
    const newHintsUsed = hintsUsed + 1;

    setRevealedHintLabels(newRevealed);
    setHintsUsed(newHintsUsed);

    if (newHintsUsed >= HINT_MAX_COUNT) {
      setHintPhase('exhausted');
    } else {
      setHintPhase('cooldown');
      startHintCountdown(HINT_COOLDOWN);
    }
  }, [hintPhase, gameOver, solvedGroups, puzzle.groups, revealedHintLabels, hintsUsed, startHintCountdown]);

  // ── Finish game ─────────────────────────────────────────────────
  const finishGame = useCallback(
    (result: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);
      isSubmittingRef.current = false;

      if (hintIntervalRef.current !== null) {
        clearInterval(hintIntervalRef.current);
        hintIntervalRef.current = null;
      }

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, result, timeTaken);

      const solutionData: Record<string, unknown> = {
        solvedGroups: solvedGroupsRef.current,
        mistakes: mistakesRef.current,
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

  // ── Submission with Suggest+Confirm ─────────────────────────────
  const handleSubmitPress = useCallback(() => {
    if (gameOver || isSubmittingRef.current || selected.length !== 4) return;

    if (!pendingSubmit) {
      // First tap — enter confirm state
      setPendingSubmit(true);
      return;
    }

    // Second tap — actually submit
    setPendingSubmit(false);
    isSubmittingRef.current = true;
    const result = checkGroup(selected, puzzle.groups);

    if (result.correct && result.groupIndex !== null && result.label !== null) {
      const newSolved: SolvedGroup = {
        groupIndex: result.groupIndex,
        label: result.label,
        words: [...selected],
        color: SOLVED_COLORS[solvedGroups.length % SOLVED_COLORS.length],
      };
      const updatedGroups = [...solvedGroups, newSolved];
      setSolvedGroups(updatedGroups);
      solvedGroupsRef.current = updatedGroups.map((sg) => sg.words);
      setSelected([]);
      isSubmittingRef.current = false;

      if (updatedGroups.length === 4) {
        finishGame('win');
      }
    } else {
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      mistakesRef.current = newMistakes;
      setWrongFlash(true);

      setTimeout(() => {
        setWrongFlash(false);
        setSelected([]);
        isSubmittingRef.current = false;

        if (newMistakes >= MAX_MISTAKES) {
          finishGame('lose');
        }
      }, FLASH_DURATION_MS);
    }
  }, [gameOver, selected, pendingSubmit, puzzle.groups, solvedGroups, mistakes, finishGame]);

  const handleCancelSubmit = useCallback(() => {
    setPendingSubmit(false);
  }, []);

  // ── Tap handler (shared selection for both players) ─────────────
  const interactionDisabled = gameOver || wrongFlash || overlayVisible;

  const tapWord = useCallback(
    (word: string) => {
      if (interactionDisabled || isSubmittingRef.current) return;
      // Clear pending confirm when selection changes
      setPendingSubmit(false);
      setSelected((prev) => {
        if (prev.includes(word)) {
          return prev.filter((w) => w !== word);
        }
        if (prev.length >= 4) return prev;
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
  const cellH = cellW * 0.55;

  const canSubmit = selected.length === 4 && !gameOver && !isSubmittingRef.current;

  // ── Word card renderer ──────────────────────────────────────────
  const renderWordGrid = () => (
    <View style={[styles.grid, { paddingHorizontal: gridPadH, gap }]}>
      {remainingWords.map((word) => {
        const isSelected = selected.includes(word);

        return (
          <Pressable
            key={word}
            onPress={() => tapWord(word)}
            disabled={interactionDisabled || isSubmittingRef.current}
            style={[
              styles.cell,
              { width: cellW, height: cellH },
              isSelected
                ? wrongFlash
                  ? styles.cellWrong
                  : styles.cellSelected
                : styles.cellDefault,
            ]}
          >
            <Text
              style={[
                styles.cellText,
                isSelected ? styles.cellTextSelected : null,
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
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Word Clusters Co-op</Text>
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
          wrongFlash && styles.zoneFlash,
        ]}
      >
        {renderWordGrid()}
      </View>

      {/* Divider with shared controls */}
      <CoopDivider
        p1Name={p1Name}
        p1Clan={p1Clan}
        p2Name={p2Name}
        p2Clan={p2Clan}
        timeLeft={timeLeft}
        totalTime={timeLimit}
      >
        {/* Hint banner */}
        {revealedHintLabels.length > 0 && (
          <View style={styles.hintBanner}>
            {revealedHintLabels.map((label) => (
              <Text key={label} style={styles.hintBannerText}>
                {'\uD83D\uDCA1'} {label}
              </Text>
            ))}
          </View>
        )}

        {/* Hint + Submit buttons row */}
        <View style={styles.controlRow}>
          {/* Hint button */}
          <Pressable
            onPress={handleHint}
            disabled={hintPhase !== 'ready' || gameOver}
            style={[
              styles.hintBtn,
              hintPhase === 'ready' ? styles.hintBtnReady : styles.hintBtnDisabled,
            ]}
          >
            <Text style={[
              styles.hintText,
              hintPhase === 'ready' ? styles.hintTextReady : styles.hintTextDisabled,
            ]}>
              {hintPhase === 'waiting' && `Hint (${hintCooldownRemaining}s)`}
              {hintPhase === 'ready' && `Hint (${HINT_MAX_COUNT - hintsUsed} left)`}
              {hintPhase === 'cooldown' && `Hint (${hintCooldownRemaining}s)`}
              {hintPhase === 'exhausted' && 'No hints left'}
            </Text>
          </Pressable>

          {/* Submit / Confirm button */}
          <View style={styles.submitGroup}>
            <Pressable
              onPress={handleSubmitPress}
              disabled={!canSubmit}
              style={[
                styles.submitBtn,
                pendingSubmit ? styles.submitBtnConfirm : null,
                !canSubmit && styles.submitBtnDisabled,
              ]}
            >
              <Text style={[
                styles.submitBtnText,
                pendingSubmit ? styles.submitBtnTextConfirm : null,
                !canSubmit && styles.submitBtnTextDisabled,
              ]}>
                {pendingSubmit ? 'Confirm?' : 'Submit'}
              </Text>
            </Pressable>
            {pendingSubmit && (
              <Pressable onPress={handleCancelSubmit} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            )}
          </View>
        </View>
      </CoopDivider>

      {/* P2 Zone */}
      <View
        style={[
          styles.playerZone,
          { backgroundColor: withAlpha(clanColor(p2Clan), 0.1) },
          wrongFlash && styles.zoneFlash,
        ]}
      >
        {renderWordGrid()}
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
        <GameCompleteOverlay
          result={overlayResult}
          xpEarned={overlayResult === 'win' ? 25 : 0}
          onContinue={handleContinue}
          practiceMode={practiceMode}
        />
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    fontFamily: FONTS.title,
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
    backgroundColor: PALETTE.stoneGrey,
  },
  mistakeRemaining: {
    backgroundColor: PALETTE.softGreen,
  },
  mistakeLabel: {
    fontFamily: FONTS.bodySemiBold,
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

  // ── Cells ─────────────────────────────────────────
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
    // No fontFamily — system font for word tile game elements
    fontSize: 11,
    color: UI.text,
    textTransform: 'uppercase',
  },
  cellTextSelected: {
    color: PALETTE.cream,
  },

  // ── Hint banner ───────────────────────────────────────
  hintBanner: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hintBannerText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: PALETTE.darkBrown,
    textAlign: 'center',
  },

  // ── Control row (hint + submit) ───────────────────────
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 2,
  },

  // ── Hint button ───────────────────────────────────────
  hintBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  hintBtnReady: {
    backgroundColor: PALETTE.honeyGold + '25',
    borderColor: PALETTE.honeyGold,
  },
  hintBtnDisabled: {
    backgroundColor: 'transparent',
    borderColor: PALETTE.stoneGrey + '60',
  },
  hintText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
  },
  hintTextReady: {
    color: PALETTE.honeyGold,
  },
  hintTextDisabled: {
    color: PALETTE.stoneGrey,
  },

  // ── Submit button group ───────────────────────────────
  submitGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitBtn: {
    backgroundColor: PALETTE.deepGreen,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  submitBtnConfirm: {
    backgroundColor: PALETTE.honeyGold,
  },
  submitBtnDisabled: {
    backgroundColor: PALETTE.stoneGrey,
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.cream,
  },
  submitBtnTextConfirm: {
    color: PALETTE.darkBrown,
  },
  submitBtnTextDisabled: {
    color: PALETTE.cream,
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.mutedRose,
  },
  cancelBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: PALETTE.mutedRose,
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
    fontFamily: FONTS.title,
    fontSize: 11,
    color: PALETTE.darkBrown,
  },
});
