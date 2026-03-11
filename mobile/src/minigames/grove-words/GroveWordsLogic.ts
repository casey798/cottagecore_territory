/**
 * Grove Words - Pure game logic (no React dependencies).
 */
import { ANSWER_WORDS, getValidWordSet } from './wordlist';

// ── Types ────────────────────────────────────────────────────────────

export type LetterResult = 'correct' | 'present' | 'absent';

export interface Puzzle {
  word: string;
  allowedGuesses: number;
}

export interface Submission {
  guesses: string[];
  solved: boolean;
}

// ── Constants ────────────────────────────────────────────────────────

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

// ── Public API ───────────────────────────────────────────────────────

/**
 * Generate a puzzle by selecting a random word from the curated answer pool.
 */
export function generatePuzzle(): Puzzle {
  const index = Math.floor(Math.random() * ANSWER_WORDS.length);
  return {
    word: ANSWER_WORDS[index],
    allowedGuesses: MAX_GUESSES,
  };
}

/**
 * Check whether a word exists in the valid word list.
 */
export function isValidWord(word: string): boolean {
  if (!word || word.length !== WORD_LENGTH) {
    return false;
  }
  return getValidWordSet().has(word.toUpperCase());
}

/**
 * Evaluate a 5-letter guess against the target word.
 * Returns an array of 5 LetterResult values.
 *
 * Algorithm handles duplicate letters correctly:
 *  1. First pass: mark exact matches ('correct') and count remaining target letters.
 *  2. Second pass: mark 'present' only if the letter still has unmatched occurrences.
 */
export function evaluateGuess(guess: string, target: string): LetterResult[] {
  const g = guess.toUpperCase();
  const t = target.toUpperCase();

  const results: LetterResult[] = new Array<LetterResult>(WORD_LENGTH).fill('absent');

  // Count remaining (unmatched) letters in target
  const remaining: Record<string, number> = {};

  // First pass -- exact matches
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === t[i]) {
      results[i] = 'correct';
    } else {
      remaining[t[i]] = (remaining[t[i]] ?? 0) + 1;
    }
  }

  // Second pass -- present but wrong position
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (results[i] === 'correct') continue;
    const letter = g[i];
    if ((remaining[letter] ?? 0) > 0) {
      results[i] = 'present';
      remaining[letter] -= 1;
    }
  }

  return results;
}

/**
 * Validate a completed submission against the puzzle.
 */
export function validateSolution(
  puzzle: Puzzle,
  submission: Submission,
): { solved: boolean } {
  if (!submission.guesses.length) {
    return { solved: false };
  }

  const lastGuess = submission.guesses[submission.guesses.length - 1];
  const solved =
    lastGuess.toUpperCase() === puzzle.word.toUpperCase() &&
    submission.guesses.length <= puzzle.allowedGuesses;

  return { solved };
}
