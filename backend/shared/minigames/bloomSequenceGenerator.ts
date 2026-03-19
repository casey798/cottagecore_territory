/**
 * Bloom Sequence — server-side puzzle generation and validation.
 * Mirrors the logic in the mobile client's BloomSequenceLogic.ts.
 */

export type ShapeKind = 'circle' | 'square';
export type SizeKind = 'small' | 'medium' | 'large';

export interface SequenceItem {
  kind: 'number' | 'color' | 'shape' | 'dots' | 'compound';
  value: number | null;
  color: string | null;
  shape: ShapeKind | null;
  size: SizeKind | null;
  dotCount: number | null;
}

export interface Round {
  patternType: string;
  sequence: SequenceItem[];
  correctAnswer: SequenceItem;
  options: SequenceItem[];
}

export interface BloomSequenceGameData {
  rounds: Round[];
}

// ── Colors ─────────────────────────────────────────────────────────────

const SEQUENCE_COLORS = ['#C0392B', '#2980B9', '#27AE60', '#F1C40F', '#7D3C98'];

// ── Helpers ────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function numItem(v: number): SequenceItem {
  return { kind: 'number', value: v, color: null, shape: null, size: null, dotCount: null };
}

function colorItem(c: string): SequenceItem {
  return { kind: 'color', value: null, color: c, shape: null, size: null, dotCount: null };
}

function shapeItem(s: ShapeKind, c: string): SequenceItem {
  return { kind: 'shape', value: null, color: c, shape: s, size: null, dotCount: null };
}

function dotItem(count: number): SequenceItem {
  return { kind: 'dots', value: null, color: null, shape: null, size: null, dotCount: count };
}

function sizeItem(sz: SizeKind, c: string): SequenceItem {
  return { kind: 'color', value: null, color: c, shape: 'circle', size: sz, dotCount: null };
}

function compoundItem(s: ShapeKind, c: string, sz: SizeKind): SequenceItem {
  return { kind: 'compound', value: null, color: c, shape: s, size: sz, dotCount: null };
}

function numDistractors(correct: number, spread: 'far' | 'moderate' | 'close'): number[] {
  const distractors = new Set<number>();
  const ranges = { far: [5, 20], moderate: [3, 10], close: [1, 4] };
  const [lo, hi] = ranges[spread];
  let attempts = 0;
  while (distractors.size < 3 && attempts < 100) {
    const offset = randInt(lo, hi) * (Math.random() < 0.5 ? -1 : 1);
    const d = correct + offset;
    if (d !== correct && d >= 0) distractors.add(d);
    attempts++;
  }
  let fallback = correct + lo;
  while (distractors.size < 3) {
    if (fallback !== correct) distractors.add(fallback);
    fallback++;
  }
  return Array.from(distractors).slice(0, 3);
}

// ── Pattern Generators ─────────────────────────────────────────────────

function genArithmetic(): Round {
  const step = randInt(2, 5);
  const start = randInt(1, 10);
  const seq: SequenceItem[] = [];
  for (let i = 0; i < 5; i++) seq.push(numItem(start + step * i));
  const answer = numItem(start + step * 5);
  const distractors = numDistractors(answer.value!, 'far').map(numItem);
  return { patternType: 'arithmetic', sequence: seq, correctAnswer: answer, options: shuffle([answer, ...distractors]) };
}

function genColorCycle(): Round {
  const numColors = randInt(3, 4);
  const palette = shuffle(SEQUENCE_COLORS).slice(0, numColors);
  const seq: SequenceItem[] = [];
  for (let i = 0; i < 5; i++) seq.push(colorItem(palette[i % numColors]));
  const answer = colorItem(palette[5 % numColors]);
  const wrongColors = SEQUENCE_COLORS.filter(c => c !== answer.color);
  const distractors = shuffle(wrongColors).slice(0, 3).map(colorItem);
  return { patternType: 'color-cycle', sequence: seq, correctAnswer: answer, options: shuffle([answer, ...distractors]) };
}

function genShapeAlternating(): Round {
  const shapes: ShapeKind[] = ['circle', 'square'];
  const color = pick(SEQUENCE_COLORS);
  const seq: SequenceItem[] = [];
  for (let i = 0; i < 5; i++) seq.push(shapeItem(shapes[i % 2], color));
  const answer = shapeItem(shapes[5 % 2], color);
  const wrongShape = shapes[5 % 2] === 'circle' ? 'square' : 'circle';
  const wrongColor = SEQUENCE_COLORS.find(c => c !== color)!;
  const distractors = [shapeItem(wrongShape, color), shapeItem(answer.shape!, wrongColor), shapeItem(wrongShape, wrongColor)];
  return { patternType: 'shape-alternating', sequence: seq, correctAnswer: answer, options: shuffle([answer, ...distractors]) };
}

function genGeometric(): Round {
  const factor = pick([2, 3]);
  const start = randInt(1, 4);
  const seq: SequenceItem[] = [];
  let v = start;
  for (let i = 0; i < 5; i++) { seq.push(numItem(v)); v *= factor; }
  const answer = numItem(v);
  const distractors = numDistractors(answer.value!, 'moderate').map(numItem);
  return { patternType: 'geometric', sequence: seq, correctAnswer: answer, options: shuffle([answer, ...distractors]) };
}

function genDotCount(): Round {
  const step = pick([3, 5]);
  const start = randInt(1, 4);
  const seq: SequenceItem[] = [];
  for (let i = 0; i < 5; i++) seq.push(dotItem(start + step * i));
  const answer = dotItem(start + step * 5);
  const distractors = numDistractors(answer.dotCount!, 'moderate').map(d => dotItem(Math.max(1, d)));
  return { patternType: 'dot-count', sequence: seq, correctAnswer: answer, options: shuffle([answer, ...distractors]) };
}

function genSizeProgression(): Round {
  const sizes: SizeKind[] = ['small', 'medium', 'large'];
  const color = pick(SEQUENCE_COLORS);
  const seq: SequenceItem[] = [];
  for (let i = 0; i < 5; i++) seq.push(sizeItem(sizes[i % 3], color));
  const answer = sizeItem(sizes[5 % 3], color);
  const wrongSizes = sizes.filter(s => s !== answer.size!);
  const wrongColor = SEQUENCE_COLORS.find(c => c !== color)!;
  const distractors = [sizeItem(wrongSizes[0], color), sizeItem(wrongSizes[1], color), sizeItem(answer.size!, wrongColor)];
  return { patternType: 'size-progression', sequence: seq, correctAnswer: answer, options: shuffle([answer, ...distractors]) };
}

function genAlternatingArithmetic(): Round {
  const stepA = randInt(2, 4);
  const stepB = randInt(-3, -1);
  const startA = randInt(1, 5);
  const startB = randInt(15, 25);
  const vals: number[] = [];
  for (let i = 0; i < 3; i++) { vals.push(startA + stepA * i); vals.push(startB + stepB * i); }
  const seq = vals.slice(0, 5).map(numItem);
  const answer = numItem(vals[5]);
  const distractors = numDistractors(answer.value!, 'close').map(numItem);
  return { patternType: 'alternating-arithmetic', sequence: seq, correctAnswer: answer, options: shuffle([answer, ...distractors]) };
}

function genDifferenceOfDifferences(): Round {
  const start = randInt(1, 5);
  const baseGap = randInt(1, 3);
  const vals: number[] = [start];
  let gap = baseGap;
  for (let i = 1; i < 6; i++) { vals.push(vals[i - 1] + gap); gap++; }
  const seq = vals.slice(0, 5).map(numItem);
  const answer = numItem(vals[5]);
  const distractors = numDistractors(answer.value!, 'close').map(numItem);
  return { patternType: 'difference-of-differences', sequence: seq, correctAnswer: answer, options: shuffle([answer, ...distractors]) };
}

function genTwoProperty(): Round {
  const shapes: ShapeKind[] = ['circle', 'square'];
  const colors = shuffle(SEQUENCE_COLORS).slice(0, 2);
  const sizes: SizeKind[] = ['small', 'large'];
  const seq: SequenceItem[] = [];
  for (let i = 0; i < 5; i++) seq.push(compoundItem(shapes[i % 2], colors[i % 2], sizes[i % 2]));
  const answer = compoundItem(shapes[5 % 2], colors[5 % 2], sizes[5 % 2]);
  const distractors = [
    compoundItem(shapes[(5 + 1) % 2], colors[5 % 2], sizes[5 % 2]),
    compoundItem(shapes[5 % 2], colors[(5 + 1) % 2], sizes[5 % 2]),
    compoundItem(shapes[5 % 2], colors[5 % 2], sizes[(5 + 1) % 2]),
  ];
  return { patternType: 'two-property', sequence: seq, correctAnswer: answer, options: shuffle([answer, ...distractors]) };
}

// ── Pools ──────────────────────────────────────────────────────────────

const ROUND_1_POOL = [genArithmetic, genColorCycle, genShapeAlternating];
const ROUND_2_POOL = [genGeometric, genDotCount, genSizeProgression];
const ROUND_3_POOL = [genAlternatingArithmetic, genDifferenceOfDifferences, genTwoProperty];

// ── Public API ─────────────────────────────────────────────────────────

export function generateGame(): BloomSequenceGameData {
  const rounds: Round[] = [];
  for (const pool of [ROUND_1_POOL, ROUND_2_POOL, ROUND_3_POOL]) {
    rounds.push(pick(pool)());
  }
  return { rounds };
}

function itemsEqual(a: SequenceItem, b: SequenceItem): boolean {
  return a.kind === b.kind && a.value === b.value && a.color === b.color &&
    a.shape === b.shape && a.size === b.size && a.dotCount === b.dotCount;
}

export function validateAnswers(
  rounds: Round[],
  chosenIndices: number[],
): boolean {
  if (rounds.length !== 3 || chosenIndices.length !== 3) return false;
  for (let i = 0; i < 3; i++) {
    const round = rounds[i];
    const idx = chosenIndices[i];
    if (idx < 0 || idx >= round.options.length) return false;
    const chosen = round.options[idx];
    if (!itemsEqual(chosen, round.correctAnswer)) return false;
  }
  return true;
}
