import {
  generatePuzzle,
  validateSolution,
  GROVE_WORDS,
  KINDRED_PACKS,
  seededRandom,
  shuffleWithRng,
  STONE_PAIR_ICONS,
} from '../../shared/minigames';
import { MinigamePuzzle } from '../../shared/types';

describe('minigames', () => {
  describe('generatePuzzle', () => {
    it('generates grove-words puzzle with wordLength 5 and maxGuesses 6', () => {
      const puzzle = generatePuzzle('grove-words', 'medium');
      expect(puzzle.type).toBe('grove-words');
      expect(puzzle.config.wordLength).toBe(5);
      expect(puzzle.config.maxGuesses).toBe(6);
      expect(puzzle.timeLimit).toBe(120);
      expect(typeof puzzle.solution.answer).toBe('string');
      expect(GROVE_WORDS).toContain(puzzle.solution.answer as string);
    });

    it('generates kindred puzzle with 16 shuffled words', () => {
      const puzzle = generatePuzzle('kindred', 'medium');
      expect(puzzle.type).toBe('kindred');
      const words = puzzle.config.words as string[];
      expect(words).toHaveLength(16);
      expect(puzzle.timeLimit).toBe(150);
      const groups = puzzle.solution.groups as Array<{ category: string; words: string[] }>;
      expect(groups).toHaveLength(4);
      groups.forEach((g) => expect(g.words).toHaveLength(4));
    });

    it('generates stone-pairs puzzle with seed and grid params', () => {
      const puzzle = generatePuzzle('stone-pairs', 'medium');
      expect(puzzle.type).toBe('stone-pairs');
      expect(puzzle.config.gridSize).toBe(4);
      expect(puzzle.config.pairs).toBe(8);
      expect(typeof puzzle.config.seed).toBe('number');
      expect(puzzle.timeLimit).toBe(60);
      const layout = puzzle.solution.layout as string[];
      expect(layout).toHaveLength(16);
    });

    it('generates stub puzzle for unknown minigame types', () => {
      const puzzle = generatePuzzle('pips', 'easy');
      expect(puzzle.type).toBe('pips');
      expect(puzzle.solution.stub).toBe(true);
    });

    it('returns fallback for completely unknown minigame ID', () => {
      const puzzle = generatePuzzle('nonexistent', 'medium');
      expect(puzzle.type).toBe('nonexistent');
      expect(puzzle.timeLimit).toBe(120);
    });
  });

  describe('validateSolution', () => {
    describe('grove-words', () => {
      it('returns true when finalGuess matches answer (case-insensitive)', () => {
        const puzzle: MinigamePuzzle = {
          type: 'grove-words',
          config: { wordLength: 5, maxGuesses: 6 },
          solution: { answer: 'BLOOM' },
          timeLimit: 120,
        };
        const result = validateSolution(puzzle, {
          guesses: ['CREEK', 'BLOOM'],
          finalGuess: 'bloom',
          solved: true,
        });
        expect(result).toBe(true);
      });

      it('returns false when finalGuess does not match answer', () => {
        const puzzle: MinigamePuzzle = {
          type: 'grove-words',
          config: { wordLength: 5, maxGuesses: 6 },
          solution: { answer: 'BLOOM' },
          timeLimit: 120,
        };
        const result = validateSolution(puzzle, {
          guesses: ['CREEK', 'STONE'],
          finalGuess: 'STONE',
          solved: false,
        });
        expect(result).toBe(false);
      });

      it('returns false when more than 6 guesses', () => {
        const puzzle: MinigamePuzzle = {
          type: 'grove-words',
          config: { wordLength: 5, maxGuesses: 6 },
          solution: { answer: 'BLOOM' },
          timeLimit: 120,
        };
        const result = validateSolution(puzzle, {
          guesses: ['A', 'B', 'C', 'D', 'E', 'F', 'BLOOM'],
          finalGuess: 'BLOOM',
          solved: true,
        });
        expect(result).toBe(false);
      });
    });

    describe('kindred', () => {
      it('returns true when submitted groups match correct groupings', () => {
        const pack = KINDRED_PACKS[0];
        const puzzle: MinigamePuzzle = {
          type: 'kindred',
          config: { words: pack.groups.flatMap((g) => g.words) },
          solution: {
            groups: pack.groups.map((g) => ({
              category: g.category,
              words: [...g.words].sort(),
            })),
          },
          timeLimit: 150,
        };

        const result = validateSolution(puzzle, {
          groups: pack.groups.map((g) => [...g.words]),
          mistakes: 1,
          solved: true,
        });
        expect(result).toBe(true);
      });

      it('returns false when submitted groups are wrong', () => {
        const pack = KINDRED_PACKS[0];
        const puzzle: MinigamePuzzle = {
          type: 'kindred',
          config: { words: pack.groups.flatMap((g) => g.words) },
          solution: {
            groups: pack.groups.map((g) => ({
              category: g.category,
              words: [...g.words].sort(),
            })),
          },
          timeLimit: 150,
        };

        // Mix words from different groups
        const wrongGroups = [
          ['DAISY', 'BIRCH', 'FLOUR', 'CHIRP'],
          ['POPPY', 'CEDAR', 'SUGAR', 'CHIME'],
          ['TULIP', 'MAPLE', 'YEAST', 'ROOST'],
          ['PANSY', 'WILLOW', 'BUTTER', 'RUSTLE'],
        ];

        const result = validateSolution(puzzle, {
          groups: wrongGroups,
          mistakes: 4,
          solved: false,
        });
        expect(result).toBe(false);
      });

      it('returns false when wrong number of groups', () => {
        const puzzle: MinigamePuzzle = {
          type: 'kindred',
          config: { words: [] },
          solution: {
            groups: [{ category: 'A', words: ['X', 'Y', 'Z', 'W'] }],
          },
          timeLimit: 150,
        };
        const result = validateSolution(puzzle, {
          groups: [['X', 'Y', 'Z', 'W']],
          solved: true,
        });
        expect(result).toBe(false);
      });
    });

    describe('stone-pairs', () => {
      it('produces consistent layout from same seed', () => {
        const seed = 42;
        const rng1 = seededRandom(seed);
        const rng2 = seededRandom(seed);

        const icons = STONE_PAIR_ICONS.slice(0, 8);
        const cards = [...icons, ...icons];

        const layout1 = shuffleWithRng([...cards], rng1);
        const layout2 = shuffleWithRng([...cards], rng2);

        expect(layout1).toEqual(layout2);
      });

      it('returns true for valid solved submission', () => {
        const puzzle = generatePuzzle('stone-pairs', 'medium');
        const result = validateSolution(puzzle, {
          totalFlips: 24,
          solved: true,
        });
        expect(result).toBe(true);
      });

      it('returns false when totalFlips exceeds 40', () => {
        const puzzle = generatePuzzle('stone-pairs', 'medium');
        const result = validateSolution(puzzle, {
          totalFlips: 50,
          solved: true,
        });
        expect(result).toBe(false);
      });

      it('returns false when not solved', () => {
        const puzzle = generatePuzzle('stone-pairs', 'medium');
        const result = validateSolution(puzzle, {
          totalFlips: 20,
          solved: false,
        });
        expect(result).toBe(false);
      });
    });

    describe('stub minigames', () => {
      it('always validates true for stub minigames', () => {
        const stubIds = ['pips', 'vine-trail', 'mosaic', 'crossvine',
          'number-grove', 'potion-logic', 'leaf-sort', 'cipher-stones', 'path-weaver'];

        for (const id of stubIds) {
          const puzzle = generatePuzzle(id, 'medium');
          const result = validateSolution(puzzle, { anything: 'value' });
          expect(result).toBe(true);
        }
      });
    });
  });
});
