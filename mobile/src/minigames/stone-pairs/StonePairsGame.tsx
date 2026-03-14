/**
 * Stone Pairs — Memory matching minigame component (portrait mode).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import type { MinigamePlayProps } from '@/types/minigame';
import {
  CardData,
  StonePairsPuzzle,
  checkMatch,
  generatePuzzle,
  validateSolution,
} from './StonePairsLogic';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLIP_BACK_DELAY = 800;
const CARD_GAP = 6;
const GRID_PADDING = 12;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StonePairsGame({
  sessionId,
  timeLimit,
  onComplete,
}: MinigamePlayProps) {
  // ---- Puzzle generation (once, client-side) --------------------------------
  const puzzleRef = useRef<StonePairsPuzzle | null>(null);
  if (puzzleRef.current === null) {
    puzzleRef.current = generatePuzzle();
  }
  const puzzle = puzzleRef.current;

  // ---- State -------------------------------------------------------------
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [selected, setSelected] = useState<number[]>([]);
  const [flipping, setFlipping] = useState(false);
  const [totalFlips, setTotalFlips] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit > 0 ? timeLimit : 60);
  const [gameOver, setGameOver] = useState(false);

  const matchedPairsRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);

  // ---- Derived layout (strict 4×4 grid, sized to fit screen) ---------------
  const { cols, rows } = puzzle;
  const { width: screenW, height: screenH } = Dimensions.get('window');
  // Reserve space for header (~80px) and top padding
  const availableHeight = screenH - 120;
  const availableWidth = screenW - GRID_PADDING * 2;
  const cardFromWidth = Math.floor((availableWidth - CARD_GAP * (cols - 1)) / cols);
  const cardFromHeight = Math.floor((availableHeight - CARD_GAP * (rows - 1)) / rows);
  const cardSize = Math.min(cardFromWidth, cardFromHeight);
  const gridWidth = cardSize * cols + CARD_GAP * (cols - 1);

  // ---- Complete handler (fire only once) ---------------------------------
  const completeGame = useCallback(
    (result: 'win' | 'lose' | 'timeout', flips: number, solved: boolean) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, result, timeTaken);

      onComplete({
        result,
        timeTaken,
        completionHash,
        solutionData: { totalFlips: flips, solved },
      });
    },
    [onComplete, sessionId],
  );

  // ---- Timer (Date.now delta, NOT setTimeout drift) ----------------------
  useEffect(() => {
    const effectiveTimeLimit = timeLimit > 0 ? timeLimit : 60;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, effectiveTimeLimit - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        completeGame('timeout', totalFlips, false);
      }
    }, 250);

    return () => clearInterval(interval);
    // totalFlips is captured at timeout moment via closure — acceptable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeGame, timeLimit]);

  // ---- Card tap handler --------------------------------------------------
  const handleCardPress = useCallback(
    (cardId: number) => {
      if (gameOver || flipping) return;
      if (matched.has(cardId) || revealed.has(cardId)) return;
      if (selected.length >= 2) return;

      const newRevealed = new Set(revealed);
      newRevealed.add(cardId);
      setRevealed(newRevealed);

      const newSelected = [...selected, cardId];
      setSelected(newSelected);
      const newFlips = totalFlips + 1;
      setTotalFlips(newFlips);

      if (newSelected.length === 2) {
        const card1 = puzzle.cards[newSelected[0]];
        const card2 = puzzle.cards[newSelected[1]];

        if (checkMatch(card1, card2)) {
          // Match found — keep cards revealed
          const newMatched = new Set(matched);
          newMatched.add(newSelected[0]);
          newMatched.add(newSelected[1]);
          setMatched(newMatched);
          setSelected([]);

          matchedPairsRef.current += 1;

          // Check win
          const { solved } = validateSolution(puzzle, {
            matchedPairs: matchedPairsRef.current,
          });
          if (solved) {
            completeGame('win', newFlips, true);
          }
        } else {
          // No match — flip back after delay
          setFlipping(true);
          setTimeout(() => {
            setRevealed((prev) => {
              const next = new Set(prev);
              next.delete(newSelected[0]);
              next.delete(newSelected[1]);
              return next;
            });
            setSelected([]);
            setFlipping(false);
          }, FLIP_BACK_DELAY);
        }
      }
    },
    [gameOver, flipping, matched, revealed, selected, puzzle, totalFlips, completeGame],
  );

  // ---- Render helpers ----------------------------------------------------
  const renderCard = (card: CardData) => {
    const isRevealed = revealed.has(card.id) || matched.has(card.id);

    return (
      <TouchableOpacity
        key={card.id}
        activeOpacity={0.7}
        onPress={() => handleCardPress(card.id)}
        disabled={gameOver || flipping || isRevealed}
        style={[
          styles.card,
          {
            width: cardSize,
            height: cardSize,
            backgroundColor: isRevealed ? PALETTE.cream : PALETTE.stoneGrey,
            borderColor: matched.has(card.id) ? PALETTE.softGreen : PALETTE.warmBrown,
            borderWidth: matched.has(card.id) ? 3 : 2,
          },
        ]}
      >
        {isRevealed ? (
          <Text style={[styles.cardIcon, { fontSize: cardSize * 0.45 }]}>
            {card.iconLabel}
          </Text>
        ) : (
          <Text style={[styles.cardBack, { fontSize: cardSize * 0.3 }]}>?</Text>
        )}
      </TouchableOpacity>
    );
  };

  // ---- Timer bar fraction ------------------------------------------------
  const effectiveTimeLimit = timeLimit > 0 ? timeLimit : 60;
  const timerFraction = Math.max(0, Math.min(1, timeLeft / effectiveTimeLimit));

  // ---- Render grid rows --------------------------------------------------
  const gridRows: CardData[][] = [];
  for (let r = 0; r < rows; r++) {
    gridRows.push(puzzle.cards.slice(r * cols, r * cols + cols));
  }

  return (
    <View style={styles.container}>
      {/* Header: timer + flip count */}
      <View style={styles.header}>
        <View style={styles.timerBarContainer}>
          <View
            style={[
              styles.timerBarFill,
              {
                width: `${timerFraction * 100}%`,
                backgroundColor:
                  timerFraction > 0.3 ? PALETTE.softGreen : PALETTE.mutedRose,
              },
            ]}
          />
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.timerText}>{Math.ceil(timeLeft)}s</Text>
          <Text style={styles.flipText}>Flips: {totalFlips}</Text>
        </View>
      </View>

      {/* Card grid */}
      <View style={[styles.grid, { width: gridWidth }]}>
        {gridRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((card) => renderCard(card))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
    alignItems: 'center',
    paddingTop: 24,
  },
  header: {
    width: '90%',
    marginBottom: 16,
  },
  timerBarContainer: {
    height: 10,
    borderRadius: 5,
    backgroundColor: PALETTE.stoneGrey,
    overflow: 'hidden',
    marginBottom: 8,
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 18,
    color: UI.text,
  },
  flipText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 16,
    color: UI.textMuted,
  },
  grid: {
    alignItems: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  card: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  cardIcon: {
    textAlign: 'center',
  },
  cardBack: {
    fontFamily: FONTS.headerBold,
    color: PALETTE.cream,
    textAlign: 'center',
  },
});
