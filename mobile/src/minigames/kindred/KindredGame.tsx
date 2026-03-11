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
import { useLockLandscape } from '@/hooks/useScreenOrientation';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps } from '@/types/minigame';
import { generatePuzzle, checkGroup, KindredPuzzle } from './KindredLogic';

const MAX_MISTAKES = 4;
const GROUP_COLORS: readonly string[] = [
  PALETTE.softGreen,
  PALETTE.honeyGold,
  PALETTE.softBlue,
  PALETTE.mutedRose,
];

interface SolvedGroup {
  groupIndex: number;
  label: string;
  words: string[];
  colorIndex: number;
}

export default function KindredGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete } = props;

  useLockLandscape();

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

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);

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

  // --- Timer ---
  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        finishGame('timeout', solvedGroups, mistakes);
      }
    }, 200);

    return () => clearInterval(interval);
    // We intentionally only re-subscribe when gameOver changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, timeLimit]);

  const finishGame = useCallback(
    (
      result: 'win' | 'lose' | 'timeout',
      groups: SolvedGroup[],
      mistakeCount: number,
    ) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, result, timeTaken);

      const solutionData: Record<string, unknown> = {
        groupsFound: groups.map((sg) => sg.words),
        mistakes: mistakeCount,
        solved: result === 'win',
      };

      onComplete({ result, timeTaken, completionHash, solutionData });
    },
    [onComplete, sessionId],
  );

  // --- Word tap ---
  const toggleWord = useCallback(
    (word: string) => {
      if (gameOver) return;
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

  // --- Submit ---
  const handleSubmit = useCallback(() => {
    if (selected.length !== 4 || gameOver) return;

    const result = checkGroup(selected, puzzle.groups);

    if (result.correct && result.groupIndex !== null && result.label !== null) {
      const newSolved: SolvedGroup = {
        groupIndex: result.groupIndex,
        label: result.label,
        words: [...selected],
        colorIndex: solvedGroups.length,
      };
      const updatedGroups = [...solvedGroups, newSolved];
      setSolvedGroups(updatedGroups);
      setSelected([]);

      if (updatedGroups.length === 4) {
        finishGame('win', updatedGroups, mistakes);
      }
    } else {
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      setSelected([]);

      if (newMistakes >= MAX_MISTAKES) {
        finishGame('lose', solvedGroups, newMistakes);
      }
    }
  }, [selected, gameOver, puzzle.groups, solvedGroups, mistakes, finishGame]);

  // --- Deselect all ---
  const handleDeselect = useCallback(() => {
    setSelected([]);
  }, []);

  // --- Layout ---
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const gridMaxW = screenW * 0.7;
  const gridMaxH = screenH * 0.55;
  const cellW = gridMaxW / 4 - 8;
  const cellH = gridMaxH / 4 - 8;

  const timerFraction = timeLeft / timeLimit;

  return (
    <View style={styles.root}>
      {/* Top bar: timer + mistakes */}
      <View style={styles.topBar}>
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

        <View style={styles.mistakeRow}>
          {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.mistakeDot,
                i < mistakes
                  ? { backgroundColor: PALETTE.mutedRose }
                  : { backgroundColor: PALETTE.stoneGrey, opacity: 0.3 },
              ]}
            />
          ))}
        </View>
      </View>

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
      <View style={[styles.grid, { maxWidth: gridMaxW }]}>
        {remainingWords.map((word) => {
          const isSelected = selected.includes(word);
          return (
            <Pressable
              key={word}
              onPress={() => toggleWord(word)}
              style={[
                styles.cell,
                { width: cellW, height: cellH },
                isSelected ? styles.cellSelected : styles.cellDefault,
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

      {/* Bottom buttons */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={handleDeselect}
          style={[styles.btn, styles.btnSecondary]}
          disabled={selected.length === 0 || gameOver}
        >
          <Text style={styles.btnSecondaryText}>Deselect</Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          style={[
            styles.btn,
            styles.btnPrimary,
            (selected.length !== 4 || gameOver) && styles.btnDisabled,
          ]}
          disabled={selected.length !== 4 || gameOver}
        >
          <Text style={styles.btnPrimaryText}>Submit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  // --- Top ---
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 12,
  },
  timerContainer: {
    flex: 1,
    height: 18,
    borderRadius: 9,
    backgroundColor: UI.border,
    overflow: 'hidden',
    marginRight: 16,
    justifyContent: 'center',
  },
  timerFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 9,
  },
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: PALETTE.cream,
    textAlign: 'center',
  },
  mistakeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  mistakeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  // --- Solved banners ---
  solvedContainer: {
    width: '100%',
    paddingHorizontal: 12,
    marginBottom: 4,
    gap: 4,
  },
  solvedBanner: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  solvedCategory: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: PALETTE.darkBrown,
  },
  solvedWords: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: PALETTE.darkBrown,
  },

  // --- Grid ---
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  cell: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  cellDefault: {
    backgroundColor: PALETTE.cream,
    borderColor: UI.border,
  },
  cellSelected: {
    backgroundColor: PALETTE.warmBrown,
    borderColor: PALETTE.darkBrown,
  },
  cellText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI.text,
    textTransform: 'uppercase',
  },
  cellTextSelected: {
    color: PALETTE.cream,
  },

  // --- Bottom ---
  bottomBar: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 110,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: PALETTE.deepGreen,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: UI.border,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnPrimaryText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: PALETTE.cream,
  },
  btnSecondaryText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: UI.text,
  },
});
