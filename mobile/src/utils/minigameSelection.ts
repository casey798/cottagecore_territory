import { MinigameInfo } from '@/types';
import { MINIGAME_DIFFICULTY } from '@/constants/minigames';

/** Pick `count` random items from `arr` (non-destructive). */
function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  // Fisher-Yates shuffle
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

const TARGET_EASY = 2;
const TARGET_MEDIUM = 3;
const TARGET_HARD = 1;
const TARGET_TOTAL = TARGET_EASY + TARGET_MEDIUM + TARGET_HARD; // 6

/**
 * Select minigames by difficulty: 2 Easy + 3 Medium + 1 Hard.
 * If a bucket has fewer than needed, take all available and compensate from Medium.
 * Returns games ordered by difficulty: Easy first, then Medium, then Hard.
 */
export function selectMinigamesByDifficulty(allMinigames: MinigameInfo[]): MinigameInfo[] {
  const easy: MinigameInfo[] = [];
  const medium: MinigameInfo[] = [];
  const hard: MinigameInfo[] = [];

  for (const mg of allMinigames) {
    const diff = MINIGAME_DIFFICULTY[mg.minigameId];
    if (diff === 'easy') easy.push(mg);
    else if (diff === 'hard') hard.push(mg);
    else medium.push(mg); // default to medium for unknown IDs
  }

  const pickedEasy = pickRandom(easy, TARGET_EASY);
  const pickedHard = pickRandom(hard, TARGET_HARD);

  // Shortfall from easy/hard gets compensated from medium
  const shortfall = (TARGET_EASY - pickedEasy.length) + (TARGET_HARD - pickedHard.length);
  const pickedMedium = pickRandom(medium, TARGET_MEDIUM + shortfall);

  // Ordered by difficulty: Easy → Medium → Hard
  const result = [...pickedEasy, ...pickedMedium, ...pickedHard];

  return result.slice(0, TARGET_TOTAL);
}
