import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps } from '@/types/minigame';
import { generatePuzzle, checkGroup, KindredPuzzle, MAX_MISTAKES } from './KindredLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import type { MinigameResult } from '@/types/minigame';

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

export default function KindredGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete } = props;

  // Generate puzzle client-side on mount
  const puzzleRef = useRef<KindredPuzzle | null>(null);
  if (puzzleRef.current === null) {
    puzzleRef.current = generatePuzzle();
  }
  const puzzle = puzzleRef.current;

  const [selected, setSelected] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [solvedGroups, setSolvedGroups] = useState<SolvedGroup[]>([]);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [gameOver, setGameOver] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

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
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        finishGame('timeout', solvedGroups);
      }
    }, 200);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, timeLimit]);

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
    (
      result: 'win' | 'lose' | 'timeout',
      groups: SolvedGroup[],
    ) => {
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
        groupsFound: groups.map((sg) => sg.words),
        mistakes,
        solved: result === 'win',
      };

      pendingResultRef.current = { result, timeTaken, completionHash, solutionData };
      setOverlayResult(result === 'win' ? 'win' : 'lose');
      setShowCompleteOverlay(true);
    },
    [sessionId],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // --- Auto-submit logic (called when 4th word is tapped) ---
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
        setSelected([]);
        isSubmittingRef.current = false;

        if (updatedGroups.length === 4) {
          finishGame('win', updatedGroups);
        }
      } else {
        // Wrong guess — flash feedback, increment mistakes, then deselect
        const newMistakes = mistakes + 1;
        setMistakes(newMistakes);
        setWrongFlash(true);
        setTimeout(() => {
          setWrongFlash(false);
          setSelected([]);
          isSubmittingRef.current = false;

          if (newMistakes >= MAX_MISTAKES) {
            finishGame('lose', solvedGroups);
          }
        }, 400);
      }
    },
    [gameOver, puzzle.groups, solvedGroups, mistakes, finishGame],
  );

  // --- Word tap ---
  const toggleWord = useCallback(
    (word: string) => {
      if (gameOver || isSubmittingRef.current) return;

      setSelected((prev) => {
        if (prev.includes(word)) {
          return prev.filter((w) => w !== word);
        }
        if (prev.length >= 4) return prev;

        const next = [...prev, word];
        if (next.length === 4) {
          // Schedule auto-submit on next tick so state is committed
          setTimeout(() => trySubmit(next), 0);
        }
        return next;
      });
    },
    [gameOver, trySubmit],
  );

  // --- Portrait layout ---
  const { width: screenW } = Dimensions.get('window');
  const gridPadH = 16;
  const gap = 6;
  const availableW = screenW - gridPadH * 2;
  const cellW = (availableW - gap * 3) / 4;
  const cellH = cellW * 0.7;

  const timerFraction = timeLeft / timeLimit;

  return (
    <View style={styles.root}>
      {/* Timer bar at top */}
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
              💡 One group is: {label}
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
          🍃
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

      {/* Deselect button */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => setSelected([])}
          style={[styles.btn, styles.btnSecondary, (selected.length === 0 || gameOver) && styles.btnDisabled]}
          disabled={selected.length === 0 || gameOver || isSubmittingRef.current}
        >
          <Text style={styles.btnSecondaryText}>Deselect</Text>
        </Pressable>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.background,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
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
    backgroundColor: '#F5EACB',
    marginBottom: 6,
  },
  hintBannerText: {
    fontFamily: FONTS.bodySemiBold,
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
    fontFamily: FONTS.bodyBold,
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
    borderColor: '#C0392B',
  },
  cellText: {
    fontFamily: FONTS.bodySemiBold,
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
    backgroundColor: '#D4A843' + '25',
    borderWidth: 1,
    borderColor: '#D4A843',
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
    color: '#D4A843',
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

  // --- Bottom button ---
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
});
