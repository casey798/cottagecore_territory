import {
  generatePuzzle,
  evaluateGuess,
  validateSolution,
  isValidWord,
  type LetterResult,
} from '../GroveWordsLogic';
import { ANSWER_WORDS, getValidWordSet } from '../wordlist';

// ── generatePuzzle ───────────────────────────────────────────────────

describe('generatePuzzle', () => {
  it('returns a valid 5-letter word from the answer pool', () => {
    const puzzle = generatePuzzle();
    expect(puzzle.word).toHaveLength(5);
    expect(getValidWordSet().has(puzzle.word)).toBe(true);
  });

  it('returns 6 allowed guesses', () => {
    const puzzle = generatePuzzle();
    expect(puzzle.allowedGuesses).toBe(6);
  });

  it('picks from the answer word pool', () => {
    const answerSet = new Set(ANSWER_WORDS);
    for (let i = 0; i < 50; i++) {
      const puzzle = generatePuzzle();
      expect(answerSet.has(puzzle.word)).toBe(true);
    }
  });
});

// ── isValidWord ──────────────────────────────────────────────────────

describe('isValidWord', () => {
  it('returns true for a word in the list', () => {
    expect(isValidWord('BLOOM')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isValidWord('bloom')).toBe(true);
    expect(isValidWord('Bloom')).toBe(true);
  });

  it('returns false for a word NOT in the list', () => {
    expect(isValidWord('ZZZZZ')).toBe(false);
    expect(isValidWord('XYZQW')).toBe(false);
  });

  it('returns true for a valid guess that is not an answer word', () => {
    expect(isValidWord('HELLO')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isValidWord('')).toBe(false);
  });

  it('returns false for wrong length', () => {
    expect(isValidWord('HI')).toBe(false);
    expect(isValidWord('BLOOMING')).toBe(false);
  });
});

// ── evaluateGuess ────────────────────────────────────────────────────

describe('evaluateGuess', () => {
  it('marks all correct when guess matches target', () => {
    const result = evaluateGuess('BLOOM', 'BLOOM');
    expect(result).toEqual<LetterResult[]>([
      'correct', 'correct', 'correct', 'correct', 'correct',
    ]);
  });

  it('marks all absent when no letters match', () => {
    const result = evaluateGuess('THYME', 'BROOK');
    expect(result).toEqual<LetterResult[]>([
      'absent', 'absent', 'absent', 'absent', 'absent',
    ]);
  });

  it('handles mixed correct, present, and absent', () => {
    // Target: GROVE, Guess: GLEAM
    // G = correct, L = absent, E = present, A = absent, M = absent
    const result = evaluateGuess('GLEAM', 'GROVE');
    expect(result).toEqual<LetterResult[]>([
      'correct', 'absent', 'present', 'absent', 'absent',
    ]);
  });

  it('handles present letters in wrong position', () => {
    // CEDAR = C(0) E(1) D(2) A(3) R(4)
    // ACORN = A(0) C(1) O(2) R(3) N(4)
    const result = evaluateGuess('ACORN', 'CEDAR');
    expect(result).toEqual<LetterResult[]>([
      'present', 'present', 'absent', 'present', 'absent',
    ]);
  });

  it('handles duplicate letters in guess - one correct, one absent', () => {
    // STONE = S(0) T(1) O(2) N(3) E(4)
    // STEEL = S(0) T(1) E(2) E(3) L(4)
    const result = evaluateGuess('STEEL', 'STONE');
    expect(result).toEqual<LetterResult[]>([
      'correct', 'correct', 'present', 'absent', 'absent',
    ]);
  });

  it('handles duplicate letters in guess - exact match consumes first', () => {
    // CREEK = C(0) R(1) E(2) E(3) K(4)
    // REEDS = R(0) E(1) E(2) D(3) S(4)
    const result = evaluateGuess('REEDS', 'CREEK');
    expect(result).toEqual<LetterResult[]>([
      'present', 'present', 'correct', 'absent', 'absent',
    ]);
  });

  it('is case-insensitive', () => {
    const result = evaluateGuess('bloom', 'BLOOM');
    expect(result).toEqual<LetterResult[]>([
      'correct', 'correct', 'correct', 'correct', 'correct',
    ]);
  });
});

// ── validateSolution ─────────────────────────────────────────────────

describe('validateSolution', () => {
  const puzzle = { word: 'GROVE', allowedGuesses: 6 };

  it('returns solved=true when last guess matches the word', () => {
    const result = validateSolution(puzzle, {
      guesses: ['BLOOM', 'CREEK', 'GROVE'],
      solved: true,
    });
    expect(result.solved).toBe(true);
  });

  it('returns solved=false when last guess does not match', () => {
    const result = validateSolution(puzzle, {
      guesses: ['BLOOM', 'CREEK', 'STONE'],
      solved: false,
    });
    expect(result.solved).toBe(false);
  });

  it('returns solved=false when no guesses submitted', () => {
    const result = validateSolution(puzzle, {
      guesses: [],
      solved: false,
    });
    expect(result.solved).toBe(false);
  });

  it('returns solved=false when correct guess exceeds allowed limit', () => {
    const tightPuzzle = { word: 'GROVE', allowedGuesses: 2 };
    const result = validateSolution(tightPuzzle, {
      guesses: ['BLOOM', 'CREEK', 'GROVE'],
      solved: true,
    });
    expect(result.solved).toBe(false);
  });

  it('is case-insensitive for matching', () => {
    const result = validateSolution(puzzle, {
      guesses: ['grove'],
      solved: true,
    });
    expect(result.solved).toBe(true);
  });
});
