/**
 * Grove Equations — server-side puzzle generation and validation.
 * 4 fixed numbers, 3 operator slots, BODMAS evaluation (× and ÷ before + and -).
 */

export type Operator = '+' | '-' | '*' | '/';

const ALL_OPS: Operator[] = ['+', '-', '*', '/'];

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
  const terms: number[] = [...numbers];
  const addOps: Operator[] = [...operators];

  // First pass: resolve * and / (high precedence)
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
 * Validate that the given operators produce the target using BODMAS evaluation.
 */
export function validateSolution(numbers: number[], operators: Operator[], target: number): boolean {
  if (numbers.length !== 4 || operators.length !== 3) return false;
  for (const op of operators) {
    if (!ALL_OPS.includes(op)) return false;
  }
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

export function generatePuzzle(): GroveEquationsPuzzle {
  for (let attempt = 0; attempt < 500; attempt++) {
    const numbers = [randInt(1, 9), randInt(1, 9), randInt(1, 9), randInt(1, 9)];
    const solution: Operator[] = [randomOp(), randomOp(), randomOp()];

    // Reject if all 3 operators are the same (too trivial)
    if (solution[0] === solution[1] && solution[1] === solution[2]) continue;

    const target = evaluate(numbers, solution);
    if (target === null) continue;
    if (target < 5) continue;

    return { numbers, target, solution };
  }

  return { numbers: [3, 5, 2, 4], target: 12, solution: ['+', '-', '*'] };
}
