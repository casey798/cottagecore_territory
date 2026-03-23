// potionLogicGenerator.ts — Server-side puzzle generation and validation for Potion Logic.
// Mirrors the client PotionLogicLogic.ts generation but keeps the solution server-side.

// ── Types ─────────────────────────────────────────────────────────────

export type Potion = 'red' | 'blue' | 'green';
export type Ingredient = 'herb' | 'crystal' | 'mushroom';
export type Effect = 'healing' | 'speed' | 'shield';

export interface PotionLogicSolution {
  ingredients: Record<Potion, Ingredient>;
  effects: Record<Potion, Effect>;
}

type CellState = 'empty' | 'eliminated' | 'confirmed';

interface GridState {
  ingredients: CellState[][];
  effects: CellState[][];
}

type ClueType = 'direct_positive' | 'direct_negative' | 'relational' | 'cross_negative';

interface Clue {
  type: ClueType;
  text: string;
  apply: (grid: GridState) => GridState;
}

// ── Constants ─────────────────────────────────────────────────────────

const POTIONS: Potion[] = ['red', 'blue', 'green'];
const INGREDIENTS: Ingredient[] = ['herb', 'crystal', 'mushroom'];
const EFFECTS: Effect[] = ['healing', 'speed', 'shield'];

const POTION_NAMES: Record<Potion, string> = { red: 'Red', blue: 'Blue', green: 'Green' };
const INGREDIENT_NAMES: Record<Ingredient, string> = { herb: 'Herb', crystal: 'Crystal', mushroom: 'Mushroom' };
const EFFECT_NAMES: Record<Effect, string> = { healing: 'Healing', speed: 'Speed', shield: 'Shield' };

// ── Helpers ───────────────────────────────────────────────────────────

function shuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function potionIndex(p: Potion): number { return POTIONS.indexOf(p); }
function ingredientIndex(i: Ingredient): number { return INGREDIENTS.indexOf(i); }
function effectIndex(e: Effect): number { return EFFECTS.indexOf(e); }

function cloneGrid(g: GridState): GridState {
  return {
    ingredients: g.ingredients.map(row => [...row]),
    effects: g.effects.map(row => [...row]),
  };
}

function emptyGrid(): GridState {
  return {
    ingredients: Array.from({ length: 3 }, () => Array<CellState>(3).fill('empty')),
    effects: Array.from({ length: 3 }, () => Array<CellState>(3).fill('empty')),
  };
}

// ── Grid operations ───────────────────────────────────────────────────

function confirmCell(grid: CellState[][], row: number, col: number): void {
  grid[row][col] = 'confirmed';
  for (let c = 0; c < 3; c++) {
    if (c !== col && grid[row][c] !== 'confirmed') grid[row][c] = 'eliminated';
  }
  for (let r = 0; r < 3; r++) {
    if (r !== row && grid[r][col] !== 'confirmed') grid[r][col] = 'eliminated';
  }
}

function eliminateCell(grid: CellState[][], row: number, col: number): void {
  if (grid[row][col] === 'confirmed') return;
  grid[row][col] = 'eliminated';
}

function propagate(grid: CellState[][]): boolean {
  let changed = false;

  for (let r = 0; r < 3; r++) {
    const emptyCols: number[] = [];
    let hasConfirm = false;
    for (let c = 0; c < 3; c++) {
      if (grid[r][c] === 'empty') emptyCols.push(c);
      if (grid[r][c] === 'confirmed') hasConfirm = true;
    }
    if (!hasConfirm && emptyCols.length === 1) {
      confirmCell(grid, r, emptyCols[0]);
      changed = true;
    }
  }

  for (let c = 0; c < 3; c++) {
    const emptyRows: number[] = [];
    let hasConfirm = false;
    for (let r = 0; r < 3; r++) {
      if (grid[r][c] === 'empty') emptyRows.push(r);
      if (grid[r][c] === 'confirmed') hasConfirm = true;
    }
    if (!hasConfirm && emptyRows.length === 1) {
      confirmCell(grid, emptyRows[0], c);
      changed = true;
    }
  }

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[r][c] === 'confirmed') {
        for (let c2 = 0; c2 < 3; c2++) {
          if (c2 !== c && grid[r][c2] === 'empty') {
            grid[r][c2] = 'eliminated';
            changed = true;
          }
        }
        for (let r2 = 0; r2 < 3; r2++) {
          if (r2 !== r && grid[r2][c] === 'empty') {
            grid[r2][c] = 'eliminated';
            changed = true;
          }
        }
      }
    }
  }

  return changed;
}

function propagateAll(state: GridState): void {
  let changed = true;
  while (changed) {
    changed = false;
    if (propagate(state.ingredients)) changed = true;
    if (propagate(state.effects)) changed = true;
  }
}

function isFullyDetermined(state: GridState): boolean {
  for (let r = 0; r < 3; r++) {
    let iConfirmed = false;
    let eConfirmed = false;
    for (let c = 0; c < 3; c++) {
      if (state.ingredients[r][c] === 'confirmed') iConfirmed = true;
      if (state.effects[r][c] === 'confirmed') eConfirmed = true;
    }
    if (!iConfirmed || !eConfirmed) return false;
  }
  return true;
}

// ── Solver ────────────────────────────────────────────────────────────

function solve(clues: Clue[]): GridState {
  let state = emptyGrid();
  let changed = true;
  while (changed) {
    changed = false;
    for (const clue of clues) {
      const newState = clue.apply(state);
      let diff = false;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (newState.ingredients[r][c] !== state.ingredients[r][c]) diff = true;
          if (newState.effects[r][c] !== state.effects[r][c]) diff = true;
        }
      }
      if (diff) {
        state = newState;
        changed = true;
      }
    }
    propagateAll(state);
  }
  return state;
}

function isSolvable(clues: Clue[]): boolean {
  return isFullyDetermined(solve(clues));
}

// ── Clue templates ───────────────────────────────────────────────────

const DIRECT_POSITIVE_INGREDIENT_TEMPLATES = [
  (p: string, i: string) => `The ${p} Potion was brewed with ${i}.`,
  (p: string, i: string) => `${i} is the key ingredient in the ${p} Potion.`,
  (p: string, i: string) => `The ${p} Potion calls for ${i} in its recipe.`,
];

const DIRECT_POSITIVE_EFFECT_TEMPLATES = [
  (p: string, e: string) => `The ${p} Potion grants ${e}.`,
  (p: string, e: string) => `Drinking the ${p} Potion bestows ${e}.`,
  (p: string, e: string) => `The ${p} Potion is known for its ${e} power.`,
];

const DIRECT_NEGATIVE_INGREDIENT_TEMPLATES = [
  (p: string, i: string) => `The ${p} Potion was not made with ${i}.`,
  (p: string, i: string) => `${i} has no place in the ${p} Potion.`,
  (p: string, i: string) => `The ${p} Potion's recipe does not call for ${i}.`,
];

const DIRECT_NEGATIVE_EFFECT_TEMPLATES = [
  (p: string, e: string) => `The ${p} Potion does not grant ${e}.`,
  (p: string, e: string) => `${e} is not among the ${p} Potion's gifts.`,
  (p: string, e: string) => `The ${p} Potion has nothing to do with ${e}.`,
];

const RELATIONAL_TEMPLATES = [
  (i: string, e: string) => `The potion brewed with ${i} grants ${e}.`,
  (i: string, e: string) => `Whoever added ${i} created a potion of ${e}.`,
  (i: string, e: string) => `The ${e} potion contains ${i} in its blend.`,
];

const CROSS_NEGATIVE_TEMPLATES = [
  (i: string, e: string) => `The potion containing ${i} does not grant ${e}.`,
  (i: string, e: string) => `${i} and ${e} never appear in the same potion.`,
  (i: string, e: string) => `No potion brewed with ${i} could bestow ${e}.`,
];

function pickTemplate<T>(templates: T[]): T {
  return templates[Math.floor(Math.random() * templates.length)];
}

// ── Clue generation ──────────────────────────────────────────────────

function generateAllClues(solution: PotionLogicSolution): Clue[] {
  const clues: Clue[] = [];

  // Direct positive — ingredient
  for (const p of POTIONS) {
    const ing = solution.ingredients[p];
    const pName = POTION_NAMES[p];
    const iName = INGREDIENT_NAMES[ing];
    const pi = potionIndex(p);
    const ii = ingredientIndex(ing);
    clues.push({
      type: 'direct_positive',
      text: pickTemplate(DIRECT_POSITIVE_INGREDIENT_TEMPLATES)(pName, iName),
      apply: (grid: GridState): GridState => {
        const g = cloneGrid(grid);
        confirmCell(g.ingredients, pi, ii);
        return g;
      },
    });
  }

  // Direct positive — effect
  for (const p of POTIONS) {
    const eff = solution.effects[p];
    const pName = POTION_NAMES[p];
    const eName = EFFECT_NAMES[eff];
    const pi = potionIndex(p);
    const ei = effectIndex(eff);
    clues.push({
      type: 'direct_positive',
      text: pickTemplate(DIRECT_POSITIVE_EFFECT_TEMPLATES)(pName, eName),
      apply: (grid: GridState): GridState => {
        const g = cloneGrid(grid);
        confirmCell(g.effects, pi, ei);
        return g;
      },
    });
  }

  // Direct negative — ingredient
  for (const p of POTIONS) {
    for (const ing of INGREDIENTS) {
      if (solution.ingredients[p] === ing) continue;
      const pName = POTION_NAMES[p];
      const iName = INGREDIENT_NAMES[ing];
      const pi = potionIndex(p);
      const ii = ingredientIndex(ing);
      clues.push({
        type: 'direct_negative',
        text: pickTemplate(DIRECT_NEGATIVE_INGREDIENT_TEMPLATES)(pName, iName),
        apply: (grid: GridState): GridState => {
          const g = cloneGrid(grid);
          eliminateCell(g.ingredients, pi, ii);
          return g;
        },
      });
    }
  }

  // Direct negative — effect
  for (const p of POTIONS) {
    for (const eff of EFFECTS) {
      if (solution.effects[p] === eff) continue;
      const pName = POTION_NAMES[p];
      const eName = EFFECT_NAMES[eff];
      const pi = potionIndex(p);
      const ei = effectIndex(eff);
      clues.push({
        type: 'direct_negative',
        text: pickTemplate(DIRECT_NEGATIVE_EFFECT_TEMPLATES)(pName, eName),
        apply: (grid: GridState): GridState => {
          const g = cloneGrid(grid);
          eliminateCell(g.effects, pi, ei);
          return g;
        },
      });
    }
  }

  // Relational
  for (const p of POTIONS) {
    const ing = solution.ingredients[p];
    const eff = solution.effects[p];
    const iName = INGREDIENT_NAMES[ing];
    const eName = EFFECT_NAMES[eff];
    const ii = ingredientIndex(ing);
    const ei = effectIndex(eff);
    clues.push({
      type: 'relational',
      text: pickTemplate(RELATIONAL_TEMPLATES)(iName, eName),
      apply: (grid: GridState): GridState => {
        const g = cloneGrid(grid);
        for (let r = 0; r < 3; r++) {
          if (g.ingredients[r][ii] === 'confirmed') confirmCell(g.effects, r, ei);
          if (g.ingredients[r][ii] === 'eliminated') eliminateCell(g.effects, r, ei);
          if (g.effects[r][ei] === 'confirmed') confirmCell(g.ingredients, r, ii);
          if (g.effects[r][ei] === 'eliminated') eliminateCell(g.ingredients, r, ii);
        }
        return g;
      },
    });
  }

  // Cross negative
  for (const p of POTIONS) {
    const ing = solution.ingredients[p];
    for (const eff of EFFECTS) {
      if (solution.effects[p] === eff) continue;
      const iName = INGREDIENT_NAMES[ing];
      const eName = EFFECT_NAMES[eff];
      const ii = ingredientIndex(ing);
      const ei = effectIndex(eff);
      clues.push({
        type: 'cross_negative',
        text: pickTemplate(CROSS_NEGATIVE_TEMPLATES)(iName, eName),
        apply: (grid: GridState): GridState => {
          const g = cloneGrid(grid);
          for (let r = 0; r < 3; r++) {
            if (g.ingredients[r][ii] === 'confirmed') eliminateCell(g.effects, r, ei);
            if (g.effects[r][ei] === 'confirmed') eliminateCell(g.ingredients, r, ii);
          }
          return g;
        },
      });
    }
  }

  return clues;
}

// ── Puzzle generation ─────────────────────────────────────────────────

function generateSolution(): PotionLogicSolution {
  const ings = shuffle(INGREDIENTS) as [Ingredient, Ingredient, Ingredient];
  const effs = shuffle(EFFECTS) as [Effect, Effect, Effect];
  return {
    ingredients: { red: ings[0], blue: ings[1], green: ings[2] },
    effects: { red: effs[0], blue: effs[1], green: effs[2] },
  };
}

export interface PotionLogicPuzzle {
  solution: PotionLogicSolution;
  clueTexts: string[];
}

export function generatePotionLogicPuzzle(): PotionLogicPuzzle {
  const solution = generateSolution();
  const allClues = generateAllClues(solution);

  const directPositive = allClues.filter(c => c.type === 'direct_positive');
  const relational = allClues.filter(c => c.type === 'relational');
  const directNegative = allClues.filter(c => c.type === 'direct_negative');
  const crossNegative = allClues.filter(c => c.type === 'cross_negative');

  for (let attempt = 0; attempt < 200; attempt++) {
    const selected: Clue[] = [];

    const numDP = Math.random() < 0.6 ? 1 : 0;
    if (numDP > 0 && directPositive.length > 0) {
      selected.push(directPositive[Math.floor(Math.random() * directPositive.length)]);
    }

    const numRel = Math.random() < 0.5 ? 2 : 1;
    const shuffledRel = shuffle(relational);
    for (let i = 0; i < Math.min(numRel, shuffledRel.length); i++) {
      selected.push(shuffledRel[i]);
    }

    const negatives = shuffle([...directNegative, ...crossNegative]);
    const numNeg = selected.length < 3 ? 2 : (Math.random() < 0.5 ? 2 : 1);
    for (let i = 0; i < Math.min(numNeg, negatives.length); i++) {
      selected.push(negatives[i]);
    }

    if (selected.length < 4 || selected.length > 5) continue;

    const dpCount = selected.filter(c => c.type === 'direct_positive').length;
    const relCount = selected.filter(c => c.type === 'relational').length;
    const negCount = selected.filter(c => c.type === 'direct_negative' || c.type === 'cross_negative').length;
    if (dpCount > 1 || relCount < 1 || negCount < 1) continue;

    if (!isSolvable(selected)) continue;

    let isMinimal = true;
    for (let i = 0; i < selected.length; i++) {
      const reduced = [...selected.slice(0, i), ...selected.slice(i + 1)];
      if (isSolvable(reduced)) {
        isMinimal = false;
        break;
      }
    }

    if (isMinimal) {
      return { solution, clueTexts: selected.map(c => c.text) };
    }
  }

  // Fallback
  const shuffledAll = shuffle(allClues);
  for (let size = 4; size <= 5; size++) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const candidates = shuffle(shuffledAll).slice(0, size);
      if (isSolvable(candidates)) {
        return { solution, clueTexts: candidates.map(c => c.text) };
      }
    }
  }

  for (const dp of [shuffle(directPositive).slice(0, 3)]) {
    for (let i = 0; i < relational.length; i++) {
      for (let j = i + 1; j < relational.length; j++) {
        const candidate = [...dp, relational[i], relational[j]];
        if (isSolvable(candidate)) {
          return { solution, clueTexts: candidate.map(c => c.text) };
        }
      }
    }
  }

  for (let size = 6; size <= allClues.length; size++) {
    const candidate = allClues.slice(0, size);
    if (isSolvable(candidate)) {
      return { solution, clueTexts: candidate.map(c => c.text) };
    }
  }

  return { solution, clueTexts: allClues.map(c => c.text) };
}

// ── Validation ────────────────────────────────────────────────────────

export function validatePotionLogicSubmission(
  solution: PotionLogicSolution,
  playerIngredients: Record<string, string>,
  playerEffects: Record<string, string>,
): boolean {
  for (const p of POTIONS) {
    if (playerIngredients[p] !== solution.ingredients[p]) return false;
    if (playerEffects[p] !== solution.effects[p]) return false;
  }
  return true;
}
