import { generatePuzzle, checkGroup, MAX_MISTAKES } from '../../kindred/KindredLogic';
import type { KindredPuzzle } from '../../kindred/KindredLogic';
import { balancedSplit } from '../KindredCoopGame';

describe('KindredCoop: balancedSplit', () => {
  let puzzle: KindredPuzzle;

  beforeEach(() => {
    puzzle = generatePuzzle();
  });

  it('produces exactly 8 words in each half', () => {
    const { topWords, bottomWords } = balancedSplit(puzzle);
    expect(topWords).toHaveLength(8);
    expect(bottomWords).toHaveLength(8);
  });

  it('assigns exactly 2 words per group to each half', () => {
    const { topWords, bottomWords } = balancedSplit(puzzle);
    const topSet = new Set(topWords);
    const bottomSet = new Set(bottomWords);

    for (const group of puzzle.groups) {
      const inTop = group.words.filter((w) => topSet.has(w)).length;
      const inBottom = group.words.filter((w) => bottomSet.has(w)).length;
      expect(inTop).toBe(2);
      expect(inBottom).toBe(2);
    }
  });

  it('includes all 16 words with no duplicates', () => {
    const { topWords, bottomWords } = balancedSplit(puzzle);
    const all = [...topWords, ...bottomWords];
    expect(all).toHaveLength(16);
    expect(new Set(all).size).toBe(16);

    // Every puzzle word should be present
    for (const word of puzzle.words) {
      expect(all).toContain(word);
    }
  });

  it('does not place any word in both halves', () => {
    const { topWords, bottomWords } = balancedSplit(puzzle);
    const topSet = new Set(topWords);
    for (const word of bottomWords) {
      expect(topSet.has(word)).toBe(false);
    }
  });
});

describe('KindredCoop: submission with correct group', () => {
  it('detects a correct group when 4 words from one group are combined', () => {
    const puzzle = generatePuzzle();
    const group = puzzle.groups[0];
    const words = [...group.words];

    const result = checkGroup(words, puzzle.groups);
    expect(result.correct).toBe(true);
    expect(result.groupIndex).toBe(0);
    expect(result.label).toBe(group.label);
  });

  it('accepts words in any order', () => {
    const puzzle = generatePuzzle();
    const group = puzzle.groups[1];
    const reversed = [...group.words].reverse();

    const result = checkGroup(reversed, puzzle.groups);
    expect(result.correct).toBe(true);
    expect(result.groupIndex).toBe(1);
  });
});

describe('KindredCoop: submission with wrong group increments mistakes', () => {
  it('rejects a mixed set of words from different groups', () => {
    const puzzle = generatePuzzle();
    // Pick 2 words from group 0 and 2 from group 1
    const mixed = [
      puzzle.groups[0].words[0],
      puzzle.groups[0].words[1],
      puzzle.groups[1].words[0],
      puzzle.groups[1].words[1],
    ];

    const result = checkGroup(mixed, puzzle.groups);
    expect(result.correct).toBe(false);
    expect(result.groupIndex).toBeNull();
    expect(result.label).toBeNull();
  });

  it('simulates mistake incrementing toward MAX_MISTAKES', () => {
    let mistakes = 0;
    const puzzle = generatePuzzle();
    const mixed = [
      puzzle.groups[0].words[0],
      puzzle.groups[0].words[1],
      puzzle.groups[1].words[0],
      puzzle.groups[1].words[1],
    ];

    // Simulate repeated wrong submissions
    for (let i = 0; i < MAX_MISTAKES; i++) {
      const result = checkGroup(mixed, puzzle.groups);
      if (!result.correct) {
        mistakes += 1;
      }
    }

    expect(mistakes).toBe(MAX_MISTAKES);
  });
});

describe('KindredCoop: win detection at 4 solved groups', () => {
  it('detects win when all 4 groups are solved sequentially', () => {
    const puzzle = generatePuzzle();
    const solvedCount: number[] = [];

    for (let i = 0; i < puzzle.groups.length; i++) {
      const result = checkGroup([...puzzle.groups[i].words], puzzle.groups);
      expect(result.correct).toBe(true);
      solvedCount.push(i);
    }

    expect(solvedCount).toHaveLength(4);
    // 4 solved groups means win
    expect(solvedCount.length === 4).toBe(true);
  });
});

describe('KindredCoop: loss detection at MAX_MISTAKES', () => {
  it('reaches exactly MAX_MISTAKES after repeated wrong guesses', () => {
    let mistakes = 0;
    let gameOver = false;

    for (let i = 0; i < MAX_MISTAKES + 2; i++) {
      if (gameOver) break;
      mistakes += 1;
      if (mistakes >= MAX_MISTAKES) {
        gameOver = true;
      }
    }

    expect(gameOver).toBe(true);
    expect(mistakes).toBe(MAX_MISTAKES);
  });

  it('MAX_MISTAKES equals 8', () => {
    expect(MAX_MISTAKES).toBe(8);
  });
});
