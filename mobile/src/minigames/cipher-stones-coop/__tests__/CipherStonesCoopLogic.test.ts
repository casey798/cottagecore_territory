import {
  P1_KEYS,
  P2_KEYS,
  applyKeyToMappings,
  allQuoteLettersMapped,
} from '../CipherStonesCoopGame';
import { generatePuzzle, checkGuess } from '../../cipher-stones/CipherStonesLogic';

// ── Keyboard split ────────────────────────────────────────────────

describe('CipherStonesCoop: keyboard split', () => {
  it('P1 has exactly keys A through M (13 keys)', () => {
    expect(P1_KEYS).toHaveLength(13);
    const expected = 'ABCDEFGHIJKLM'.split('');
    expect([...P1_KEYS]).toEqual(expected);
  });

  it('P2 has exactly keys N through Z (13 keys)', () => {
    expect(P2_KEYS).toHaveLength(13);
    const expected = 'NOPQRSTUVWXYZ'.split('');
    expect([...P2_KEYS]).toEqual(expected);
  });

  it('P1 and P2 keys have no overlap', () => {
    const p1Set = new Set<string>(P1_KEYS);
    for (const key of P2_KEYS) {
      expect(p1Set.has(key)).toBe(false);
    }
  });

  it('union of P1 and P2 covers the full 26-letter alphabet', () => {
    const all: Set<string> = new Set([...P1_KEYS, ...P2_KEYS]);
    expect(all.size).toBe(26);
    for (let i = 0; i < 26; i++) {
      expect(all.has(String.fromCharCode(65 + i))).toBe(true);
    }
  });
});

// ── Shared mapping update ─────────────────────────────────────────

describe('CipherStonesCoop: shared mapping update from either zone', () => {
  const revealed = new Set<string>();

  it('P1 key press updates the shared mapping', () => {
    const mappings: Record<string, string> = {};
    const result = applyKeyToMappings(mappings, 'X', 'A', revealed);
    expect(result).toEqual({ X: 'A' });
  });

  it('P2 key press updates the same shared mapping', () => {
    const mappings: Record<string, string> = { X: 'A' };
    const result = applyKeyToMappings(mappings, 'Y', 'N', revealed);
    expect(result).toEqual({ X: 'A', Y: 'N' });
  });

  it('prevents duplicate decoded mapping (same letter assigned to different encoded)', () => {
    const mappings: Record<string, string> = { X: 'A' };
    const result = applyKeyToMappings(mappings, 'Y', 'A', revealed);
    // Should return same object (no change) since 'A' is already mapped to 'X'
    expect(result).toBe(mappings);
  });

  it('allows reassigning the same encoded letter to a different decoded letter', () => {
    const mappings: Record<string, string> = { X: 'A' };
    const result = applyKeyToMappings(mappings, 'X', 'B', revealed);
    expect(result).toEqual({ X: 'B' });
  });

  it('returns same reference when selectedEncoded is null', () => {
    const mappings: Record<string, string> = { X: 'A' };
    const result = applyKeyToMappings(mappings, null, 'B', revealed);
    expect(result).toBe(mappings);
  });
});

// ── DEL clears mapping ────────────────────────────────────────────

describe('CipherStonesCoop: DEL clears mapping', () => {
  it('DEL removes the mapping for the selected encoded letter', () => {
    const mappings: Record<string, string> = { X: 'A', Y: 'B' };
    const result = applyKeyToMappings(mappings, 'X', 'DEL', new Set());
    expect(result).toEqual({ Y: 'B' });
    expect(result).not.toHaveProperty('X');
  });

  it('DEL does nothing if the selected letter has no mapping', () => {
    const mappings: Record<string, string> = { Y: 'B' };
    const result = applyKeyToMappings(mappings, 'X', 'DEL', new Set());
    expect(result).toBe(mappings);
  });

  it('DEL does nothing if the selected letter is pre-revealed', () => {
    const mappings: Record<string, string> = { X: 'A' };
    const revealed = new Set(['X']);
    const result = applyKeyToMappings(mappings, 'X', 'DEL', revealed);
    expect(result).toBe(mappings);
  });
});

// ── Win detection ─────────────────────────────────────────────────

describe('CipherStonesCoop: win detection when all letters mapped', () => {
  it('detects all quote letters mapped', () => {
    const quoteSet = new Set(['A', 'B', 'C']);
    const mappings = { A: 'X', B: 'Y', C: 'Z' };
    expect(allQuoteLettersMapped(quoteSet, mappings)).toBe(true);
  });

  it('returns false when some quote letters unmapped', () => {
    const quoteSet = new Set(['A', 'B', 'C']);
    const mappings = { A: 'X', B: 'Y' };
    expect(allQuoteLettersMapped(quoteSet, mappings)).toBe(false);
  });

  it('win detected with a real puzzle when solution mappings are applied', () => {
    const puzzle = generatePuzzle();
    // Build correct mappings for all quote-appearing letters
    const quoteSet = new Set<string>();
    for (const ch of puzzle.encodedQuote) {
      if (/^[A-Z]$/.test(ch)) quoteSet.add(ch);
    }
    const correctMappings: Record<string, string> = {};
    for (const enc of quoteSet) {
      correctMappings[enc] = puzzle.solution[enc];
    }

    expect(allQuoteLettersMapped(quoteSet, correctMappings)).toBe(true);
    expect(checkGuess(puzzle.solution, correctMappings)).toBe(true);
  });

  it('wrong mappings fail checkGuess even when all letters mapped', () => {
    const puzzle = generatePuzzle();
    const quoteSet = new Set<string>();
    for (const ch of puzzle.encodedQuote) {
      if (/^[A-Z]$/.test(ch)) quoteSet.add(ch);
    }
    // Map every letter to 'A' (guaranteed wrong for most)
    const wrongMappings: Record<string, string> = {};
    for (const enc of quoteSet) {
      wrongMappings[enc] = 'A';
    }

    expect(allQuoteLettersMapped(quoteSet, wrongMappings)).toBe(true);
    expect(checkGuess(puzzle.solution, wrongMappings)).toBe(false);
  });
});
