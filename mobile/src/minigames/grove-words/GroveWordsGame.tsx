/**
 * Wordle - Wordle-style minigame component (portrait mode).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ImageBackground,
  Modal,
  Pressable,
} from 'react-native';
import { PALETTE, UI, KEYBOARD } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { GROVE_WORDS_TIME_LIMIT, XP_PER_WIN } from '@/constants/config';

import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
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

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

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
  const { sessionId, timeLimit, onComplete, practiceMode } = props;

  // Generate puzzle client-side on mount
  const puzzleRef = useRef(generatePuzzle());
  const targetWord = puzzleRef.current.word;
  const gameDuration = timeLimit > 0 ? timeLimit : GROVE_WORDS_TIME_LIMIT;

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
  const [loseTitle, setLoseTitle] = useState("Time's up!");
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const guessesRef = useRef<string[]>([]);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);

  // Keep guessesRef in sync with guesses state
  useEffect(() => {
    guessesRef.current = guesses;
  }, [guesses]);

  // ── Timer (Date.now() deltas) ──────────────────────────────────────

  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, gameDuration - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        finishGame('timeout', [...guessesRef.current]);
      }
    }, 200);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  // ── Finish helper ──────────────────────────────────────────────────

  const finishGame = useCallback(
    (outcome: 'win' | 'lose' | 'timeout', committedGuesses: string[]) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const resultOutcome = outcome === 'timeout' ? 'lose' : outcome;
      const completionHash = generateClientCompletionHash(sessionId, resultOutcome, timeTaken);
      const finalGuess = committedGuesses[committedGuesses.length - 1] ?? '';

      const result: MinigameResult = {
        result: resultOutcome,
        timeTaken,
        completionHash,
        solutionData: {
          guesses: committedGuesses,
          finalGuess,
          solved: outcome === 'win',
        },
      };

      pendingResultRef.current = result;

      if (outcome === 'timeout') {
        setOverlayResult('lose');
        setShowCompleteOverlay(true);
      } else {
        setOverlayResult(outcome === 'win' ? 'win' : 'lose');
        setShowCompleteOverlay(true);
      }
    },
    [sessionId],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // ── How to Play ────────────────────────────────────────────────────

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
          finishGame('win', newGuesses);
          return;
        }

        // Check lose (used all guesses)
        if (newGuesses.length >= MAX_GUESSES) {
          setLoseTitle('Out of guesses!');
          finishGame('lose', newGuesses);
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
    [gameOver, currentInput, guesses, results, keyStates, targetWord, finishGame],
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
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar */}
      <View style={styles.topBar}>
        <View />
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

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
        {/* Row 1: Q-P (10 keys, full width) */}
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
        {/* Row 2: A-L (9 keys, centered with half-key offset) */}
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
        {/* Row 3: ENTER Z-M DEL */}
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
                    backgroundColor: isWide ? KEY_DEFAULT_BG : keyBgColor(key),
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
                      color: isWide ? KEY_DEFAULT_TEXT : keyTextColor(key),
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
          xpEarned={overlayResult === 'win' ? XP_PER_WIN : 0}
          correctWord={targetWord}
          loseTitle={loseTitle}
          practiceMode={practiceMode}
          onContinue={handleContinue}
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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Wordle</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Guess the hidden 5-letter word in 6 tries.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Type a word using the keyboard below, then press ENTER to submit.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Each guess must be a valid 5-letter word.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} After each guess, the tiles change colour:
            </Text>
            <Text style={styles.modalRule}>
              {'  '}GREEN {'\u2014'} letter is in the correct spot.
            </Text>
            <Text style={styles.modalRule}>
              {'  '}YELLOW {'\u2014'} letter is in the word but wrong spot.
            </Text>
            <Text style={styles.modalRule}>
              {'  '}GREY {'\u2014'} letter is not in the word at all.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Duplicate letters: if a letter appears more than once in the word, only the matching tiles will light up.
            </Text>
            <Text style={styles.modalTip}>
              Tip: Start with a word that uses common letters like E, A, R, S, T.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
    fontSize: 13,
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
  // How to Play modal
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
