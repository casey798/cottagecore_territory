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
import Orientation from 'react-native-orientation-locker';
import { CLAN_COLORS, KEYBOARD, PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { CIPHER_STONES_TIME_LIMIT } from '@/constants/config';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import type { ClanId } from '@/types';
import { generatePuzzle, checkGuess, getProgress } from '../cipher-stones/CipherStonesLogic';
import type { CipherPuzzle } from '../cipher-stones/CipherStonesLogic';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import { CoopDivider } from '@/components/minigames/CoopDivider';

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

// ── Keyboard split: vowels vs consonants ─────────────────────────
export const VOWEL_KEYS = ['A', 'E', 'I', 'O', 'U'] as const;
export const CONSONANT_KEYS = ['B','C','D','F','G','H','J','K','L','M','N','P','Q','R','S','T','V','W','X','Y','Z'] as const;

const P1_ROWS: string[][] = [
  ['A', 'E', 'I'],
  ['O', 'U', 'DEL'],
];
const P2_ROWS: string[][] = [
  ['B', 'C', 'D', 'F', 'G', 'H', 'J'],
  ['K', 'L', 'M', 'N', 'P', 'Q', 'R'],
  ['S', 'T', 'V', 'W', 'X', 'Y', 'Z', 'DEL'],
];

// ── Keyboard styling constants ───────────────────────────────────
const KEY_H_GAP = 4;
const KEY_V_GAP = 6;
const KEY_HEIGHT = 48;
const KB_H_PAD = 12;

// ── Tile constants ───────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_SIZE = Math.floor((SCREEN_WIDTH - 32) / 16);
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
  const { sessionId, timeLimit, onComplete, puzzleData, practiceMode } = props;
  const gameDuration = timeLimit > 0 ? timeLimit : CIPHER_STONES_TIME_LIMIT;

  const p1Name = (puzzleData?.p1Name as string | undefined) ?? 'Player 1';
  const p1Clan = (puzzleData?.p1Clan as string | undefined) ?? 'ember';
  const p2Name = (puzzleData?.p2Name as string | undefined) ?? 'Player 2';
  const p2Clan = (puzzleData?.p2Clan as string | undefined) ?? 'tide';

  // ── Portrait lock ──────────────────────────────────────────────
  useEffect(() => {
    Orientation.lockToPortrait();
    return () => {
      Orientation.unlockAllOrientations();
    };
  }, []);

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
  const [timeLeft, setTimeLeft] = useState(gameDuration);
  const [gameOver, setGameOver] = useState(false);
  const [showQuoteReveal, setShowQuoteReveal] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

  const startTimeRef = useRef(Date.now());
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const userMappingsRef = useRef(userMappings);
  const onCompleteRef = useRef(onComplete);
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

  useEffect(() => { userMappingsRef.current = userMappings; }, [userMappings]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const progress = getProgress(puzzle.solution, userMappings, quoteEncodedSet);

  // ── Timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, gameDuration - elapsed);
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
            solutionData: { mappings: userMappingsRef.current, solved: false },
          };
          setShowQuoteReveal(true);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [gameOver, gameDuration, sessionId]);

  // Quote reveal -> auto-complete after 2.5s
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

  // ── How to Play ─────────────────────────────────────────────────

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
                solutionData: { mappings: newMappings, solved: true },
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
  // P1 has 3 keys per row, P2 has up to 8 keys per row
  const p1KeyWidth = (SCREEN_WIDTH - KB_H_PAD * 2 - KEY_H_GAP * 2) / 3;
  const p2KeyWidth = (SCREEN_WIDTH - KB_H_PAD * 2 - KEY_H_GAP * 7) / 8;

  // ── Render keyboard zone ────────────────────────────────────────
  const renderKeyboard = (rows: string[][], keyWidth: number) => (
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

  // ── Progress bar JSX ────────────────────────────────────────────
  const progressBar = (
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
  );

  // ── Cipher tiles (rendered inside CoopDivider children) ─────────
  const cipherTiles = (
    <View style={styles.cipherWrap}>
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
    </View>
  );

  return (
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Help button */}
      <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
        <Text style={styles.helpBtnText}>?</Text>
      </TouchableOpacity>

      {/* P1 Zone — top (Vowels) */}
      <View style={[styles.playerZone, { backgroundColor: withAlpha(clanColor(p1Clan), 0.1) }]}>
        <Text style={styles.zoneLabel}>Vowels</Text>
        {renderKeyboard(P1_ROWS, p1KeyWidth)}
        {progressBar}
      </View>

      {/* CoopDivider with cipher tiles */}
      <CoopDivider
        p1Name={p1Name}
        p1Clan={p1Clan}
        p2Name={p2Name}
        p2Clan={p2Clan}
        timeLeft={timeLeft}
        totalTime={gameDuration}
      >
        {cipherTiles}
      </CoopDivider>

      {/* P2 Zone — bottom (Consonants) */}
      <View style={[styles.playerZone, { backgroundColor: withAlpha(clanColor(p2Clan), 0.1) }]}>
        <Text style={styles.zoneLabel}>Consonants</Text>
        {renderKeyboard(P2_ROWS, p2KeyWidth)}
        {progressBar}
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
        <GameCompleteOverlay
          result={overlayResult}
          onContinue={handleContinue}
          practiceMode={practiceMode}
          revealQuote={decodedQuote}
        />
      )}

      {/* How to Play modal */}
      <Modal animationType="slide" transparent visible={isHowToPlayVisible} onRequestClose={closeHowToPlay}>
        <Pressable style={styles.modalBackdrop} onPress={closeHowToPlay}>
          <Pressable style={styles.modalPanel} onPress={() => {}}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={closeHowToPlay}>
              <Text style={styles.modalCloseBtnText}>{'\u00D7'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Cipher Stones (Co-op)</Text>
            <Text style={styles.modalRule}>{'\u2022'} A famous quote is encrypted with a substitution cipher.</Text>
            <Text style={styles.modalRule}>{'\u2022'} Player 1 controls vowel substitutions. Player 2 controls consonant substitutions.</Text>
            <Text style={styles.modalRule}>{'\u2022'} Tap a cipher letter in your zone, then tap the real letter you think it maps to.</Text>
            <Text style={styles.modalRule}>{'\u2022'} Both players work on the same shared cipher board — your corrections appear for your partner instantly.</Text>
            <Text style={styles.modalRule}>{'\u2022'} Decode the entire quote before time runs out to win.</Text>
            <Text style={styles.modalTip}>Tip: Reveal hints (up to 3) if you{'\u2019'}re stuck — but there{'\u2019'}s a cooldown between them.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Player zones
  playerZone: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  zoneLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    paddingVertical: 2,
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

  // Cipher tiles (vertical wrap layout)
  cipherWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
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

  // Word layout
  word: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  wordSpace: {
    width: TILE_SIZE * 0.6,
    marginBottom: 2,
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
    backgroundColor: UI.overlay,
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

  // Help button (absolute positioned)
  helpBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
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
