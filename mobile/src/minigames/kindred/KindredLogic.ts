export interface GroupDefinition {
  label: string;
  words: [string, string, string, string];
}

export interface GroupPack {
  groups: [GroupDefinition, GroupDefinition, GroupDefinition, GroupDefinition];
}

import { GROUP_PACKS } from './groupPacks';

export const MAX_MISTAKES = 8;

export interface KindredPuzzle {
  words: string[];
  groups: GroupDefinition[];
}

export interface CheckGroupResult {
  correct: boolean;
  groupIndex: number | null;
  label: string | null;
}

export interface ValidateSolutionResult {
  solved: boolean;
}

/**
 * Fisher-Yates shuffle (immutable — returns a new array).
 */
function shuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Pick a random pack from the full pool.
 */
export function generatePuzzle(): KindredPuzzle {
  const pack = GROUP_PACKS[Math.floor(Math.random() * GROUP_PACKS.length)];

  const allWords = pack.groups.flatMap((g: GroupDefinition) => g.words);
  const words = shuffle(allWords);

  return {
    words,
    groups: [...pack.groups],
  };
}

/**
 * Check whether the 4 selected words form a correct group.
 * Returns the group index and category if correct; null otherwise.
 */
export function checkGroup(
  selectedWords: string[],
  groups: GroupDefinition[],
): CheckGroupResult {
  if (selectedWords.length !== 4) {
    return { correct: false, groupIndex: null, label: null };
  }

  const sorted = [...selectedWords].sort();

  for (let i = 0; i < groups.length; i++) {
    const groupSorted = [...groups[i].words].sort();
    if (
      sorted[0] === groupSorted[0] &&
      sorted[1] === groupSorted[1] &&
      sorted[2] === groupSorted[2] &&
      sorted[3] === groupSorted[3]
    ) {
      return { correct: true, groupIndex: i, label: groups[i].label };
    }
  }

  return { correct: false, groupIndex: null, label: null };
}

/**
 * Validate a completed (or failed) puzzle submission.
 * `puzzle` is the original puzzle; `submission` contains which groups were found.
 */
export function validateSolution(
  puzzle: KindredPuzzle,
  submission: { groupsFound: string[][] },
): ValidateSolutionResult {
  if (submission.groupsFound.length !== puzzle.groups.length) {
    return { solved: false };
  }

  // Every found group must match exactly one puzzle group
  const matched = new Set<number>();

  for (const found of submission.groupsFound) {
    const sortedFound = [...found].sort();
    let didMatch = false;

    for (let i = 0; i < puzzle.groups.length; i++) {
      if (matched.has(i)) continue;
      const groupSorted = [...puzzle.groups[i].words].sort();
      if (
        sortedFound[0] === groupSorted[0] &&
        sortedFound[1] === groupSorted[1] &&
        sortedFound[2] === groupSorted[2] &&
        sortedFound[3] === groupSorted[3]
      ) {
        matched.add(i);
        didMatch = true;
        break;
      }
    }

    if (!didMatch) {
      return { solved: false };
    }
  }

  return { solved: matched.size === puzzle.groups.length };
}
