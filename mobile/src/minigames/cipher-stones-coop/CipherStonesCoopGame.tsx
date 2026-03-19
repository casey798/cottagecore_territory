import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
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
import { generatePuzzle, checkGuess, getProgress } from '../cipher-stones/CipherStonesLogic';
import type { CipherPuzzle } from '../cipher-stones/CipherStonesLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import { CoopDivider } from '@/components/minigames/CoopDivider';

// ── Keyboard split ────────────────────────────────────────────────
export const P1_KEYS = ['A','B','C','D','E','F','G','H','I','J','K','L','M'] as const;
export const P2_KEYS = ['N','O','P','Q','R','S','T','U','V','W','X','Y','Z'] as const;

const P1_ROWS: string[][] = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  ['H', 'I', 'J', 'K', 'L', 'M', 'DEL'],
];
const P2_ROWS: string[][] = [
  ['N', 'O', 'P', 'Q', 'R', 'S', 'T'],
  ['U', 'V', 'W', 'X', 'Y', 'Z', 'DEL'],
];

// ── Keyboard styling constants (mirrored from CipherStonesGame) ──
const KEY_DEFAULT_BG = '#D3D6DA';
const KEY_DEFAULT_TEXT = '#1A1A1B';
const KEY_DEL_BG = '#3A3A3C';
const KEY_DEL_TEXT = '#FFFFFF';
const KEY_H_GAP = 4;
const KEY_V_GAP = 6;
const KEY_HEIGHT = 48;
const KB_H_PAD = 12;

// ── Tile constants (mirrored from CipherStonesGame) ──────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_SIZE = Math.floor((SCREEN_WIDTH - 48) / 14);
const TILE_GAP = 3;

const QUOTE_REVEAL_DURATION_MS = 2500;

// ── Helpers ───────────────────────────────────────────────────────

function isLetter(ch: string): boolean {
  return /^[A-Z]$/.test(ch);
}

function clanColor(clan: string): string {
  return CLAN_COLORS[clan as ClanId] ?? PALETTE.stoneGrey;
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return hex + a;
}

/**
 * Apply a key press to the shared mappings. Returns the new mappings
 * (or the same object reference if nothing changed).
 * Exported for unit testing.
 */
export function applyKeyToMappings(
  mappings: Record<string, string>,
  selectedEncoded: string | null,
  key: string,
  revealedEncodedSet: ReadonlySet<string>,
): Record<string, string> {
  if (selectedEncoded === null) return mappings;

  if (key === 'DEL') {
    if (revealedEncodedSet.has(selectedEncoded)) return mappings;
    if (!mappings[selectedEncoded]) return mappings;
    const next = { ...mappings };
    delete next[selectedEncoded];
    return next;
  }

  // Check duplicate: decoded letter already mapped to a different encoded letter
  for (const [enc, dec] of Object.entries(mappings)) {
    if (dec === key && enc !== selectedEncoded) return mappings;
  }

  return { ...mappings, [selectedEncoded]: key };
}

/**
 * Check if every encoded letter that appears in the quote has a mapping.
 * Exported for unit testing.
 */
export function allQuoteLettersMapped(
  quoteEncodedSet: ReadonlySet<string>,
  mappings: Record<string, string>,
): boolean {
  for (const enc of quoteEncodedSet) {
    if (!mappings[enc]) return false;
  }
  return true;
}

// ── Memoised tile ─────────────────────────────────────────────────

interface CoopTileProps {
  encoded: string;
  decoded: string | undefined;
  isSelected: boolean;
  isRevealed: boolean;
  disabled: boolean;
  onPress: (encoded: string) => void;
}

const CoopTile = React.memo(function CoopTile({
  encoded,
  decoded,
  isSelected,
  isRevealed,
  disabled,
  onPress,
}: CoopTileProps) {
  const handlePress = useCallback(() => onPress(encoded), [onPress, encoded]);

  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled} activeOpacity={0.7}>
      <View
        style={[
          styles.tile,
          isSelected && styles.tileSelected,
          isRevealed && styles.tileRevealed,
        ]}
      >
        <Text style={styles.tileEncodedText}>{encoded}</Text>
        <Text
          style={[
            styles.tileDecodedText,
            isRevealed && styles.tileDecodedRevealed,
          ]}
        >
          {decoded ?? ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ── Main component ────────────────────────────────────────────────

export default function CipherStonesCoopGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, puzzleData } = props;

  const p1Name = (puzzleData?.p1Name as string | undefined) ?? 'Player 1';
  const p1Clan = (puzzleData?.p1Clan as string | undefined) ?? 'ember';
  const p2Name = (puzzleData?.p2Name as string | undefined) ?? 'Player 2';
  const p2Clan = (puzzleData?.p2Clan as string | undefined) ?? 'tide';

  // ── Puzzle (once on mount) ──────────────────────────────────────
  const puzzleRef = useRef<CipherPuzzle | null>(null);
  if (puzzleRef.current === null) {
    puzzleRef.current = generatePuzzle();
  }
  const puzzle = puzzleRef.current;

  // Decoded quote for end reveal
  const decodedQuote = useMemo(() => {
    let result = '';
    for (const ch of puzzle.encodedQuote) {
      result += isLetter(ch) ? (puzzle.solution[ch] || ch) : ch;
    }
    return result;
  }, [puzzle.encodedQuote, puzzle.solution]);

  // Set of revealed encoded letters (pre-revealed only — no hint system in coop)
  const revealedEncodedSet = useMemo(
    () => new Set(Object.keys(puzzle.revealedLetters)),
    [puzzle.revealedLetters],
  );

  // Unique encoded letters in the quote
  const quoteEncodedSet = useMemo(() => {
    const s = new Set<string>();
    for (const ch of puzzle.encodedQuote) {
      if (isLetter(ch)) s.add(ch);
    }
    return s;
  }, [puzzle.encodedQuote]);

  // Ordered encoded letters in the quote (for auto-advance)
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

  // Word groups for rendering tiles
  const words = useMemo(() => {
    const result: string[][] = [];
    let currentWord: string[] = [];
    for (const ch of puzzle.encodedQuote) {
      if (ch === ' ') {
        if (currentWord.length > 0) { result.push(currentWord); currentWord = []; }
        result.push([' ']);
      } else {
        currentWord.push(ch);
      }
    }
    if (currentWord.length > 0) result.push(currentWord);
    return result;
  }, [puzzle.encodedQuote]);

  // ── State ───────────────────────────────────────────────────────
  const [userMappings, setUserMappings] = useState<Record<string, string>>(
    () => ({ ...puzzle.revealedLetters }),
  );
  const [selectedEncoded, setSelectedEncoded] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [gameOver, setGameOver] = useState(false);
  const [showQuoteReveal, setShowQuoteReveal] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const userMappingsRef = useRef(userMappings);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { userMappingsRef.current = userMappings; }, [userMappings]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const progress = getProgress(puzzle.solution, userMappings);

  // ── Timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(remaining);

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
            solutionData: { mappings: userMappingsRef.current, completed: false },
          };
          setShowQuoteReveal(true);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [gameOver, timeLimit, sessionId]);

  // Quote reveal → auto-complete after 2.5s
  useEffect(() => {
    if (!showQuoteReveal) return;
    const timer = setTimeout(() => {
      if (pendingResultRef.current) {
        setOverlayResult(pendingResultRef.current.result === 'win' ? 'win' : 'lose');
        setOverlayVisible(true);
      }
    }, QUOTE_REVEAL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showQuoteReveal]);

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onCompleteRef.current(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, []);

  // ── Find next unsolved letter ───────────────────────────────────
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

  // ── Tile tap (shared — selects encoded letter) ──────────────────
  const handleTileTap = useCallback(
    (encodedChar: string) => {
      if (gameOver) return;
      if (revealedEncodedSet.has(encodedChar)) return;
      setSelectedEncoded(encodedChar);
    },
    [gameOver, revealedEncodedSet],
  );

  // ── Key press (shared handler for both zones) ───────────────────
  const handleKey = useCallback(
    (key: string) => {
      if (gameOver || selectedEncoded === null) return;

      if (key === 'DEL') {
        if (revealedEncodedSet.has(selectedEncoded)) return;
        setUserMappings((prev) => {
          if (!prev[selectedEncoded]) return prev;
          const next = { ...prev };
          delete next[selectedEncoded];
          return next;
        });
        return;
      }

      setUserMappings((prev) => {
        const newMappings = applyKeyToMappings(prev, selectedEncoded, key, revealedEncodedSet);
        if (newMappings === prev) return prev;

        // Check win
        if (allQuoteLettersMapped(quoteEncodedSet, newMappings)) {
          if (checkGuess(puzzle.solution, newMappings)) {
            if (!completedRef.current) {
              completedRef.current = true;
              setGameOver(true);
              const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
              const completionHash = generateClientCompletionHash(sessionId, 'win', timeTaken);
              pendingResultRef.current = {
                result: 'win',
                timeTaken,
                completionHash,
                solutionData: { mappings: newMappings, completed: true },
              };
              setShowQuoteReveal(true);
            }
            setSelectedEncoded(null);
            return newMappings;
          }
          // Wrong — just keep going (no pause/review in coop)
        }

        // Auto-advance
        const next = findNextUnsolved(selectedEncoded, newMappings);
        setSelectedEncoded(next);

        return newMappings;
      });
    },
    [gameOver, selectedEncoded, puzzle.solution, findNextUnsolved, quoteEncodedSet, sessionId, revealedEncodedSet],
  );

  // ── Key width computation ───────────────────────────────────────
  const keyWidth = (SCREEN_WIDTH - KB_H_PAD * 2 - KEY_H_GAP * 6) / 7;

  // ── Render keyboard zone ────────────────────────────────────────
  const renderKeyboard = (rows: string[][]) => (
    <View style={styles.keyboard}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.keyboardRow}>
          {row.map((key) => {
            const isDel = key === 'DEL';
            const label = isDel ? '\u232B' : key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.key,
                  { width: keyWidth },
                  isDel && styles.keyDel,
                ]}
                onPress={() => handleKey(key)}
                disabled={gameOver}
                activeOpacity={0.7}
              >
                <Text style={isDel ? styles.keyTextDel : styles.keyText}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  // ── Cipher tiles (rendered inside CoopDivider children) ─────────
  const cipherTiles = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.cipherScrollContent}
      style={styles.cipherScroll}
    >
      {words.map((word, wi) => {
        if (word.length === 1 && word[0] === ' ') {
          return <View key={`sp-${wi}`} style={styles.wordSpace} />;
        }
        return (
          <View key={`w-${wi}`} style={styles.word}>
            {word.map((ch, ci) => {
              if (!isLetter(ch)) {
                return (
                  <Text key={`p-${wi}-${ci}`} style={styles.punctuation}>{ch}</Text>
                );
              }
              const isPreRevealed = revealedEncodedSet.has(ch);
              return (
                <CoopTile
                  key={`t-${wi}-${ci}`}
                  encoded={ch}
                  decoded={userMappings[ch]}
                  isSelected={selectedEncoded === ch}
                  isRevealed={isPreRevealed}
                  disabled={gameOver || isPreRevealed}
                  onPress={handleTileTap}
                />
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      {/* P1 Zone — top */}
      <View style={[styles.playerZone, { backgroundColor: withAlpha(clanColor(p1Clan), 0.1) }]}>
        {renderKeyboard(P1_ROWS)}
        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: progress.total > 0 ? `${(progress.decoded / progress.total) * 100}%` : '0%' },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{progress.decoded}/{progress.total}</Text>
        </View>
      </View>

      {/* CoopDivider with cipher tiles */}
      <CoopDivider
        p1Name={p1Name}
        p1Clan={p1Clan}
        p2Name={p2Name}
        p2Clan={p2Clan}
        timeLeft={timeLeft}
        totalTime={timeLimit}
      >
        {cipherTiles}
      </CoopDivider>

      {/* P2 Zone — bottom */}
      <View style={[styles.playerZone, { backgroundColor: withAlpha(clanColor(p2Clan), 0.1) }]}>
        {renderKeyboard(P2_ROWS)}
      </View>

      {/* Quote reveal overlay */}
      {showQuoteReveal && !overlayVisible && (
        <View style={styles.quoteRevealOverlay}>
          <View style={styles.quoteRevealCard}>
            <Text style={styles.quoteRevealLabel}>The quote was:</Text>
            <Text style={styles.quoteRevealText}>{decodedQuote}</Text>
          </View>
        </View>
      )}

      {/* Game complete overlay */}
      {overlayVisible && (
        <GameCompleteOverlay result={overlayResult} onContinue={handleContinue} />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.background,
  },

  // Player zones
  playerZone: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },

  // Keyboard
  keyboard: {
    width: '100%',
    paddingHorizontal: KB_H_PAD,
    gap: KEY_V_GAP,
    paddingVertical: 4,
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

  // Cipher scroll (inside CoopDivider children)
  cipherScroll: {
    maxHeight: 60,
  },
  cipherScrollContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 2,
  },

  // Tiles (mirrored from CipherStonesGame)
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

  // Word layout
  word: {
    flexDirection: 'row',
  },
  wordSpace: {
    width: TILE_SIZE * 0.6,
  },
  punctuation: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: UI.text,
    alignSelf: 'center',
    paddingBottom: 2,
    marginHorizontal: 1,
  },

  // Progress bar
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: PALETTE.stoneGrey + '40',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: PALETTE.softGreen,
    borderRadius: 3,
  },
  progressText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: UI.text,
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
