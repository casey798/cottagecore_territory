import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  ImageBackground,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
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
export function balancedSplit(puzzle: WordClustersPuzzle): BalancedSplit {
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

export default function WordClustersCoopGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, puzzleData, practiceMode } = props;

  // Extract player identity from puzzleData
  const p1Name = (puzzleData?.p1Name as string | undefined) ?? 'Player 1';
  const p1Clan = (puzzleData?.p1Clan as string | undefined) ?? 'ember';
  const p2Name = (puzzleData?.p2Name as string | undefined) ?? 'Player 2';
  const p2Clan = (puzzleData?.p2Clan as string | undefined) ?? 'tide';

  // ── Puzzle generation (once on mount) ───────────────────────────
  const puzzleRef = useRef<WordClustersPuzzle | null>(null);
  const splitRef = useRef<BalancedSplit | null>(null);
  if (puzzleRef.current === null) {
    puzzleRef.current = generatePuzzle();
    splitRef.current = balancedSplit(puzzleRef.current);
  }
  const puzzle = puzzleRef.current;
  const { topWords, bottomWords } = splitRef.current!;

  // ── State ─────────────────────────────────────────────────────
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
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

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
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);

  // Refs to avoid stale closures in finishGame
  const mistakesRef = useRef(0);
  const solvedGroupsRef = useRef<string[][]>([]);

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
      if (isPausedRef.current) return;
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
    [sessionId],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // ── How to Play pause/resume ───────────────────────────────────
  const openHowToPlay = useCallback(() => {
    if (gameOver) return;
    isPausedRef.current = true;
    pauseStartRef.current = Date.now();
    setIsHowToPlayVisible(true);
  }, [gameOver]);

  const closeHowToPlay = useCallback(() => {
    const pausedMs = Date.now() - pauseStartRef.current;
    startTimeRef.current += pausedMs;
    isPausedRef.current = false;
    setIsHowToPlayVisible(false);
  }, []);

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
      solvedGroupsRef.current = updatedGroups.map((sg) => sg.words);
      setSelectedP1([]);
      setSelectedP2([]);
      isSubmittingRef.current = false;

      if (updatedGroups.length === 4) {
        finishGame('win');
      }
    } else {
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      mistakesRef.current = newMistakes;
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

  const handleCancelSelection = useCallback(() => {
    setSelectedP1([]);
    setSelectedP2([]);
  }, []);

  // ── Tap handlers ──────────────────────────────────────────────
  const interactionDisabled = gameOver || wrongFlashP1 || wrongFlashP2 || overlayVisible;

  const tapP1 = useCallback(
    (word: string) => {
      if (interactionDisabled || isSubmittingRef.current) return;
      if (solvedWords.has(word)) return;
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
    [interactionDisabled, solvedWords],
  );

  const tapP2 = useCallback(
    (word: string) => {
      if (interactionDisabled || isSubmittingRef.current) return;
      if (solvedWords.has(word)) return;
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
    [interactionDisabled, solvedWords],
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
  const hasSelection = selectedP1.length > 0 || selectedP2.length > 0;

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
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Word Clusters Co-op</Text>
        <View style={styles.headerRight}>
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
          <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
            <Text style={styles.helpBtnText}>?</Text>
          </TouchableOpacity>
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

        {/* Hint + Submit + Cancel buttons row */}
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

          {/* Submit Group button */}
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          >
            <Text style={[styles.submitBtnText, !canSubmit && styles.submitBtnTextDisabled]}>
              Submit Group
            </Text>
          </Pressable>

          {/* Cancel button */}
          {hasSelection && !gameOver && (
            <Pressable onPress={handleCancelSelection} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Clear</Text>
            </Pressable>
          )}
        </View>
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
        <GameCompleteOverlay
          result={overlayResult}
          onContinue={handleContinue}
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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Word Clusters Co-op</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} 16 words are split between two players {'\u2014'} 8 words each.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Each player{'\u2019'}s half contains exactly 2 words from each group.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Player 1 selects 2 words from the top, Player 2 selects 2 from the bottom.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} When both have selected 2 words, tap Submit Group to check.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} You share 8 mistakes and 3 hints {'\u2014'} communicate!
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Find all 4 groups together before time runs out.
            </Text>
            <Text style={styles.modalTip}>
              Tip: Tell your partner the categories you think your words belong to {'\u2014'} it helps narrow down the matches.
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

  // ── Help button ────────────────────────────────────
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

  // ── Control row (hint + submit + cancel) ──────────────
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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

  // ── Submit button ─────────────────────────────────────
  submitBtn: {
    backgroundColor: PALETTE.deepGreen,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: PALETTE.stoneGrey,
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: PALETTE.cream,
  },
  submitBtnTextDisabled: {
    color: PALETTE.cream,
  },

  // ── Cancel button ─────────────────────────────────────
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

  // ── How to Play modal ──────────────────────────────────
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
