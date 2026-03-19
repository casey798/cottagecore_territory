import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import { PALETTE, UI, KEYBOARD } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import { generatePuzzle, checkGuess, getProgress, MINIGAME_CONFIG } from './CipherStonesLogic';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_SIZE = Math.floor((SCREEN_WIDTH - 48) / 14);
const TILE_GAP = 3;

// ─── Keyboard constants (mirrored from Grove Words) ─────────────────────────

const KEYBOARD_ROWS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
];

const KEY_DEFAULT_BG = KEYBOARD.defaultBg;
const KEY_DEFAULT_TEXT = KEYBOARD.textDark;
const KEY_DEL_BG = KEYBOARD.absentGray;
const KEY_DEL_TEXT = KEYBOARD.textLight;
const KEY_H_GAP = 4;
const KEY_V_GAP = 6;
const KEY_HEIGHT = 56;
const KB_H_PAD = 16;

const INITIAL_HINT_DELAY = 30;
const WRONG_TILE_BG = KEYBOARD.wrongTileBg;
const QUOTE_REVEAL_DURATION_MS = 2500;

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
}: LetterTileProps) {
  const handlePress = useCallback(() => {
    onPress(encoded);
  }, [onPress, encoded]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
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
    </TouchableOpacity>
  );
});

// ─── Main component ─────────────────────────────────────────────────────────

export default function CipherStonesGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete } = props;

  // Puzzle is generated once on mount — never changes
  const puzzleRef = useRef(generatePuzzle());
  const puzzle = puzzleRef.current;

  // Fully decoded quote (for end-of-game reveal)
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
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [gameOver, setGameOver] = useState(false);
  const [showQuoteReveal, setShowQuoteReveal] = useState(false);

  // Wrong-submission review: timer paused, incorrect tiles highlighted
  const [reviewingWrong, setReviewingWrong] = useState(false);

  // Time of last hint use (seconds elapsed), starts at 0 so first hint unlocks at t=30
  const [lastHintElapsed, setLastHintElapsed] = useState(0);
  const [hintCooldownLeft, setHintCooldownLeft] = useState(INITIAL_HINT_DELAY);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const userMappingsRef = useRef(userMappings);
  // Stable ref for onComplete to avoid stale closures in setTimeout
  const onCompleteRef = useRef(onComplete);
  // Track whether the current cooldown uses the initial delay or the full hintCooldown
  const isFirstHintRef = useRef(true);
  // Timer pause tracking
  const pausedAtMsRef = useRef(0);
  const totalPausedMsRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    userMappingsRef.current = userMappings;
  }, [userMappings]);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const progress = getProgress(puzzle.solution, userMappings);

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

  // Single timer interval using Date.now() deltas — also drives hint cooldown
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      // Skip ticking while reviewing wrong submission (timer is paused)
      if (reviewingWrong) return;

      const elapsed = (Date.now() - startTimeRef.current - totalPausedMsRef.current) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(remaining);

      // Derive hint cooldown from elapsed time
      const sinceLastHint = elapsed - lastHintElapsed;
      const activeCooldown = isFirstHintRef.current ? INITIAL_HINT_DELAY : MINIGAME_CONFIG.hintCooldown;
      const hintRemaining = Math.max(0, activeCooldown - sinceLastHint);
      setHintCooldownLeft(hintRemaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (!completedRef.current) {
          completedRef.current = true;
          setGameOver(true);

          const timeTaken = Math.round(elapsed);
          const completionHash = generateClientCompletionHash(sessionId, 'lose', timeTaken);
          pendingResultRef.current = {
            result: 'lose',
            timeTaken,
            completionHash,
            solutionData: { mappings: userMappingsRef.current, solved: false },
          };
          setShowQuoteReveal(true);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [gameOver, timeLimit, sessionId, lastHintElapsed, reviewingWrong]);

  // Auto-call onComplete after quote reveal timeout (uses ref to avoid stale closure)
  useEffect(() => {
    if (!showQuoteReveal) return;
    const timer = setTimeout(() => {
      if (pendingResultRef.current) {
        onCompleteRef.current(pendingResultRef.current);
        pendingResultRef.current = null;
      }
    }, QUOTE_REVEAL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showQuoteReveal]);

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

  const hintAvailable = hintCooldownLeft <= 0 && hintCandidates.length > 0 && !gameOver && !reviewingWrong;
  const showHintButton = hintCandidates.length > 0 && !gameOver && !reviewingWrong;

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
        if (!completedRef.current) {
          completedRef.current = true;
          setGameOver(true);
          const timeTaken = Math.round(
            (Date.now() - startTimeRef.current - totalPausedMsRef.current) / 1000,
          );
          const completionHash = generateClientCompletionHash(sessionId, 'win', timeTaken);
          pendingResultRef.current = {
            result: 'win',
            timeTaken,
            completionHash,
            solutionData: { mappings: newMappings, solved: true },
          };
          setShowQuoteReveal(true);
        }
      }

      return newMappings;
    });

    // Reset hint cooldown
    const elapsed = (Date.now() - startTimeRef.current - totalPausedMsRef.current) / 1000;
    setLastHintElapsed(elapsed);

    // Clear selection if it was the hinted letter
    setSelectedEncoded((prev) => (prev === enc ? null : prev));
  }, [hintAvailable, hintCandidates, puzzle.solution, quoteEncodedSet, sessionId]);

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
        totalPausedMsRef.current += Date.now() - pausedAtMsRef.current;
        setReviewingWrong(false);
      }

      setSelectedEncoded(encodedChar);
    },
    [gameOver, revealedEncodedSet, reviewingWrong],
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
            return prev;
          }
        }

        const newMappings = { ...prev, [selectedEncoded]: decodedChar };

        // Check if all quote letters now have mappings
        if (allQuoteLettersMapped(newMappings)) {
          const isCorrect = checkGuess(puzzle.solution, newMappings);

          if (isCorrect) {
            // Win — freeze game and show quote reveal
            if (!completedRef.current) {
              completedRef.current = true;
              setGameOver(true);

              const timeTaken = Math.round(
                (Date.now() - startTimeRef.current - totalPausedMsRef.current) / 1000,
              );
              const completionHash = generateClientCompletionHash(
                sessionId,
                'win',
                timeTaken,
              );
              pendingResultRef.current = {
                result: 'win',
                timeTaken,
                completionHash,
                solutionData: { mappings: newMappings, solved: true },
              };
              setShowQuoteReveal(true);
            }
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
    [gameOver, selectedEncoded, puzzle.solution, findNextUnsolved, allQuoteLettersMapped, sessionId, revealedEncodedSet],
  );

  const regularKeyWidth = (SCREEN_WIDTH - KB_H_PAD * 2 - KEY_H_GAP * 9) / 10;
  const wideKeyWidth = regularKeyWidth * 1.5;

  const timerFraction = timeLeft / timeLimit;
  const isTimeLow = timeLeft < 15;

  return (
    <View style={styles.root}>
      {/* Timer bar */}
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
                ? `Hint (${Math.ceil(hintCooldownLeft)}s)`
                : 'Hint'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Instruction */}
      <Text style={styles.instruction}>
        {reviewingWrong ? 'Tap an incorrect tile to fix it' : 'Tap a letter then type your guess'}
      </Text>

      {/* In-app keyboard (same layout & style as Grove Words) */}
      {!showQuoteReveal && (
        <View style={styles.keyboard}>
          {/* Row 1: Q–P (10 keys, full width) */}
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
          {/* Row 2: A–L (9 keys, centered with half-key offset) */}
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
          {/* Row 3: Z–M + DEL */}
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

      {/* Quote reveal overlay — shown for 2.5s on both win and lose before exiting */}
      {showQuoteReveal && (
        <View style={styles.quoteRevealOverlay}>
          <View style={styles.quoteRevealCard}>
            <Text style={styles.quoteRevealLabel}>The quote was:</Text>
            <Text style={styles.quoteRevealText}>{decodedQuote}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.background,
  },

  // Timer bar
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
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    color: PALETTE.stoneGrey,
  },
  tileDecodedText: {
    fontFamily: FONTS.bodyBold,
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

  // Keyboard (same as Grove Words)
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
    backgroundColor: KEY_DEFAULT_BG,
  },
  keyText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: KEY_DEFAULT_TEXT,
  },
  keyDel: {
    backgroundColor: KEY_DEL_BG,
  },
  keyTextDel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: KEY_DEL_TEXT,
  },

  // Quote reveal overlay
  quoteRevealOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  quoteRevealCard: {
    backgroundColor: PALETTE.cream,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    maxWidth: '90%',
  },
  quoteRevealLabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.stoneGrey,
    marginBottom: 12,
  },
  quoteRevealText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 18,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    lineHeight: 26,
  },
});
