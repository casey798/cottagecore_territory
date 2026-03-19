import {
  evaluate,
  validateSolution,
  generatePuzzle,
  getInitialOperators,
  cycleOperator,
  type Operator,
} from '../GroveEquationsLogic';

describe('evaluate (BODMAS)', () => {
  it('evaluates addition', () => {
    expect(evaluate([1, 2, 3, 4], ['+', '+', '+'])).toBe(10);
  });

  it('applies × before +', () => {
    // 3 + 4 × 2 - 1 = 3 + 8 - 1 = 10
    expect(evaluate([3, 4, 2, 1], ['+', '*', '-'])).toBe(10);
  });

  it('applies ÷ before -', () => {
    // 9 - 6 ÷ 3 + 1 = 9 - 2 + 1 = 8
    expect(evaluate([9, 6, 3, 1], ['-', '/', '+'])).toBe(8);
  });

  it('handles all multiplication', () => {
    // 2 × 3 × 4 + 1 = 24 + 1 = 25  — but all same ops rejected by generator,
    // evaluator itself handles it fine: 2 * 3 * 4 - 1 = 24 - 1 = 23
    expect(evaluate([2, 3, 4, 1], ['*', '*', '-'])).toBe(23);
  });

  it('returns null for non-whole division', () => {
    // 3 ÷ 2 = 1.5 → null
    expect(evaluate([3, 2, 1, 1], ['/', '+', '+'])).toBeNull();
  });

  it('returns null for division by zero', () => {
    expect(evaluate([5, 0, 1, 1], ['/', '+', '+'])).toBeNull();
  });

  it('handles exact division with precedence', () => {
    // 1 + 8 ÷ 2 + 3 = 1 + 4 + 3 = 8
    expect(evaluate([1, 8, 2, 3], ['+', '/', '+'])).toBe(8);
  });
});

describe('validateSolution', () => {
  it('accepts correct operators', () => {
    expect(validateSolution([1, 2, 3, 4], ['+', '+', '+'], 10)).toBe(true);
  });

  it('rejects wrong target', () => {
    expect(validateSolution([1, 2, 3, 4], ['+', '+', '+'], 99)).toBe(false);
  });

  it('rejects wrong number of operators', () => {
    expect(validateSolution([1, 2, 3, 4], ['+', '+'] as Operator[], 6)).toBe(false);
  });

  it('rejects wrong number of numbers', () => {
    expect(validateSolution([1, 2, 3], ['+', '+', '+'], 6)).toBe(false);
  });
});

describe('generatePuzzle', () => {
  it('generates valid puzzles', () => {
    for (let i = 0; i < 10; i++) {
      const puzzle = generatePuzzle();
      expect(puzzle.numbers).toHaveLength(4);
      expect(puzzle.solution).toHaveLength(3);
      puzzle.numbers.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(9);
      });
      expect(puzzle.target).toBeGreaterThanOrEqual(5);
      expect(validateSolution(puzzle.numbers, puzzle.solution, puzzle.target)).toBe(true);
    }
  });

  it('never generates puzzles where all 3 ops are the same', () => {
    for (let i = 0; i < 20; i++) {
      const puzzle = generatePuzzle();
      const allSame = puzzle.solution[0] === puzzle.solution[1] && puzzle.solution[1] === puzzle.solution[2];
      expect(allSame).toBe(false);
    }
  });
});

describe('getInitialOperators', () => {
  it('returns operators that differ from solution', () => {
    const solution: Operator[] = ['+', '-', '*'];
    const initial = getInitialOperators(solution);
    expect(initial).toHaveLength(3);
    const matches = initial[0] === solution[0] && initial[1] === solution[1] && initial[2] === solution[2];
    expect(matches).toBe(false);
  });

  it('handles solution being all +', () => {
    const solution: Operator[] = ['+', '+', '+'];
    const initial = getInitialOperators(solution);
    const matches = initial[0] === solution[0] && initial[1] === solution[1] && initial[2] === solution[2];
    expect(matches).toBe(false);
  });
});

describe('cycleOperator', () => {
  it('cycles through all operators', () => {
    expect(cycleOperator('+')).toBe('-');
    expect(cycleOperator('-')).toBe('*');
    expect(cycleOperator('*')).toBe('/');
    expect(cycleOperator('/')).toBe('+');
  });
});
