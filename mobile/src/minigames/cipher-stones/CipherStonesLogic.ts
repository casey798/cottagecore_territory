import quoteDatabase from './quotedatabase';

export interface CipherPuzzle {
  encodedQuote: string;
  revealedLetters: Record<string, string>;
  solution: Record<string, string>;
  quoteLength: number;
}

export interface Progress {
  total: number;
  decoded: number;
}

export const MINIGAME_CONFIG = {
  preRevealCount: 5,
  timeLimit: 120,
  hintCooldown: 60,
} as const;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function isLetter(ch: string): boolean {
  return /^[A-Z]$/i.test(ch);
}

/**
 * Generate a random permutation of the 26-letter alphabet (Fisher-Yates).
 */
function randomPermutation(): string[] {
  const arr = ALPHABET.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a cipher puzzle from a random quote.
 * Returns encoded quote, pre-revealed hint letters (always E and T + random others), and the full solution map.
 */
export function generatePuzzle(): CipherPuzzle {
  const quote = quoteDatabase[Math.floor(Math.random() * quoteDatabase.length)];
  const upperQuote = quote.toUpperCase();

  // Build substitution cipher: plain letter → encoded letter
  const perm = randomPermutation();
  const plainToEncoded: Record<string, string> = {};
  const encodedToPlain: Record<string, string> = {};
  for (let i = 0; i < 26; i++) {
    plainToEncoded[ALPHABET[i]] = perm[i];
    encodedToPlain[perm[i]] = ALPHABET[i];
  }

  // Encode the quote — only letters are substituted
  let encodedQuote = '';
  for (const ch of upperQuote) {
    if (isLetter(ch)) {
      encodedQuote += plainToEncoded[ch];
    } else {
      encodedQuote += ch;
    }
  }

  // Find unique encoded letters that appear in the quote
  const usedEncoded = new Set<string>();
  for (const ch of encodedQuote) {
    if (isLetter(ch)) {
      usedEncoded.add(ch);
    }
  }

  // Pre-reveal letters: always E and T, plus random others from quote letters
  const revealedLetters: Record<string, string> = {};

  // Always reveal E and T (find their encoded forms)
  const encodedE = plainToEncoded['E'];
  const encodedT = plainToEncoded['T'];
  revealedLetters[encodedE] = 'E';
  revealedLetters[encodedT] = 'T';

  // Pick remaining slots from encoded letters that appear in the quote, excluding E and T
  const extraSlots = MINIGAME_CONFIG.preRevealCount - 2;
  const candidates = Array.from(usedEncoded).filter(
    (enc) => enc !== encodedE && enc !== encodedT,
  );
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  const extraCount = Math.min(extraSlots, shuffled.length);
  for (let i = 0; i < extraCount; i++) {
    const enc = shuffled[i];
    revealedLetters[enc] = encodedToPlain[enc];
  }

  return {
    encodedQuote,
    revealedLetters,
    solution: encodedToPlain,
    quoteLength: quote.length,
  };
}

/**
 * Check if all encoded letters in the quote have the correct decoded mapping.
 */
export function checkGuess(
  solution: Record<string, string>,
  userMappings: Record<string, string>,
): boolean {
  // Only verify letters the user has actually mapped (quote letters + revealed).
  // solution contains all 26 alphabet entries, but userMappings only has quote letters.
  for (const [encoded, decoded] of Object.entries(userMappings)) {
    if (solution[encoded] !== decoded) {
      return false;
    }
  }
  return true;
}

/**
 * Count how many unique encoded letters in the quote are correctly decoded vs total.
 * Only counts letter characters (not spaces/punctuation).
 */
export function getProgress(
  solution: Record<string, string>,
  userMappings: Record<string, string>,
): Progress {
  let total = 0;
  let decoded = 0;
  for (const [encoded, plain] of Object.entries(solution)) {
    total++;
    if (userMappings[encoded] === plain) {
      decoded++;
    }
  }
  return { total, decoded };
}
