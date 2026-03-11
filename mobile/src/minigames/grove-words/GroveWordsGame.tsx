/**
 * Grove Words - Wordle-style minigame component (portrait mode).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useLockPortrait } from '@/hooks/useScreenOrientation';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps } from '@/types/minigame';
import {
  generatePuzzle,
  evaluateGuess,
  isValidWord,
  type LetterResult,
} from './GroveWordsLogic';

// ── Constants ────────────────────────────────────────────────────────

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const KEYBOARD_ROWS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
];

const TILE_COLORS: Record<LetterResult, string> = {
  correct: PALETTE.softGreen,
  present: PALETTE.honeyGold,
  absent: PALETTE.stoneGrey,
};

// ── Helper: best state for keyboard coloring ─────────────────────────

type KeyState = LetterResult | 'unused';

function bestKeyState(current: KeyState, incoming: LetterResult): KeyState {
  if (current === 'correct') return 'correct';
  if (incoming === 'correct') return 'correct';
  if (current === 'present' || incoming === 'present') return 'present';
  return 'absent';
}

// ── Component ────────────────────────────────────────────────────────

export default function GroveWordsGame(props: MinigamePlayProps): React.JSX.Element {
  const { sessionId, timeLimit, onComplete } = props;

  useLockPortrait();

  // Generate puzzle client-side on mount
  const puzzleRef = useRef(generatePuzzle());
  const targetWord = puzzleRef.current.word;
  const gameDuration = timeLimit > 0 ? timeLimit : 120;

  // ── State ──────────────────────────────────────────────────────────

  const [guesses, setGuesses] = useState<string[]>([]);
  const [results, setResults] = useState<LetterResult[][]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
  const [message, setMessage] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [timeLeft, setTimeLeft] = useState(gameDuration);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);

  // ── Timer (Date.now() deltas) ──────────────────────────────────────

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

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const solved = outcome === 'win';
      const allGuesses = [...guesses, ...(currentInput.length === WORD_LENGTH ? [currentInput] : [])].filter(Boolean);
      const completionHash = generateClientCompletionHash(sessionId, outcome, timeTaken);

      onComplete({
        result: outcome,
        timeTaken,
        completionHash,
        solutionData: {
          guesses: allGuesses,
          solved,
        },
      });
    },
    [guesses, currentInput, onComplete, sessionId],
  );

  // ── Key press handler ──────────────────────────────────────────────

  const handleKey = useCallback(
    (key: string) => {
      if (gameOver) return;

      if (key === 'DEL') {
        setCurrentInput((prev) => prev.slice(0, -1));
        setMessage('');
        return;
      }

      if (key === 'ENTER') {
        if (currentInput.length !== WORD_LENGTH) {
          setMessage('Not enough letters');
          return;
        }
        if (!isValidWord(currentInput)) {
          setMessage('Word not in list');
          return;
        }

        const result = evaluateGuess(currentInput, targetWord);
        const newGuesses = [...guesses, currentInput];
        const newResults = [...results, result];

        // Update keyboard states
        const newKeyStates = { ...keyStates };
        for (let i = 0; i < WORD_LENGTH; i++) {
          const letter = currentInput[i];
          newKeyStates[letter] = bestKeyState(
            newKeyStates[letter] ?? 'unused',
            result[i],
          );
        }

        setGuesses(newGuesses);
        setResults(newResults);
        setKeyStates(newKeyStates);
        setCurrentInput('');
        setMessage('');

        // Check win
        if (result.every((r) => r === 'correct')) {
          completedRef.current = true;
          setGameOver(true);
          const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
          const completionHash = generateClientCompletionHash(sessionId, 'win', timeTaken);
          onComplete({
            result: 'win',
            timeTaken,
            completionHash,
            solutionData: { guesses: newGuesses, solved: true },
          });
          return;
        }

        // Check lose (used all guesses)
        if (newGuesses.length >= MAX_GUESSES) {
          completedRef.current = true;
          setGameOver(true);
          const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
          const completionHash = generateClientCompletionHash(sessionId, 'lose', timeTaken);
          onComplete({
            result: 'lose',
            timeTaken,
            completionHash,
            solutionData: { guesses: newGuesses, solved: false },
          });
          return;
        }

        return;
      }

      // Regular letter
      if (currentInput.length < WORD_LENGTH) {
        setCurrentInput((prev) => prev + key);
        setMessage('');
      }
    },
    [gameOver, currentInput, guesses, results, keyStates, targetWord, onComplete, sessionId],
  );

  // ── Render helpers ─────────────────────────────────────────────────

  const screenWidth = Dimensions.get('window').width;
  const tileSize = Math.min(Math.floor((screenWidth - 60) / WORD_LENGTH), 58);
  const tileGap = 4;

  const renderTile = (letter: string, result: LetterResult | null, index: number) => {
    const bgColor = result ? TILE_COLORS[result] : 'transparent';
    const borderColor = result ? bgColor : UI.border;
    const textColor = result ? PALETTE.cream : UI.text;

    return (
      <View
        key={index}
        style={[
          styles.tile,
          {
            width: tileSize,
            height: tileSize,
            backgroundColor: bgColor,
            borderColor,
          },
        ]}
      >
        <Text
          style={[
            styles.tileLetter,
            { color: textColor, fontSize: tileSize * 0.55 },
          ]}
        >
          {letter}
        </Text>
      </View>
    );
  };

  const renderGrid = () => {
    const rows: React.JSX.Element[] = [];

    for (let row = 0; row < MAX_GUESSES; row++) {
      const tiles: React.JSX.Element[] = [];

      if (row < guesses.length) {
        // Submitted guess
        for (let col = 0; col < WORD_LENGTH; col++) {
          tiles.push(renderTile(guesses[row][col], results[row][col], col));
        }
      } else if (row === guesses.length) {
        // Current input row
        for (let col = 0; col < WORD_LENGTH; col++) {
          tiles.push(renderTile(currentInput[col] ?? '', null, col));
        }
      } else {
        // Empty row
        for (let col = 0; col < WORD_LENGTH; col++) {
          tiles.push(renderTile('', null, col));
        }
      }

      rows.push(
        <View key={row} style={[styles.gridRow, { gap: tileGap }]}>
          {tiles}
        </View>,
      );
    }

    return rows;
  };

  const keyBgColor = (key: string): string => {
    const state = keyStates[key];
    if (!state || state === 'unused') return PALETTE.cream;
    return TILE_COLORS[state];
  };

  const keyTextColor = (key: string): string => {
    const state = keyStates[key];
    if (!state || state === 'unused') return UI.text;
    return PALETTE.cream;
  };

  const timerFraction = timeLeft / gameDuration;

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
              backgroundColor:
                timerFraction > 0.25 ? PALETTE.softGreen : PALETTE.mutedRose,
            },
          ]}
        />
      </View>

      <Text style={styles.timerText}>{Math.ceil(timeLeft)}s</Text>

      {/* Message */}
      {message !== '' && <Text style={styles.message}>{message}</Text>}

      {/* Grid */}
      <View style={styles.gridContainer}>{renderGrid()}</View>

      {/* Game over reveal */}
      {gameOver && (
        <Text style={styles.revealText}>
          {guesses[guesses.length - 1]?.toUpperCase() === targetWord
            ? 'Well done!'
            : `The word was ${targetWord}`}
        </Text>
      )}

      {/* Keyboard */}
      <View style={styles.keyboard}>
        {KEYBOARD_ROWS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.keyboardRow}>
            {row.map((key) => {
              const isWide = key === 'ENTER' || key === 'DEL';
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.key,
                    {
                      backgroundColor: isWide ? PALETTE.warmBrown : keyBgColor(key),
                      minWidth: isWide ? 56 : 30,
                      flex: isWide ? 1.4 : 1,
                    },
                  ]}
                  onPress={() => handleKey(key)}
                  disabled={gameOver}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.keyText,
                      {
                        color: isWide ? PALETTE.cream : keyTextColor(key),
                        fontSize: isWide ? 11 : 15,
                      },
                    ]}
                  >
                    {key}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
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
  message: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.mutedRose,
    marginBottom: 2,
    height: 20,
  },
  gridContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1,
  },
  gridRow: {
    flexDirection: 'row',
  },
  tile: {
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLetter: {
    fontFamily: FONTS.bodyBold,
    textTransform: 'uppercase',
  },
  revealText: {
    fontFamily: FONTS.headerBold,
    fontSize: 20,
    color: UI.text,
    marginVertical: 4,
  },
  keyboard: {
    width: '100%',
    paddingHorizontal: 4,
    gap: 4,
    paddingBottom: 8,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  key: {
    height: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  keyText: {
    fontFamily: FONTS.bodySemiBold,
  },
});
