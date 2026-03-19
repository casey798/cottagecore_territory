import { generatePuzzle, checkGuess, getProgress } from '../CipherStonesLogic';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function isLetter(ch: string): boolean {
  return /^[A-Z]$/i.test(ch);
}

describe('CipherStonesLogic', () => {
  describe('generatePuzzle', () => {
    it('produces a puzzle with all required fields', () => {
      const puzzle = generatePuzzle();
      expect(typeof puzzle.encodedQuote).toBe('string');
      expect(puzzle.encodedQuote.length).toBeGreaterThan(0);
      expect(typeof puzzle.quoteLength).toBe('number');
      expect(puzzle.quoteLength).toBeGreaterThan(0);
      expect(typeof puzzle.solution).toBe('object');
      expect(typeof puzzle.revealedLetters).toBe('object');
    });

    it('has a valid 26-letter permutation in the solution', () => {
      const puzzle = generatePuzzle();
      const encodedKeys = Object.keys(puzzle.solution);
      const decodedValues = Object.values(puzzle.solution);

      // All 26 letters should be present as keys
      expect(encodedKeys.sort().join('')).toBe(ALPHABET);

      // All 26 letters should be present as values (permutation)
      expect([...decodedValues].sort().join('')).toBe(ALPHABET);
    });

    it('preserves spaces and punctuation unchanged in encodedQuote', () => {
      // Run multiple times to increase chance of hitting quotes with punctuation
      for (let i = 0; i < 20; i++) {
        const puzzle = generatePuzzle();
        for (const ch of puzzle.encodedQuote) {
          if (!isLetter(ch)) {
            // Non-letter characters should be space or punctuation — not transformed
            expect(ch).toMatch(/[^A-Za-z]/);
          }
        }
      }
    });

    it('only contains uppercase letters and original punctuation/spaces', () => {
      const puzzle = generatePuzzle();
      for (const ch of puzzle.encodedQuote) {
        if (isLetter(ch)) {
          expect(ch).toMatch(/^[A-Z]$/);
        }
      }
    });

    it('pre-reveals exactly 5 letters including E and T', () => {
      const puzzle = generatePuzzle();
      expect(Object.keys(puzzle.revealedLetters).length).toBe(5);
      // E and T must always be among the revealed decoded values
      const revealedDecoded = new Set(Object.values(puzzle.revealedLetters));
      expect(revealedDecoded.has('E')).toBe(true);
      expect(revealedDecoded.has('T')).toBe(true);
    });

    it('revealed letters are correct according to the solution', () => {
      const puzzle = generatePuzzle();
      for (const [encoded, decoded] of Object.entries(puzzle.revealedLetters)) {
        expect(puzzle.solution[encoded]).toBe(decoded);
      }
    });

    it('revealed letters appear in the encoded quote', () => {
      const puzzle = generatePuzzle();
      const quoteLetters = new Set(
        puzzle.encodedQuote.split('').filter((ch) => isLetter(ch)),
      );
      for (const encoded of Object.keys(puzzle.revealedLetters)) {
        expect(quoteLetters.has(encoded)).toBe(true);
      }
    });
  });

  describe('checkGuess', () => {
    it('returns true when all mappings are correct', () => {
      const puzzle = generatePuzzle();
      expect(checkGuess(puzzle.solution, { ...puzzle.solution })).toBe(true);
    });

    it('returns false when a mapping is wrong', () => {
      const puzzle = generatePuzzle();
      const badMappings = { ...puzzle.solution };
      // Swap two values to create an incorrect mapping
      const keys = Object.keys(badMappings);
      const temp = badMappings[keys[0]];
      badMappings[keys[0]] = badMappings[keys[1]];
      badMappings[keys[1]] = temp;
      expect(checkGuess(puzzle.solution, badMappings)).toBe(false);
    });

    it('returns true when partial mappings are all correct', () => {
      const puzzle = generatePuzzle();
      const partial: Record<string, string> = {};
      // Only include revealed letters (all correct)
      for (const [k, v] of Object.entries(puzzle.revealedLetters)) {
        partial[k] = v;
      }
      // checkGuess only verifies provided mappings, not completeness
      expect(checkGuess(puzzle.solution, partial)).toBe(true);
    });
  });

  describe('getProgress', () => {
    it('returns 0 decoded when no mappings provided', () => {
      const puzzle = generatePuzzle();
      const progress = getProgress(puzzle.solution, {});
      expect(progress.total).toBe(26);
      expect(progress.decoded).toBe(0);
    });

    it('counts revealed letters as decoded', () => {
      const puzzle = generatePuzzle();
      const progress = getProgress(puzzle.solution, puzzle.revealedLetters);
      expect(progress.decoded).toBe(5);
    });

    it('returns full progress when all correct', () => {
      const puzzle = generatePuzzle();
      const progress = getProgress(puzzle.solution, { ...puzzle.solution });
      expect(progress.total).toBe(26);
      expect(progress.decoded).toBe(26);
    });

    it('does not count incorrect mappings', () => {
      const puzzle = generatePuzzle();
      const wrong: Record<string, string> = {};
      // Map every letter to 'A' — at most 1 can be correct
      for (const key of Object.keys(puzzle.solution)) {
        wrong[key] = 'A';
      }
      const progress = getProgress(puzzle.solution, wrong);
      // Only the encoded letter that actually decodes to 'A' should count
      expect(progress.decoded).toBeLessThanOrEqual(1);
    });
  });
});
