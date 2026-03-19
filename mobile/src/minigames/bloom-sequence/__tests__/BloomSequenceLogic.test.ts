import {
  generateGame,
  generateRound,
  validateAnswer,
  itemsEqual,
  type Round,
  type SequenceItem,
} from '../BloomSequenceLogic';

describe('generateGame', () => {
  it('generates 3 rounds', () => {
    const game = generateGame();
    expect(game.rounds).toHaveLength(3);
  });

  it('each round has 5-item sequence, correct answer, and 4 options', () => {
    const game = generateGame();
    for (const round of game.rounds) {
      expect(round.sequence).toHaveLength(5);
      expect(round.options).toHaveLength(4);
      expect(round.correctAnswer).toBeDefined();
    }
  });

  it('correct answer is always among the options', () => {
    for (let i = 0; i < 5; i++) {
      const game = generateGame();
      for (const round of game.rounds) {
        const found = round.options.some((opt) => itemsEqual(opt, round.correctAnswer));
        expect(found).toBe(true);
      }
    }
  });

  it('all 3 rounds have different pattern types', () => {
    for (let i = 0; i < 5; i++) {
      const game = generateGame();
      const types = game.rounds.map((r) => r.patternType);
      const unique = new Set(types);
      expect(unique.size).toBe(3);
    }
  });
});

describe('generateRound', () => {
  it('generates a valid round for each difficulty', () => {
    for (const diff of [1, 2, 3] as const) {
      const round = generateRound(diff, []);
      expect(round.sequence).toHaveLength(5);
      expect(round.options).toHaveLength(4);
    }
  });
});

describe('validateAnswer', () => {
  it('returns true for correct answer', () => {
    const game = generateGame();
    for (const round of game.rounds) {
      expect(validateAnswer(round, round.correctAnswer)).toBe(true);
    }
  });

  it('returns false for wrong answer', () => {
    const game = generateGame();
    for (const round of game.rounds) {
      const wrong = round.options.find((opt) => !itemsEqual(opt, round.correctAnswer));
      if (wrong) {
        expect(validateAnswer(round, wrong)).toBe(false);
      }
    }
  });
});

describe('itemsEqual', () => {
  it('identifies identical number items', () => {
    const a: SequenceItem = { kind: 'number', value: 5, color: null, shape: null, size: null, dotCount: null };
    const b: SequenceItem = { kind: 'number', value: 5, color: null, shape: null, size: null, dotCount: null };
    expect(itemsEqual(a, b)).toBe(true);
  });

  it('rejects different number items', () => {
    const a: SequenceItem = { kind: 'number', value: 5, color: null, shape: null, size: null, dotCount: null };
    const b: SequenceItem = { kind: 'number', value: 10, color: null, shape: null, size: null, dotCount: null };
    expect(itemsEqual(a, b)).toBe(false);
  });

  it('identifies identical compound items', () => {
    const a: SequenceItem = { kind: 'compound', value: null, color: '#C0392B', shape: 'circle', size: 'small', dotCount: null };
    const b: SequenceItem = { kind: 'compound', value: null, color: '#C0392B', shape: 'circle', size: 'small', dotCount: null };
    expect(itemsEqual(a, b)).toBe(true);
  });
});
