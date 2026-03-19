import type { VineTrailPack } from './vineTrailPacks';

export type CellCoord = [number, number]; // [row, col]

export interface WordState {
  word: string;
  canonicalPath: CellCoord[];
  isSpangram: boolean;
  found: boolean;
  foundPath: CellCoord[] | null;
}

export interface VineTrailState {
  pack: VineTrailPack;
  words: WordState[];
  selectedPath: CellCoord[];
  lockedCells: Set<string>;
  hintActive: boolean;
  hintPath: CellCoord[] | null;
  hintsRemaining: number;
  lastHintTime: number;
  timeElapsed: number;
  gameOver: boolean;
  won: boolean;
}

export function initGame(pack: VineTrailPack): VineTrailState {
  return {
    pack,
    words: pack.words.map(w => ({
      word: w.word,
      canonicalPath: w.path as CellCoord[],
      isSpangram: w.isSpangram,
      found: false,
      foundPath: null,
    })),
    selectedPath: [],
    lockedCells: new Set(),
    hintActive: false,
    hintPath: null,
    hintsRemaining: 3,
    lastHintTime: -20,
    timeElapsed: 0,
    gameOver: false,
    won: false,
  };
}

export function isAdjacent(a: CellCoord, b: CellCoord): boolean {
  if (a[0] === b[0] && a[1] === b[1]) return false;
  return Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
}

export function isValidPath(path: CellCoord[], _grid: string[][]): boolean {
  if (path.length === 0) return true;
  const seen = new Set<string>();
  for (let i = 0; i < path.length; i++) {
    const key = `${path[i][0]},${path[i][1]}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (i > 0 && !isAdjacent(path[i - 1], path[i])) return false;
  }
  return true;
}

export function getWordFromPath(path: CellCoord[], grid: string[][]): string {
  return path.map(([r, c]) => grid[r][c]).join('');
}

export function findAlternatePath(
  word: string,
  grid: string[][],
  _canonicalPath: CellCoord[],
  lockedCells: Set<string>,
): CellCoord[] | null {
  const rows = grid.length;
  const cols = grid[0].length;
  const target = word.toUpperCase();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (lockedCells.has(`${r},${c}`)) continue;
      if (grid[r][c] !== target[0]) continue;
      const result = dfs(grid, target, 0, r, c, [], new Set(), lockedCells, rows, cols);
      if (result) return result;
    }
  }
  return null;
}

function dfs(
  grid: string[][],
  target: string,
  idx: number,
  r: number,
  c: number,
  path: CellCoord[],
  visited: Set<string>,
  lockedCells: Set<string>,
  rows: number,
  cols: number,
): CellCoord[] | null {
  const key = `${r},${c}`;
  if (lockedCells.has(key) || visited.has(key)) return null;
  if (grid[r][c] !== target[idx]) return null;

  const newPath: CellCoord[] = [...path, [r, c]];
  if (idx === target.length - 1) return newPath;

  const newVisited = new Set(visited);
  newVisited.add(key);

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const result = dfs(grid, target, idx + 1, nr, nc, newPath, newVisited, lockedCells, rows, cols);
      if (result) return result;
    }
  }
  return null;
}

export function tapCell(state: VineTrailState, cell: CellCoord): VineTrailState {
  if (state.gameOver) return state;

  const cellKey = `${cell[0]},${cell[1]}`;

  // If cell is locked, do nothing
  if (state.lockedCells.has(cellKey)) return state;

  const { selectedPath } = state;

  // If cell is already in selectedPath, trim back to it
  const existingIdx = selectedPath.findIndex(
    ([r, c]) => r === cell[0] && c === cell[1],
  );
  if (existingIdx !== -1) {
    // If it's the last cell, do nothing
    if (existingIdx === selectedPath.length - 1) return state;
    return { ...state, selectedPath: selectedPath.slice(0, existingIdx + 1) };
  }

  // If path is empty, add the cell
  if (selectedPath.length === 0) {
    return { ...state, selectedPath: [[cell[0], cell[1]]] };
  }

  // Must be adjacent to last selected cell
  const last = selectedPath[selectedPath.length - 1];
  if (!isAdjacent(last, cell)) return state;

  return { ...state, selectedPath: [...selectedPath, [cell[0], cell[1]]] };
}

function pathsEqual(a: CellCoord[], b: CellCoord[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((cell, i) => cell[0] === b[i][0] && cell[1] === b[i][1]);
}

export function submitWord(
  state: VineTrailState,
): {
  newState: VineTrailState;
  result: 'correct' | 'wrong' | 'already_found';
  canonicalPath: CellCoord[] | null;
  usedAlternatePath: boolean;
} {
  const word = getWordFromPath(state.selectedPath, state.pack.grid).toUpperCase();

  const matchIdx = state.words.findIndex(
    w => w.word.toUpperCase() === word,
  );

  if (matchIdx === -1) {
    return {
      newState: { ...state, selectedPath: [] },
      result: 'wrong',
      canonicalPath: null,
      usedAlternatePath: false,
    };
  }

  const matchedWord = state.words[matchIdx];

  if (matchedWord.found) {
    return {
      newState: { ...state, selectedPath: [] },
      result: 'already_found',
      canonicalPath: matchedWord.canonicalPath,
      usedAlternatePath: false,
    };
  }

  // Check if user's path matches canonical exactly
  const isCanonical = pathsEqual(state.selectedPath, matchedWord.canonicalPath);
  let usedAlternatePath = false;

  if (!isCanonical) {
    // Verify the user's path is valid (adjacent, no locked cells, spells the word)
    const userWord = getWordFromPath(state.selectedPath, state.pack.grid).toUpperCase();
    const pathValid = isValidPath(state.selectedPath, state.pack.grid);
    const noLockedUsed = !state.selectedPath.some(([r, c]) =>
      state.lockedCells.has(`${r},${c}`),
    );
    if (userWord === matchedWord.word.toUpperCase() && pathValid && noLockedUsed) {
      usedAlternatePath = true;
    } else {
      return {
        newState: { ...state, selectedPath: [] },
        result: 'wrong',
        canonicalPath: null,
        usedAlternatePath: false,
      };
    }
  }

  // Lock canonical path cells
  const newLockedCells = new Set(state.lockedCells);
  for (const [r, c] of matchedWord.canonicalPath) {
    newLockedCells.add(`${r},${c}`);
  }

  // Mark word as found
  const newWords = state.words.map((w, i) =>
    i === matchIdx
      ? { ...w, found: true, foundPath: [...state.selectedPath] as CellCoord[] }
      : w,
  );

  const allFound = newWords.every(w => w.found);

  return {
    newState: {
      ...state,
      words: newWords,
      selectedPath: [],
      lockedCells: newLockedCells,
      gameOver: allFound,
      won: allFound,
    },
    result: 'correct',
    canonicalPath: matchedWord.canonicalPath,
    usedAlternatePath,
  };
}

export function getHint(state: VineTrailState): VineTrailState {
  if (state.hintsRemaining <= 0 || state.gameOver) return state;
  if (state.timeElapsed < 30) return state;
  if (state.lastHintTime >= 0 && state.timeElapsed - state.lastHintTime < 20) return state;

  // Pick random unfound non-spangram first
  const unfoundNonSpangram = state.words.filter(w => !w.found && !w.isSpangram);
  const unfoundSpangram = state.words.filter(w => !w.found && w.isSpangram);

  let target: WordState | undefined;
  if (unfoundNonSpangram.length > 0) {
    target = unfoundNonSpangram[Math.floor(Math.random() * unfoundNonSpangram.length)];
  } else if (unfoundSpangram.length > 0) {
    target = unfoundSpangram[0];
  }

  if (!target) return state;

  return {
    ...state,
    hintActive: true,
    hintPath: target.canonicalPath,
    hintsRemaining: state.hintsRemaining - 1,
    lastHintTime: state.timeElapsed,
  };
}

export function clearHint(state: VineTrailState): VineTrailState {
  return { ...state, hintActive: false, hintPath: null };
}

export function tickTimer(state: VineTrailState, timeLimit: number): VineTrailState {
  const newTime = state.timeElapsed + 1;
  const timedOut = newTime >= timeLimit && !state.won;
  return {
    ...state,
    timeElapsed: newTime,
    gameOver: state.gameOver || timedOut,
  };
}
