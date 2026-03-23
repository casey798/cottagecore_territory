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
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { WORD_CLUSTERS_TIME_LIMIT } from '@/constants/config';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import { generatePuzzle, checkGroup, MAX_MISTAKES } from './WordClustersLogic';
import type { WordClustersPuzzle } from './WordClustersLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

const GROUP_COLORS: readonly string[] = [
  PALETTE.softGreen,
  PALETTE.honeyGold,
  PALETTE.softBlue,
  PALETTE.mutedRose,
];

const HINT_INITIAL_WAIT = 30;
const HINT_COOLDOWN = 60;
const HINT_MAX_COUNT = 3;

type HintPhase = 'waiting' | 'ready' | 'cooldown' | 'exhausted';

interface SolvedGroup {
  groupIndex: number;
  label: string;
  words: string[];
  colorIndex: number;
}

export default function WordClustersGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, practiceMode } = props;
  const effectiveTimeLimit = timeLimit > 0 ? timeLimit : WORD_CLUSTERS_TIME_LIMIT;

  // Generate puzzle client-side on mount
  const puzzleRef = useRef<WordClustersPuzzle | null>(null);
  if (puzzleRef.current === null) {
    puzzleRef.current = generatePuzzle();
  }
  const puzzle = puzzleRef.current;

  const [selected, setSelected] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [solvedGroups, setSolvedGroups] = useState<SolvedGroup[]>([]);
  const [timeLeft, setTimeLeft] = useState(effectiveTimeLimit);
  const [gameOver, setGameOver] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

  // Hint state
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintCooldownRemaining, setHintCooldownRemaining] = useState(HINT_INITIAL_WAIT);
  const [revealedHintLabels, setRevealedHintLabels] = useState<string[]>([]);
  const [hintPhase, setHintPhase] = useState<HintPhase>('waiting');

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const hintTimerStartRef = useRef(Date.now());
  const hintIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);

  // Mirror mistakes and solvedGroups in refs to avoid stale closures
  const mistakesRef = useRef(0);
  const solvedGroupsRef = useRef<string[][]>([]);

  // Derive which words are still in play
  const solvedWords = useMemo(() => {
    const set = new Set<string>();
    solvedGroups.forEach((sg) => sg.words.forEach((w) => set.add(w)));
    return set;
  }, [solvedGroups]);

  const remainingWords = useMemo(
    () => puzzle.words.filter((w) => !solvedWords.has(w)),
    [puzzle.words, solvedWords],
  );

  // --- Game Timer ---
  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, effectiveTimeLimit - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        finishGame('timeout');
      }
    }, 200);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, effectiveTimeLimit]);

  // --- Hint Timer ---
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

  const finishGame = useCallback(
    (outcome: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);
      isSubmittingRef.current = false;

      if (hintIntervalRef.current !== null) {
        clearInterval(hintIntervalRef.current);
        hintIntervalRef.current = null;
      }

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const hashResult = outcome === 'win' ? 'win' : 'lose';
      const completionHash = generateClientCompletionHash(sessionId, hashResult, timeTaken);

      const solutionData: Record<string, unknown> = {
        groups: solvedGroupsRef.current,
        mistakes: mistakesRef.current,
        solved: outcome === 'win',
      };

      pendingResultRef.current = { result: outcome, timeTaken, completionHash, solutionData };
      setOverlayResult(outcome === 'win' ? 'win' : 'lose');
      setShowCompleteOverlay(true);
    },
    [sessionId, mistakes, solvedGroups],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // --- How to Play ---
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

  // --- Submit (explicit button press, Step 7) ---
  const trySubmit = useCallback(
    (words: string[]) => {
      if (words.length !== 4 || gameOver) return;

      isSubmittingRef.current = true;
      const result = checkGroup(words, puzzle.groups);

      if (result.correct && result.groupIndex !== null && result.label !== null) {
        const newSolved: SolvedGroup = {
          groupIndex: result.groupIndex,
          label: result.label,
          words: [...words],
          colorIndex: solvedGroups.length,
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
        // Wrong guess — flash feedback, increment mistakes, then deselect
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
        }, 400);
      }
    },
    [gameOver, puzzle.groups, solvedGroups, mistakes, finishGame],
  );

  // --- Word tap (no auto-submit) ---
  const toggleWord = useCallback(
    (word: string) => {
      if (gameOver || isSubmittingRef.current) return;

      setSelected((prev) => {
        if (prev.includes(word)) {
          return prev.filter((w) => w !== word);
        }
        if (prev.length >= 4) return prev;
        return [...prev, word];
      });
    },
    [gameOver],
  );

  // --- Portrait layout ---
  const { width: screenW } = Dimensions.get('window');
  const gridPadH = 16;
  const gap = 6;
  const availableW = screenW - gridPadH * 2;
  const cellW = (availableW - gap * 3) / 4;
  const cellH = cellW * 0.7;

  const timerFraction = timeLeft / effectiveTimeLimit;

  return (
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar with help button */}
      <View style={styles.topBar}>
        <View />
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* Timer bar */}
      <View style={styles.timerContainer}>
        <View
          style={[
            styles.timerFill,
            {
              width: `${timerFraction * 100}%`,
              backgroundColor:
                timerFraction > 0.25 ? PALETTE.softGreen : PALETTE.mutedRose,
            },
          ]}
        />
        <Text style={styles.timerText}>{Math.ceil(timeLeft)}s</Text>
      </View>

      {/* Hint banner */}
      {revealedHintLabels.length > 0 && (
        <View style={styles.hintBanner}>
          {revealedHintLabels.map((label) => (
            <Text key={label} style={styles.hintBannerText}>
              {'\uD83D\uDCA1'} One group is: {label}
            </Text>
          ))}
        </View>
      )}

      {/* Solved group banners */}
      {solvedGroups.length > 0 && (
        <View style={styles.solvedContainer}>
          {solvedGroups.map((sg) => (
            <View
              key={sg.groupIndex}
              style={[
                styles.solvedBanner,
                { backgroundColor: GROUP_COLORS[sg.colorIndex % GROUP_COLORS.length] },
              ]}
            >
              <Text style={styles.solvedCategory}>{sg.label}</Text>
              <Text style={styles.solvedWords}>{sg.words.join(', ')}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 4x4 grid */}
      <View style={[styles.grid, { paddingHorizontal: gridPadH, gap }]}>
        {remainingWords.map((word) => {
          const isSelected = selected.includes(word);
          return (
            <Pressable
              key={word}
              onPress={() => toggleWord(word)}
              disabled={isSubmittingRef.current || gameOver}
              style={[
                styles.cell,
                { width: cellW, height: cellH },
                isSelected
                  ? (wrongFlash ? styles.cellWrong : styles.cellSelected)
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
          styles.hintIcon,
          hintPhase === 'ready' ? styles.hintIconReady : styles.hintIconDisabled,
        ]}>
          {'\uD83C\uDF43'}
        </Text>
        <Text style={[
          styles.hintText,
          hintPhase === 'ready' ? styles.hintTextReady : styles.hintTextDisabled,
        ]}>
          {hintPhase === 'waiting' && `Hint in ${hintCooldownRemaining}s`}
          {hintPhase === 'ready' && 'Hint'}
          {hintPhase === 'cooldown' && `Next hint in ${hintCooldownRemaining}s`}
          {hintPhase === 'exhausted' && 'No hints left'}
        </Text>
      </Pressable>

      {/* Mistake markers */}
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
        <Text style={styles.mistakeLabel}>
          {MAX_MISTAKES - mistakes} left
        </Text>
      </View>

      {/* Bottom buttons: Deselect + Submit */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => setSelected([])}
          style={[styles.btn, styles.btnSecondary, (selected.length === 0 || gameOver) && styles.btnDisabled]}
          disabled={selected.length === 0 || gameOver || isSubmittingRef.current}
        >
          <Text style={styles.btnSecondaryText}>Deselect</Text>
        </Pressable>
        <Pressable
          onPress={() => trySubmit(selected)}
          style={[styles.btn, styles.btnSubmit, (selected.length !== 4 || gameOver) && styles.btnDisabled]}
          disabled={selected.length !== 4 || gameOver || isSubmittingRef.current}
        >
          <Text style={styles.btnSubmitText}>Submit</Text>
        </Pressable>
      </View>

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          xpEarned={overlayResult === 'win' ? 25 : 0}
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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Word Clusters</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} 16 words are shown on the board. Your goal is to find 4 groups of 4 words that share something in common.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap words to select them. When you have 4 selected, tap Submit to check if they form a group.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} If correct, the group is cleared from the board and its category is revealed.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} If wrong, a mistake is counted. You can make up to 8 mistakes before the game ends.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap a selected word again to deselect it. Tap Deselect All to clear your selection.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Use a Hint to reveal the category label of one unsolved group. You have 3 hints {'\u2014'} there is a 60-second cooldown between hints.
            </Text>
            <Text style={styles.modalTip}>
              Tip: One word can look like it belongs to multiple groups. Look for the group where all 4 words fit perfectly.
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
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
  },

  // --- Top bar ---
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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

  // --- Timer ---
  timerContainer: {
    width: '100%',
    height: 22,
    backgroundColor: UI.border,
    overflow: 'hidden',
    justifyContent: 'center',
    marginBottom: 10,
  },
  timerFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: PALETTE.cream,
    textAlign: 'center',
  },

  // --- Hint banner ---
  hintBanner: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: PALETTE.parchmentBg,
    marginBottom: 6,
  },
  hintBannerText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: PALETTE.darkBrown,
    lineHeight: 18,
  },

  // --- Solved banners ---
  solvedContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 4,
  },
  solvedBanner: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  solvedCategory: {
    fontFamily: FONTS.title,
    fontSize: 13,
    color: PALETTE.darkBrown,
  },
  solvedWords: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: PALETTE.darkBrown,
    textAlign: 'center',
  },

  // --- Grid ---
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
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
    fontSize: 12,
    color: UI.text,
    textTransform: 'uppercase',
  },
  cellTextSelected: {
    color: PALETTE.cream,
  },

  // --- Hint button ---
  hintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 10,
  },
  hintBtnReady: {
    backgroundColor: PALETTE.honeyGold + '25',
    borderWidth: 1,
    borderColor: PALETTE.honeyGold,
  },
  hintBtnDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '60',
  },
  hintIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  hintIconReady: {
    opacity: 1,
  },
  hintIconDisabled: {
    opacity: 0.4,
  },
  hintText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
  },
  hintTextReady: {
    color: PALETTE.honeyGold,
  },
  hintTextDisabled: {
    color: PALETTE.stoneGrey,
  },

  // --- Mistake markers ---
  mistakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    marginBottom: 2,
  },
  mistakeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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

  // --- Bottom buttons ---
  bottomBar: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 110,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: UI.border,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnSecondaryText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: UI.text,
  },
  btnSubmit: {
    backgroundColor: PALETTE.parchmentLight,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    minWidth: 140,
  },
  btnSubmitText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: PALETTE.darkBrown,
  },

  // --- How to Play modal ---
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
