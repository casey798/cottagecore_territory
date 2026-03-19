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
import { PALETTE, UI, KEYBOARD } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';

import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps } from '@/types/minigame';
import {
  generatePuzzle,
  evaluateGuess,
  isValidWord,
  type LetterResult,
} from './GroveWordsLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';

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

const KEY_COLORS: Record<LetterResult, string> = {
  correct: KEYBOARD.correctGreen,
  present: KEYBOARD.presentYellow,
  absent: KEYBOARD.absentGray,
};

const KEY_DEFAULT_BG = KEYBOARD.defaultBg;
const KEY_DEFAULT_TEXT = KEYBOARD.textDark;
const KEY_COLORED_TEXT = KEYBOARD.textLight;
const KEY_H_GAP = 4;
const KEY_V_GAP = 6;
const KEY_HEIGHT = 56;
const KB_H_PAD = 16;

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

  // Generate puzzle client-side on mount
  const puzzleRef = useRef(generatePuzzle());
  const targetWord = puzzleRef.current.word;
  const gameDuration = timeLimit > 0 ? timeLimit : 180;

  // ── State ──────────────────────────────────────────────────────────

  const [guesses, setGuesses] = useState<string[]>([]);
  const [results, setResults] = useState<LetterResult[][]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
  const [message, setMessage] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [timeLeft, setTimeLeft] = useState(gameDuration);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingCompleteRef = useRef<Parameters<typeof onComplete>[0] | null>(null);

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
      setOverlayResult(outcome === 'win' ? 'win' : 'lose');
      setShowCompleteOverlay(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const solved = outcome === 'win';
      const allGuesses = [...guesses, ...(currentInput.length === WORD_LENGTH ? [currentInput] : [])].filter(Boolean);
      const completionHash = generateClientCompletionHash(sessionId, outcome, timeTaken);

      pendingCompleteRef.current = {
        result: outcome,
        timeTaken,
        completionHash,
        solutionData: {
          guesses: allGuesses,
          solved,
        },
      };
    },
    [guesses, currentInput, sessionId],
  );

  const handleContinue = useCallback(() => {
    if (pendingCompleteRef.current) {
      onComplete(pendingCompleteRef.current);
      pendingCompleteRef.current = null;
    }
  }, [onComplete]);

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
          setOverlayResult('win');
          setShowCompleteOverlay(true);
          const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
          const completionHash = generateClientCompletionHash(sessionId, 'win', timeTaken);
          pendingCompleteRef.current = {
            result: 'win',
            timeTaken,
            completionHash,
            solutionData: { guesses: newGuesses, solved: true },
          };
          return;
        }

        // Check lose (used all guesses)
        if (newGuesses.length >= MAX_GUESSES) {
          completedRef.current = true;
          setGameOver(true);
          setOverlayResult('lose');
          setShowCompleteOverlay(true);
          const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
          const completionHash = generateClientCompletionHash(sessionId, 'lose', timeTaken);
          pendingCompleteRef.current = {
            result: 'lose',
            timeTaken,
            completionHash,
            solutionData: { guesses: newGuesses, solved: false },
          };
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
    [gameOver, currentInput, guesses, results, keyStates, targetWord, sessionId],
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
    if (!state || state === 'unused') return KEY_DEFAULT_BG;
    return KEY_COLORS[state];
  };

  const keyTextColor = (key: string): string => {
    const state = keyStates[key];
    if (!state || state === 'unused') return KEY_DEFAULT_TEXT;
    return KEY_COLORED_TEXT;
  };

  const regularKeyWidth = (screenWidth - KB_H_PAD * 2 - KEY_H_GAP * 9) / 10;
  const wideKeyWidth = regularKeyWidth * 1.5;

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

      {/* Keyboard */}
      {!showCompleteOverlay && <View style={styles.keyboard}>
        {/* Row 1: Q–P (10 keys, full width) */}
        <View style={styles.keyboardRow}>
          {KEYBOARD_ROWS[0].map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.key, { width: regularKeyWidth, backgroundColor: keyBgColor(key) }]}
              onPress={() => handleKey(key)}
              disabled={gameOver}
              activeOpacity={0.7}
            >
              <Text style={[styles.keyText, { color: keyTextColor(key) }]}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Row 2: A–L (9 keys, centered with half-key offset) */}
        <View style={[styles.keyboardRow, { paddingHorizontal: (regularKeyWidth + KEY_H_GAP) / 2 }]}>
          {KEYBOARD_ROWS[1].map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.key, { width: regularKeyWidth, backgroundColor: keyBgColor(key) }]}
              onPress={() => handleKey(key)}
              disabled={gameOver}
              activeOpacity={0.7}
            >
              <Text style={[styles.keyText, { color: keyTextColor(key) }]}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Row 3: ENTER Z–M DEL */}
        <View style={styles.keyboardRow}>
          {KEYBOARD_ROWS[2].map((key) => {
            const isWide = key === 'ENTER' || key === 'DEL';
            const label = key === 'DEL' ? '\u232B' : key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.key,
                  {
                    width: isWide ? wideKeyWidth : regularKeyWidth,
                    backgroundColor: isWide ? KEY_COLORS.absent : keyBgColor(key),
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
                      color: isWide ? KEY_COLORED_TEXT : keyTextColor(key),
                      fontSize: key === 'ENTER' ? 11 : 13,
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>}

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          xpEarned={overlayResult === 'win' ? 25 : 0}
          correctWord={targetWord}
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
  keyboard: {
    width: '100%',
    paddingHorizontal: KB_H_PAD,
    gap: KEY_V_GAP,
    paddingBottom: 8,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: KEY_H_GAP,
  },
  key: {
    height: KEY_HEIGHT,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
  },
});
