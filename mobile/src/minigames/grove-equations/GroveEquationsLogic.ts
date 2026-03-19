/**
 * Grove Equations — simplified operator-cycling minigame.
 *
 * 4 fixed numbers in a row, 3 operator slots between them.
 * Evaluation uses standard BODMAS operator precedence (× and ÷ before + and -).
 * Player cycles operators to match a target.
 */

export type Operator = '+' | '-' | '*' | '/';

export const ALL_OPS: Operator[] = ['+', '-', '*', '/'];

export interface GroveEquationsPuzzle {
  numbers: number[];
  target: number;
  solution: Operator[];
}

/**
 * Evaluate numbers with operators using standard BODMAS precedence.
 * × and ÷ are evaluated before + and -.
 * Returns null if any division produces a non-whole number or divides by zero.
 */
export function evaluate(numbers: number[], operators: Operator[]): number | null {
  // Build term list: first pass resolves * and /, second pass resolves + and -
  // Start with all numbers as terms
  const terms: number[] = [...numbers];
  const addOps: Operator[] = [...operators];

  // First pass: resolve * and / (high precedence), collapsing into terms
  let i = 0;
  while (i < addOps.length) {
    const op = addOps[i];
    if (op === '*' || op === '/') {
      const left = terms[i];
      const right = terms[i + 1];
      let val: number;
      if (op === '*') {
        val = left * right;
      } else {
        if (right === 0 || left % right !== 0) return null;
        val = left / right;
      }
      // Replace left with result, remove right and the operator
      terms.splice(i, 2, val);
      addOps.splice(i, 1);
    } else {
      i++;
    }
  }

  // Second pass: resolve + and - (left to right)
  let result = terms[0];
  for (let j = 0; j < addOps.length; j++) {
    if (addOps[j] === '+') {
      result = result + terms[j + 1];
    } else {
      result = result - terms[j + 1];
    }
  }

  return result;
}

/**
 * Validate that the given operators produce the target
 * using standard BODMAS evaluation.
 */
export function validateSolution(numbers: number[], operators: Operator[], target: number): boolean {
  if (numbers.length !== 4 || operators.length !== 3) return false;
  const result = evaluate(numbers, operators);
  return result === target;
}

// ── Puzzle Generation ──────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomOp(): Operator {
  return ALL_OPS[randInt(0, 3)];
}

function allSameOp(ops: Operator[]): boolean {
  return ops[0] === ops[1] && ops[1] === ops[2];
}

/**
 * Generate initial display operators that do NOT already solve the puzzle.
 * Starts with all '+' and only shuffles if that happens to match the solution.
 */
function makeInitialOps(solution: Operator[]): Operator[] {
  const initial: Operator[] = ['+', '+', '+'];
  // Check if initial already matches solution
  if (initial[0] === solution[0] && initial[1] === solution[1] && initial[2] === solution[2]) {
    // Cycle the first operator to something different
    const idx = ALL_OPS.indexOf(solution[0]);
    initial[0] = ALL_OPS[(idx + 1) % 4];
  }
  return initial;
}

/**
 * Generate a puzzle:
 * - Pick 4 numbers (1–9), pick 3 random operators
 * - Evaluate with BODMAS precedence to get target
 * - Reject if: target < 5, target negative, non-whole, or all 3 ops same
 * - Ensure starting display ops don't already equal the solution
 */
export function generatePuzzle(): GroveEquationsPuzzle {
  for (let attempt = 0; attempt < 500; attempt++) {
    const numbers = [randInt(1, 9), randInt(1, 9), randInt(1, 9), randInt(1, 9)];
    const solution: Operator[] = [randomOp(), randomOp(), randomOp()];

    if (allSameOp(solution)) continue;

    const target = evaluate(numbers, solution);
    if (target === null) continue;
    if (target < 5) continue;

    return { numbers, target, solution };
  }

  // Fallback (should never reach here)
  return { numbers: [3, 5, 2, 4], target: 12, solution: ['+', '-', '*'] };
}

/**
 * Get initial operators for display (guaranteed not to already be the solution).
 */
export function getInitialOperators(solution: Operator[]): Operator[] {
  return makeInitialOps(solution);
}

/**
 * Cycle an operator to the next one in the sequence: + → - → × → ÷ → +
 */
export function cycleOperator(op: Operator): Operator {
  const idx = ALL_OPS.indexOf(op);
  return ALL_OPS[(idx + 1) % 4];
}
