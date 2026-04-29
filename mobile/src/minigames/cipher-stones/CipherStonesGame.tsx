import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import { PALETTE, UI, KEYBOARD } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { CIPHER_STONES_TIME_LIMIT, XP_PER_WIN } from '@/constants/config';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import { generatePuzzle, checkGuess, getProgress, MINIGAME_CONFIG } from './CipherStonesLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_SIZE = Math.floor((SCREEN_WIDTH - 48) / 14);
const TILE_GAP = 3;

// ─── Keyboard constants ──────────────────────────────────────────────────────

const KEYBOARD_ROWS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
];

const KEY_H_GAP = 4;
const KEY_V_GAP = 6;
const KEY_HEIGHT = 56;
const KB_H_PAD = 16;

const INITIAL_HINT_DELAY = 30;
const MAX_HINTS = 3;
const WRONG_TILE_BG = KEYBOARD.wrongTileBg;
const REVIEW_TIMEOUT_MS = 15000;

function isLetter(ch: string): boolean {
  return /^[A-Z]$/.test(ch);
}

// ─── Memoised tile component ────────────────────────────────────────────────

interface LetterTileProps {
  encoded: string;
  decoded: string | undefined;
  isSelected: boolean;
  isRevealed: boolean;
  isCorrectReview: boolean;
  isWrong: boolean;
  disabled: boolean;
  onPress: (encoded: string) => void;
  shakeTranslateX: Animated.Value;
}

const LetterTile = React.memo(function LetterTile({
  encoded,
  decoded,
  isSelected,
  isRevealed,
  isCorrectReview,
  isWrong,
  disabled,
  onPress,
  shakeTranslateX,
}: LetterTileProps) {
  const handlePress = useCallback(() => {
    onPress(encoded);
  }, [onPress, encoded]);

  const tileContent = (
    <View
      style={[
        styles.tile,
        isSelected && styles.tileSelected,
        isRevealed && styles.tileRevealed,
        isCorrectReview && styles.tileRevealed,
        isWrong && styles.tileWrong,
      ]}
    >
      <Text style={styles.tileEncodedText}>{encoded}</Text>
      <Text
        style={[
          styles.tileDecodedText,
          (isRevealed || isCorrectReview) && styles.tileDecodedRevealed,
          isWrong && styles.tileDecodedWrong,
        ]}
      >
        {decoded ?? ''}
      </Text>
    </View>
  );

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {isSelected ? (
        <Animated.View style={{ transform: [{ translateX: shakeTranslateX }] }}>
          {tileContent}
        </Animated.View>
      ) : (
        tileContent
      )}
    </TouchableOpacity>
  );
});

// ─── Main component ─────────────────────────────────────────────────────────

export default function CipherStonesGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, practiceMode } = props;
  const gameDuration = timeLimit > 0 ? timeLimit : CIPHER_STONES_TIME_LIMIT;

  // Puzzle is generated once on mount — never changes
  const puzzleRef = useRef(generatePuzzle());
  const puzzle = puzzleRef.current;

  // Fully decoded quote (for loss reveal)
  const decodedQuote = useMemo(() => {
    let result = '';
    for (const ch of puzzle.encodedQuote) {
      if (isLetter(ch)) {
        result += puzzle.solution[ch] || ch;
      } else {
        result += ch;
      }
    }
    return result;
  }, [puzzle.encodedQuote, puzzle.solution]);

  // Hint system: track dynamically revealed letters (superset of puzzle.revealedLetters)
  const [extraRevealed, setExtraRevealed] = useState<Record<string, string>>({});

  const revealedEncodedSet = useMemo(
    () => new Set([...Object.keys(puzzle.revealedLetters), ...Object.keys(extraRevealed)]),
    [puzzle.revealedLetters, extraRevealed],
  );

  // Set of unique encoded letters that appear in the quote
  const quoteEncodedSet = useMemo(() => {
    const s = new Set<string>();
    for (const ch of puzzle.encodedQuote) {
      if (isLetter(ch)) s.add(ch);
    }
    return s;
  }, [puzzle.encodedQuote]);

  // Ordered list of unique encoded letters in the quote (for auto-advance)
  const quoteEncodedOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const ch of puzzle.encodedQuote) {
      if (isLetter(ch) && !seen.has(ch)) {
        seen.add(ch);
        order.push(ch);
      }
    }
    return order;
  }, [puzzle.encodedQuote]);

  // Memoised word groups for rendering
  const words = useMemo(() => {
    const result: string[][] = [];
    let currentWord: string[] = [];
    for (const ch of puzzle.encodedQuote) {
      if (ch === ' ') {
        if (currentWord.length > 0) {
          result.push(currentWord);
          currentWord = [];
        }
        result.push([' ']);
      } else {
        currentWord.push(ch);
      }
    }
    if (currentWord.length > 0) {
      result.push(currentWord);
    }
    return result;
  }, [puzzle.encodedQuote]);

  // State
  const [userMappings, setUserMappings] = useState<Record<string, string>>(
    () => ({ ...puzzle.revealedLetters }),
  );
  const [selectedEncoded, setSelectedEncoded] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(gameDuration);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

  // Wrong-submission review: timer paused, incorrect tiles highlighted
  const [reviewingWrong, setReviewingWrong] = useState(false);

  // Time of last hint use (seconds elapsed), starts at 0 so first hint unlocks at t=30
  const [lastHintElapsed, setLastHintElapsed] = useState(0);
  const [hintCooldownLeft, setHintCooldownLeft] = useState(INITIAL_HINT_DELAY);
  const [hintsUsed, setHintsUsed] = useState(0);

  // How to Play modal
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const userMappingsRef = useRef(userMappings);
  const onCompleteRef = useRef(onComplete);
  // Track whether the current cooldown uses the initial delay or the full hintCooldown
  const isFirstHintRef = useRef(true);
  // Timer pause tracking
  const pausedAtMsRef = useRef(0);
  const totalPausedMsRef = useRef(0);
  // How-to-play pause tracking
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);
  // Review timeout ref
  const reviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Shake animation
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Keep refs in sync
  useEffect(() => {
    userMappingsRef.current = userMappings;
  }, [userMappings]);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const progress = getProgress(puzzle.solution, userMappings, quoteEncodedSet);

  // Derive incorrect / correct-non-revealed sets during review
  const incorrectEncodedSet = useMemo(() => {
    if (!reviewingWrong) return new Set<string>();
    const s = new Set<string>();
    for (const enc of quoteEncodedSet) {
      if (revealedEncodedSet.has(enc)) continue;
      if (userMappings[enc] !== puzzle.solution[enc]) s.add(enc);
    }
    return s;
  }, [reviewingWrong, quoteEncodedSet, revealedEncodedSet, userMappings, puzzle.solution]);

  const correctNonRevealedSet = useMemo(() => {
    if (!reviewingWrong) return new Set<string>();
    const s = new Set<string>();
    for (const enc of quoteEncodedSet) {
      if (revealedEncodedSet.has(enc)) continue;
      if (userMappings[enc] === puzzle.solution[enc]) s.add(enc);
    }
    return s;
  }, [reviewingWrong, quoteEncodedSet, revealedEncodedSet, userMappings, puzzle.solution]);

  // Portrait lock
  useEffect(() => {
    Orientation.lockToPortrait();
    return () => {
      Orientation.unlockAllOrientations();
    };
  }, []);

  // Cleanup review timeout on unmount
  useEffect(() => {
    return () => {
      if (reviewTimeoutRef.current !== null) {
        clearTimeout(reviewTimeoutRef.current);
        reviewTimeoutRef.current = null;
      }
    };
  }, []);

  // Shake animation trigger
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Resume from review mode helper
  const resumeFromReview = useCallback(() => {
    totalPausedMsRef.current += Date.now() - pausedAtMsRef.current;
    setReviewingWrong(false);
    if (reviewTimeoutRef.current !== null) {
      clearTimeout(reviewTimeoutRef.current);
      reviewTimeoutRef.current = null;
    }
  }, []);

  // Auto-resume review after 15s
  useEffect(() => {
    if (!reviewingWrong) return;
    reviewTimeoutRef.current = setTimeout(() => {
      reviewTimeoutRef.current = null;
      resumeFromReview();
    }, REVIEW_TIMEOUT_MS);
    return () => {
      if (reviewTimeoutRef.current !== null) {
        clearTimeout(reviewTimeoutRef.current);
        reviewTimeoutRef.current = null;
      }
    };
  }, [reviewingWrong, resumeFromReview]);

  // Finish game helper
  const finishGame = useCallback(
    (outcome: 'win' | 'lose', mappings: Record<string, string>) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      const timeTaken = Math.round(
        (Date.now() - startTimeRef.current - totalPausedMsRef.current) / 1000,
      );
      const completionHash = generateClientCompletionHash(sessionId, outcome, timeTaken);
      pendingResultRef.current = {
        result: outcome,
        timeTaken,
        completionHash,
        solutionData: { solved: outcome === 'win' },
      };

      setOverlayResult(outcome);
      setShowCompleteOverlay(true);
    },
    [sessionId],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onCompleteRef.current(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, []);

  // Single timer interval using Date.now() deltas — also drives hint cooldown
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      // Skip ticking while reviewing wrong submission or how-to-play is open
      if (reviewingWrong || isPausedRef.current) return;

      const elapsed = (Date.now() - startTimeRef.current - totalPausedMsRef.current) / 1000;
      const remaining = Math.max(0, gameDuration - elapsed);
      setTimeLeft(remaining);

      // Derive hint cooldown from elapsed time
      const sinceLastHint = elapsed - lastHintElapsed;
      const activeCooldown = isFirstHintRef.current ? INITIAL_HINT_DELAY : MINIGAME_CONFIG.hintCooldown;
      const hintRemaining = Math.max(0, activeCooldown - sinceLastHint);
      setHintCooldownLeft(hintRemaining);

      if (remaining <= 0) {
        clearInterval(interval);
        finishGame('lose', userMappingsRef.current);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [gameOver, gameDuration, lastHintElapsed, reviewingWrong, finishGame]);

  // Hint: find encoded letters in quote that are not revealed and not correctly mapped
  const hintCandidates = useMemo(() => {
    const candidates: string[] = [];
    for (const enc of quoteEncodedSet) {
      if (revealedEncodedSet.has(enc)) continue;
      if (userMappings[enc] === puzzle.solution[enc]) continue;
      candidates.push(enc);
    }
    return candidates;
  }, [quoteEncodedSet, revealedEncodedSet, userMappings, puzzle.solution]);

  const hintAvailable = hintCooldownLeft <= 0 && hintCandidates.length > 0 && !gameOver && !reviewingWrong && hintsUsed < MAX_HINTS;
  const showHintButton = hintCandidates.length > 0 && !gameOver && !reviewingWrong && hintsUsed < MAX_HINTS;

  const handleHint = useCallback(() => {
    if (!hintAvailable || hintCandidates.length === 0) return;

    // Pick a random candidate
    const enc = hintCandidates[Math.floor(Math.random() * hintCandidates.length)];
    const dec = puzzle.solution[enc];

    // After first hint, subsequent cooldowns use the full hintCooldown
    isFirstHintRef.current = false;

    // Add to extra revealed
    setExtraRevealed((prev) => ({ ...prev, [enc]: dec }));

    // Set the correct mapping
    setUserMappings((prev) => {
      const newMappings = { ...prev, [enc]: dec };

      // Check if this hint completed the puzzle
      const allMapped = Array.from(quoteEncodedSet).every((e) => !!newMappings[e]);
      if (allMapped && checkGuess(puzzle.solution, newMappings)) {
        finishGame('win', newMappings);
      }

      return newMappings;
    });

    // Reset hint cooldown
    const elapsed = (Date.now() - startTimeRef.current - totalPausedMsRef.current) / 1000;
    setLastHintElapsed(elapsed);

    // Increment hint counter
    setHintsUsed((prev) => prev + 1);

    // Clear selection if it was the hinted letter
    setSelectedEncoded((prev) => (prev === enc ? null : prev));
  }, [hintAvailable, hintCandidates, puzzle.solution, quoteEncodedSet, finishGame]);

  // Find the next unsolved, non-revealed encoded letter in quote order after `current`
  const findNextUnsolved = useCallback(
    (current: string, mappings: Record<string, string>): string | null => {
      const idx = quoteEncodedOrder.indexOf(current);
      for (let offset = 1; offset < quoteEncodedOrder.length; offset++) {
        const candidate = quoteEncodedOrder[(idx + offset) % quoteEncodedOrder.length];
        if (!revealedEncodedSet.has(candidate) && !mappings[candidate]) {
          return candidate;
        }
      }
      return null;
    },
    [quoteEncodedOrder, revealedEncodedSet],
  );

  // Check if all quote-appearing encoded letters have mappings
  const allQuoteLettersMapped = useCallback(
    (mappings: Record<string, string>): boolean => {
      for (const enc of quoteEncodedSet) {
        if (!mappings[enc]) return false;
      }
      return true;
    },
    [quoteEncodedSet],
  );

  // Tile tap: select encoded letter; if reviewing wrong, resume timer
  const handleTileTap = useCallback(
    (encodedChar: string) => {
      if (gameOver) return;
      if (revealedEncodedSet.has(encodedChar)) return;

      // Resume timer if in review mode
      if (reviewingWrong) {
        resumeFromReview();
      }

      setSelectedEncoded(encodedChar);
    },
    [gameOver, revealedEncodedSet, reviewingWrong, resumeFromReview],
  );

  // Keyboard key press handler
  const handleKey = useCallback(
    (key: string) => {
      if (gameOver || selectedEncoded === null) return;

      if (key === 'DEL') {
        // Clear the current mapping if not pre-revealed
        if (revealedEncodedSet.has(selectedEncoded)) return;
        setUserMappings((prev) => {
          if (!prev[selectedEncoded]) return prev;
          const newMappings = { ...prev };
          delete newMappings[selectedEncoded];
          return newMappings;
        });
        return;
      }

      const decodedChar = key;

      setUserMappings((prev) => {
        // Check if this decoded letter is already assigned to a different encoded letter
        for (const [enc, dec] of Object.entries(prev)) {
          if (dec === decodedChar && enc !== selectedEncoded) {
            // Trigger shake feedback for duplicate rejection
            triggerShake();
            return prev;
          }
        }

        const newMappings = { ...prev, [selectedEncoded]: decodedChar };

        // Check if all quote letters now have mappings
        if (allQuoteLettersMapped(newMappings)) {
          const isCorrect = checkGuess(puzzle.solution, newMappings);

          if (isCorrect) {
            // Win — freeze game and show overlay
            finishGame('win', newMappings);
            setSelectedEncoded(null);
            return newMappings;
          }

          // Wrong — pause timer, show tile-level feedback, clear selection
          pausedAtMsRef.current = Date.now();
          setReviewingWrong(true);
          setSelectedEncoded(null);
          return newMappings;
        }

        // Auto-advance to next unsolved letter
        const next = findNextUnsolved(selectedEncoded, newMappings);
        if (next) {
          setSelectedEncoded(next);
        } else {
          setSelectedEncoded(null);
        }

        return newMappings;
      });
    },
    [gameOver, selectedEncoded, puzzle.solution, findNextUnsolved, allQuoteLettersMapped, revealedEncodedSet, finishGame, triggerShake],
  );

  // How to Play
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

  const regularKeyWidth = (SCREEN_WIDTH - KB_H_PAD * 2 - KEY_H_GAP * 9) / 10;
  const wideKeyWidth = regularKeyWidth * 1.5;

  const timerFraction = timeLeft / gameDuration;
  const isTimeLow = timeLeft < 15;

  return (
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar with help button */}
      <View style={styles.topBar}>
        <View />
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* Timer text + bar */}
      <Text style={styles.timerText}>{Math.ceil(timeLeft)}s</Text>
      <View style={styles.timerBarContainer}>
        <View
          style={[
            styles.timerBarFill,
            {
              width: `${timerFraction * 100}%`,
              backgroundColor: isTimeLow ? PALETTE.errorRed : PALETTE.softGreen,
            },
          ]}
        />
      </View>

      {/* Quote area */}
      <ScrollView
        style={styles.quoteScroll}
        contentContainerStyle={styles.quoteContainer}
      >
        <View style={styles.quoteWrap}>
          {words.map((word, wi) => {
            if (word.length === 1 && word[0] === ' ') {
              return <View key={`sp-${wi}`} style={styles.wordSpace} />;
            }
            return (
              <View key={`w-${wi}`} style={styles.word}>
                {word.map((ch, ci) => {
                  if (!isLetter(ch)) {
                    return (
                      <Text key={`p-${wi}-${ci}`} style={styles.punctuation}>
                        {ch}
                      </Text>
                    );
                  }

                  const isPreRevealed = revealedEncodedSet.has(ch);

                  return (
                    <LetterTile
                      key={`t-${wi}-${ci}`}
                      encoded={ch}
                      decoded={userMappings[ch]}
                      isSelected={selectedEncoded === ch}
                      isRevealed={isPreRevealed}
                      isCorrectReview={correctNonRevealedSet.has(ch)}
                      isWrong={incorrectEncodedSet.has(ch)}
                      disabled={gameOver || isPreRevealed}
                      onPress={handleTileTap}
                      shakeTranslateX={shakeAnim}
                    />
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBarFill,
              {
                width:
                  progress.total > 0
                    ? `${(progress.decoded / progress.total) * 100}%`
                    : '0%',
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {progress.decoded} / {progress.total}
        </Text>
      </View>

      {/* Hint button */}
      {showHintButton && (
        <View style={styles.hintRow}>
          <TouchableOpacity
            style={[styles.hintButton, !hintAvailable && styles.hintButtonDisabled]}
            onPress={handleHint}
            disabled={!hintAvailable}
            activeOpacity={0.7}
          >
            <Text style={[styles.hintButtonText, !hintAvailable && styles.hintButtonTextDisabled]}>
              {hintCooldownLeft > 0
                ? `Hint (${Math.ceil(hintCooldownLeft)}s) \u00B7 ${MAX_HINTS - hintsUsed} left`
                : `Hint (${MAX_HINTS - hintsUsed} left)`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Instruction */}
      <Text style={styles.instruction}>
        {reviewingWrong ? 'Tap an incorrect tile to fix it' : 'Tap a letter then type your guess'}
      </Text>

      {/* In-app keyboard */}
      {!showCompleteOverlay && (
        <View style={styles.keyboard}>
          {/* Row 1: Q-P (10 keys, full width) */}
          <View style={styles.keyboardRow}>
            {KEYBOARD_ROWS[0].map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.key, { width: regularKeyWidth }]}
                onPress={() => handleKey(key)}
                disabled={gameOver}
                activeOpacity={0.7}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Row 2: A-L (9 keys, centered with half-key offset) */}
          <View style={[styles.keyboardRow, { paddingHorizontal: (regularKeyWidth + KEY_H_GAP) / 2 }]}>
            {KEYBOARD_ROWS[1].map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.key, { width: regularKeyWidth }]}
                onPress={() => handleKey(key)}
                disabled={gameOver}
                activeOpacity={0.7}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Row 3: Z-M + DEL */}
          <View style={styles.keyboardRow}>
            {KEYBOARD_ROWS[2].map((key) => {
              const isDel = key === 'DEL';
              const label = isDel ? '\u232B' : key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.key,
                    isDel ? styles.keyDel : undefined,
                    { width: isDel ? wideKeyWidth : regularKeyWidth },
                  ]}
                  onPress={() => handleKey(key)}
                  disabled={gameOver}
                  activeOpacity={0.7}
                >
                  <Text style={isDel ? styles.keyTextDel : styles.keyText}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          xpEarned={overlayResult === 'win' ? XP_PER_WIN : 0}
          practiceMode={practiceMode}
          revealQuote={decodedQuote}
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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Cipher</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} A short quote has been scrambled {'\u2014'} every letter replaced with a different one.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap a scrambled letter tile above, then tap the real letter you think it stands for below.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} When you map a letter, every copy of it in the quote fills in automatically.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Spaces and punctuation are not scrambled {'\u2014'} use them as clues.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Some letters are already revealed to help you start.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap a filled tile to change your guess. Tap the hint button for a free reveal (cooldown applies).
            </Text>
            <Text style={styles.modalTip}>
              Tip: Single-letter words can only be A or I. Look for short words like THE, AND, or IN to get started fast.
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

  // Top bar
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 2,
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

  // Timer
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI.text,
    alignSelf: 'flex-start',
    marginLeft: '5%',
    marginBottom: 2,
  },
  timerBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: PALETTE.stoneGrey + '40',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Quote section
  quoteScroll: {
    flex: 1,
    marginTop: 8,
  },
  quoteContainer: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    justifyContent: 'center',
  },
  quoteWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  word: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  wordSpace: {
    width: TILE_SIZE * 0.6,
    marginBottom: 6,
  },
  punctuation: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: UI.text,
    alignSelf: 'center',
    paddingBottom: 2,
    marginHorizontal: 1,
  },

  // Instruction
  instruction: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    paddingVertical: 4,
  },

  // Tiles
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE + 12,
    marginHorizontal: TILE_GAP / 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey,
    backgroundColor: PALETTE.cream,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tileSelected: {
    borderColor: PALETTE.honeyGold,
    borderWidth: 2,
    backgroundColor: PALETTE.honeyGold + '20',
  },
  tileRevealed: {
    backgroundColor: PALETTE.softGreen + '30',
    borderColor: PALETTE.softGreen,
  },
  tileWrong: {
    backgroundColor: WRONG_TILE_BG,
    borderColor: WRONG_TILE_BG,
  },
  tileEncodedText: {
    fontSize: 10,
    color: PALETTE.stoneGrey,
  },
  tileDecodedText: {
    fontSize: 16,
    color: PALETTE.darkBrown,
    minHeight: 20,
  },
  tileDecodedRevealed: {
    color: PALETTE.deepGreen,
  },
  tileDecodedWrong: {
    color: KEYBOARD.textLight,
  },

  // Hint button
  hintRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  hintButton: {
    backgroundColor: PALETTE.cream,
    borderWidth: 1,
    borderColor: PALETTE.warmBrown,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  hintButtonDisabled: {
    borderColor: PALETTE.stoneGrey + '60',
    backgroundColor: PALETTE.stoneGrey + '15',
  },
  hintButtonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.darkBrown,
  },
  hintButtonTextDisabled: {
    color: PALETTE.stoneGrey,
  },

  // Progress
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 10,
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: PALETTE.stoneGrey + '40',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: PALETTE.softGreen,
    borderRadius: 4,
  },
  progressText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: UI.text,
  },

  // Keyboard
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
    backgroundColor: KEYBOARD.defaultBg,
  },
  keyText: {
    fontSize: 13,
    color: KEYBOARD.textDark,
  },
  keyDel: {
    backgroundColor: KEYBOARD.absentGray,
  },
  keyTextDel: {
    fontSize: 13,
    color: KEYBOARD.textLight,
  },

  // How to Play modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: UI.overlay,
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
