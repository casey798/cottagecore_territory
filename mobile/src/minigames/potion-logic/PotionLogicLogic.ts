// PotionLogicLogic.ts — Pure logic for the Potion Logic minigame.
// Zero React dependencies. Fully unit-testable.

// ── Types ─────────────────────────────────────────────────────────────

export type Potion = 'red' | 'blue' | 'green';
export type Ingredient = 'herb' | 'crystal' | 'mushroom';
export type Effect = 'healing' | 'speed' | 'shield';

export interface Solution {
  ingredients: Record<Potion, Ingredient>;
  effects: Record<Potion, Effect>;
}

export type CellState = 'empty' | 'eliminated' | 'confirmed';

export interface GridState {
  ingredients: CellState[][]; // 3×3: potions (rows) × ingredients (cols)
  effects: CellState[][];     // 3×3: potions (rows) × effects (cols)
}

export type ClueType = 'direct_positive' | 'direct_negative' | 'relational' | 'cross_negative';

export interface Clue {
  type: ClueType;
  text: string;
  apply: (grid: GridState) => GridState;
}

export interface Puzzle {
  solution: Solution;
  clues: Clue[];
}

// ── Constants ─────────────────────────────────────────────────────────

export const POTIONS: Potion[] = ['red', 'blue', 'green'];
export const INGREDIENTS: Ingredient[] = ['herb', 'crystal', 'mushroom'];
export const EFFECTS: Effect[] = ['healing', 'speed', 'shield'];

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

export function emptyGrid(): GridState {
  return {
    ingredients: Array.from({ length: 3 }, () => Array(3).fill('empty') as CellState[]),
    effects: Array.from({ length: 3 }, () => Array(3).fill('empty') as CellState[]),
  };
}

// ── Grid operations ───────────────────────────────────────────────────

function confirmCell(grid: CellState[][], row: number, col: number): void {
  grid[row][col] = 'confirmed';
  // Eliminate other cells in same row
  for (let c = 0; c < 3; c++) {
    if (c !== col && grid[row][c] !== 'confirmed') grid[row][c] = 'eliminated';
  }
  // Eliminate other cells in same column
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
    // If 2 eliminated in a row, confirm the 3rd
    const emptyCols = [];
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
    // If 2 eliminated in a column, confirm the 3rd
    const emptyRows = [];
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

  // If a row has a confirmation, eliminate all other cells in that row
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

    // Cross-grid propagation: if we know potion P has ingredient I and potion P has effect E,
    // we can propagate cross-constraints. But for this simple 3×3 puzzle, within-grid propagation
    // is usually sufficient given the clue types we use.
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

// ── Clue generation ───────────────────────────────────────────────────

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

function generateAllClues(solution: Solution): Clue[] {
  const clues: Clue[] = [];

  // Direct positive — ingredient
  for (const p of POTIONS) {
    const ing = solution.ingredients[p];
    const pName = POTION_NAMES[p];
    const iName = INGREDIENT_NAMES[ing];
    const pi = potionIndex(p);
    const ii = ingredientIndex(ing);
    const template = pickTemplate(DIRECT_POSITIVE_INGREDIENT_TEMPLATES);
    clues.push({
      type: 'direct_positive',
      text: template(pName, iName),
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
    const template = pickTemplate(DIRECT_POSITIVE_EFFECT_TEMPLATES);
    clues.push({
      type: 'direct_positive',
      text: template(pName, eName),
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
      const template = pickTemplate(DIRECT_NEGATIVE_INGREDIENT_TEMPLATES);
      clues.push({
        type: 'direct_negative',
        text: template(pName, iName),
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
      const template = pickTemplate(DIRECT_NEGATIVE_EFFECT_TEMPLATES);
      clues.push({
        type: 'direct_negative',
        text: template(pName, eName),
        apply: (grid: GridState): GridState => {
          const g = cloneGrid(grid);
          eliminateCell(g.effects, pi, ei);
          return g;
        },
      });
    }
  }

  // Relational: "The potion with ingredient X grants effect Y"
  for (const p of POTIONS) {
    const ing = solution.ingredients[p];
    const eff = solution.effects[p];
    const iName = INGREDIENT_NAMES[ing];
    const eName = EFFECT_NAMES[eff];
    const pi = potionIndex(p);
    const ii = ingredientIndex(ing);
    const ei = effectIndex(eff);
    const template = pickTemplate(RELATIONAL_TEMPLATES);
    clues.push({
      type: 'relational',
      text: template(iName, eName),
      apply: (grid: GridState): GridState => {
        const g = cloneGrid(grid);
        // For each potion: if it's confirmed to NOT have this ingredient,
        // then it can't have this effect (and vice versa).
        // If it's confirmed to HAVE this ingredient, it must have this effect.
        for (let r = 0; r < 3; r++) {
          if (g.ingredients[r][ii] === 'confirmed') {
            confirmCell(g.effects, r, ei);
          }
          if (g.ingredients[r][ii] === 'eliminated') {
            eliminateCell(g.effects, r, ei);
          }
          if (g.effects[r][ei] === 'confirmed') {
            confirmCell(g.ingredients, r, ii);
          }
          if (g.effects[r][ei] === 'eliminated') {
            eliminateCell(g.ingredients, r, ii);
          }
        }
        return g;
      },
    });
  }

  // Cross negative: "The potion with ingredient X does NOT grant effect Y"
  for (const p of POTIONS) {
    const ing = solution.ingredients[p];
    for (const eff of EFFECTS) {
      if (solution.effects[p] === eff) continue;
      const iName = INGREDIENT_NAMES[ing];
      const eName = EFFECT_NAMES[eff];
      const ii = ingredientIndex(ing);
      const ei = effectIndex(eff);
      const template = pickTemplate(CROSS_NEGATIVE_TEMPLATES);
      clues.push({
        type: 'cross_negative',
        text: template(iName, eName),
        apply: (grid: GridState): GridState => {
          const g = cloneGrid(grid);
          // For each potion: if it's confirmed to have this ingredient,
          // it cannot have this effect.
          for (let r = 0; r < 3; r++) {
            if (g.ingredients[r][ii] === 'confirmed') {
              eliminateCell(g.effects, r, ei);
            }
            if (g.effects[r][ei] === 'confirmed') {
              eliminateCell(g.ingredients, r, ii);
            }
          }
          return g;
        },
      });
    }
  }

  return clues;
}

// ── Solver ────────────────────────────────────────────────────────────

export function solve(clues: Clue[]): GridState {
  let state = emptyGrid();

  // Apply all clues, then propagate, repeat until stable
  let changed = true;
  while (changed) {
    changed = false;
    for (const clue of clues) {
      const newState = clue.apply(state);
      // Check if anything changed
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

// ── Puzzle generation ─────────────────────────────────────────────────

function generateSolution(): Solution {
  const ings = shuffle(INGREDIENTS) as [Ingredient, Ingredient, Ingredient];
  const effs = shuffle(EFFECTS) as [Effect, Effect, Effect];
  return {
    ingredients: { red: ings[0], blue: ings[1], green: ings[2] },
    effects: { red: effs[0], blue: effs[1], green: effs[2] },
  };
}

export function generatePuzzle(): Puzzle {
  const solution = generateSolution();
  const allClues = generateAllClues(solution);

  // Categorize clues
  const directPositive = allClues.filter(c => c.type === 'direct_positive');
  const relational = allClues.filter(c => c.type === 'relational');
  const directNegative = allClues.filter(c => c.type === 'direct_negative');
  const crossNegative = allClues.filter(c => c.type === 'cross_negative');

  // Try to find a minimal, uniquely-solvable clue set using bucket filtering
  for (let attempt = 0; attempt < 200; attempt++) {
    const selected: Clue[] = [];

    // Pick 0 or 1 direct_positive
    const numDP = Math.random() < 0.6 ? 1 : 0;
    if (numDP > 0 && directPositive.length > 0) {
      selected.push(directPositive[Math.floor(Math.random() * directPositive.length)]);
    }

    // Pick 1-2 relational
    const numRel = Math.random() < 0.5 ? 2 : 1;
    const shuffledRel = shuffle(relational);
    for (let i = 0; i < Math.min(numRel, shuffledRel.length); i++) {
      selected.push(shuffledRel[i]);
    }

    // Pick 1-2 direct_negative or cross_negative
    const negatives = shuffle([...directNegative, ...crossNegative]);
    const numNeg = selected.length < 3 ? 2 : (Math.random() < 0.5 ? 2 : 1);
    for (let i = 0; i < Math.min(numNeg, negatives.length); i++) {
      selected.push(negatives[i]);
    }

    // Target 4-5 clues total
    if (selected.length < 4 || selected.length > 5) continue;

    // Must have at least 1 relational and at most 1 direct_positive
    const dpCount = selected.filter(c => c.type === 'direct_positive').length;
    const relCount = selected.filter(c => c.type === 'relational').length;
    const negCount = selected.filter(c => c.type === 'direct_negative' || c.type === 'cross_negative').length;
    if (dpCount > 1 || relCount < 1 || negCount < 1) continue;

    // Check unique solvability
    if (!isSolvable(selected)) continue;

    // Check minimality: removing any one clue should break solvability
    let isMinimal = true;
    for (let i = 0; i < selected.length; i++) {
      const reduced = [...selected.slice(0, i), ...selected.slice(i + 1)];
      if (isSolvable(reduced)) {
        isMinimal = false;
        break;
      }
    }

    if (isMinimal) {
      return { solution, clues: selected };
    }
  }

  // Fallback: find any uniquely-solvable set of 5 clues
  const shuffledAll = shuffle(allClues);
  for (let size = 4; size <= 5; size++) {
    // Try random combinations
    for (let attempt = 0; attempt < 200; attempt++) {
      const candidates = shuffle(shuffledAll).slice(0, size);
      if (isSolvable(candidates)) {
        return { solution, clues: candidates };
      }
    }
  }

  // Ultimate fallback: use 5 direct positives + 1 relational (guaranteed solvable)
  const fallback = [...shuffle(directPositive).slice(0, 3), ...shuffle(relational).slice(0, 2)];
  return { solution, clues: fallback };
}

// ── Validation ────────────────────────────────────────────────────────

export function validateSubmission(
  playerIngredients: Record<Potion, Ingredient>,
  playerEffects: Record<Potion, Effect>,
  solution: Solution,
): boolean {
  for (const p of POTIONS) {
    if (playerIngredients[p] !== solution.ingredients[p]) return false;
    if (playerEffects[p] !== solution.effects[p]) return false;
  }
  return true;
}

// ── Grid query helpers (for UI) ───────────────────────────────────────

export function extractAssignments(grid: GridState): {
  ingredients: Partial<Record<Potion, Ingredient>>;
  effects: Partial<Record<Potion, Effect>>;
} {
  const ingredients: Partial<Record<Potion, Ingredient>> = {};
  const effects: Partial<Record<Potion, Effect>> = {};

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid.ingredients[r][c] === 'confirmed') {
        ingredients[POTIONS[r]] = INGREDIENTS[c];
      }
      if (grid.effects[r][c] === 'confirmed') {
        effects[POTIONS[r]] = EFFECTS[c];
      }
    }
  }

  return { ingredients, effects };
}

export function countConfirmations(grid: GridState): { ingredients: number; effects: number } {
  let ing = 0;
  let eff = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid.ingredients[r][c] === 'confirmed') ing++;
      if (grid.effects[r][c] === 'confirmed') eff++;
    }
  }
  return { ingredients: ing, effects: eff };
}

export function isValidGridState(grid: CellState[][]): boolean {
  // No row or column has more than 1 confirmation
  for (let r = 0; r < 3; r++) {
    let count = 0;
    for (let c = 0; c < 3; c++) {
      if (grid[r][c] === 'confirmed') count++;
    }
    if (count > 1) return false;
  }
  for (let c = 0; c < 3; c++) {
    let count = 0;
    for (let r = 0; r < 3; r++) {
      if (grid[r][c] === 'confirmed') count++;
    }
    if (count > 1) return false;
  }
  return true;
}

export function isGridComplete(state: GridState): boolean {
  return isFullyDetermined(state);
}

// ── Auto-marking system ───────────────────────────────────────────────

export type GridId = 'ingredients' | 'effects';

export interface CellCoord {
  grid: GridId;
  row: number;
  col: number;
}

export interface ManualMarks {
  confirms: CellCoord[];
  eliminations: CellCoord[];
}

export type CellOrigin =
  | 'empty'
  | 'manual_confirmed'
  | 'manual_eliminated'
  | 'auto_confirmed'
  | 'auto_eliminated';

export interface ComputedGridState {
  grid: GridState;
  origins: { ingredients: CellOrigin[][]; effects: CellOrigin[][] };
}

export function emptyManualMarks(): ManualMarks {
  return { confirms: [], eliminations: [] };
}

function emptyOrigins(): ComputedGridState['origins'] {
  return {
    ingredients: Array.from({ length: 3 }, () => Array<CellOrigin>(3).fill('empty')),
    effects: Array.from({ length: 3 }, () => Array<CellOrigin>(3).fill('empty')),
  };
}

/**
 * Pure recomputation of the full grid from only the player's manual marks.
 * 1. Place manual ✗s
 * 2. Place manual ✓s (auto-eliminate rest of row/col)
 * 3. Cascade: any row/col with one empty cell left → auto-confirm → repeat
 */
export function computeGridState(marks: ManualMarks): ComputedGridState {
  const grid = emptyGrid();
  const origins = emptyOrigins();

  // 1. Place all manual eliminations
  for (const coord of marks.eliminations) {
    grid[coord.grid][coord.row][coord.col] = 'eliminated';
    origins[coord.grid][coord.row][coord.col] = 'manual_eliminated';
  }

  // 2. Place all manual confirmations + auto-eliminate their row/col
  for (const coord of marks.confirms) {
    const g = grid[coord.grid];
    const o = origins[coord.grid];

    g[coord.row][coord.col] = 'confirmed';
    o[coord.row][coord.col] = 'manual_confirmed';

    for (let c = 0; c < 3; c++) {
      if (c !== coord.col && g[coord.row][c] === 'empty') {
        g[coord.row][c] = 'eliminated';
        o[coord.row][c] = 'auto_eliminated';
      }
    }
    for (let r = 0; r < 3; r++) {
      if (r !== coord.row && g[r][coord.col] === 'empty') {
        g[r][coord.col] = 'eliminated';
        o[r][coord.col] = 'auto_eliminated';
      }
    }
  }

  // 3. Cascade until stable
  let changed = true;
  while (changed) {
    changed = false;

    for (const gridId of ['ingredients', 'effects'] as GridId[]) {
      const g = grid[gridId];
      const o = origins[gridId];

      // Rows: if one empty cell remains and no confirm yet, auto-confirm it
      for (let r = 0; r < 3; r++) {
        const emptyCols: number[] = [];
        let hasConfirm = false;
        for (let c = 0; c < 3; c++) {
          if (g[r][c] === 'empty') emptyCols.push(c);
          if (g[r][c] === 'confirmed') hasConfirm = true;
        }
        if (!hasConfirm && emptyCols.length === 1) {
          const c = emptyCols[0];
          g[r][c] = 'confirmed';
          o[r][c] = 'auto_confirmed';
          for (let c2 = 0; c2 < 3; c2++) {
            if (c2 !== c && g[r][c2] === 'empty') {
              g[r][c2] = 'eliminated';
              o[r][c2] = 'auto_eliminated';
            }
          }
          for (let r2 = 0; r2 < 3; r2++) {
            if (r2 !== r && g[r2][c] === 'empty') {
              g[r2][c] = 'eliminated';
              o[r2][c] = 'auto_eliminated';
            }
          }
          changed = true;
        }
      }

      // Columns: if one empty cell remains and no confirm yet, auto-confirm it
      for (let c = 0; c < 3; c++) {
        const emptyRows: number[] = [];
        let hasConfirm = false;
        for (let r = 0; r < 3; r++) {
          if (g[r][c] === 'empty') emptyRows.push(r);
          if (g[r][c] === 'confirmed') hasConfirm = true;
        }
        if (!hasConfirm && emptyRows.length === 1) {
          const r = emptyRows[0];
          g[r][c] = 'confirmed';
          o[r][c] = 'auto_confirmed';
          for (let c2 = 0; c2 < 3; c2++) {
            if (c2 !== c && g[r][c2] === 'empty') {
              g[r][c2] = 'eliminated';
              o[r][c2] = 'auto_eliminated';
            }
          }
          for (let r2 = 0; r2 < 3; r2++) {
            if (r2 !== r && g[r2][c] === 'empty') {
              g[r2][c] = 'eliminated';
              o[r2][c] = 'auto_eliminated';
            }
          }
          changed = true;
        }
      }
    }
  }

  return { grid, origins };
}
