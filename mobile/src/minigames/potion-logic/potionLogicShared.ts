// potionLogicShared.ts — Shared display constants for Potion Logic (solo + co-op).

import { PALETTE } from '@/constants/colors';
import type { CellState, CellOrigin, Potion, Ingredient, Effect } from './PotionLogicLogic';

export const POTION_DISPLAY: Record<Potion, { color: string; label: string }> = {
  red: { color: PALETTE.errorRed, label: 'Red' },
  blue: { color: PALETTE.playerBlue, label: 'Blue' },
  green: { color: PALETTE.successGreen, label: 'Green' },
};

export const INGREDIENT_LABELS: Record<Ingredient, string> = {
  herb: '\u{1F33F}Herb',
  crystal: '\u{1F48E}Crys',
  mushroom: '\u{1F344}Mush',
};

export const EFFECT_LABELS: Record<Effect, string> = {
  healing: '\u{1F49A}Heal',
  speed: '\u26A1Spd',
  shield: '\u{1F6E1}Shld',
};

export const CELL_COLORS = {
  autoEliminated: PALETTE.gridAutoEliminated,
  manualEliminated: PALETTE.gridManualEliminated,
  autoConfirmed: PALETTE.gridAutoConfirmed,
  manualConfirmed: PALETTE.gridManualConfirmed,
} as const;

export function cellBg(origin: CellOrigin, state: CellState): string {
  if (state === 'empty') return PALETTE.cream;
  if (origin === 'auto_eliminated') return CELL_COLORS.autoEliminated;
  if (origin === 'manual_eliminated') return CELL_COLORS.manualEliminated;
  if (origin === 'auto_confirmed') return CELL_COLORS.autoConfirmed;
  if (origin === 'manual_confirmed') return CELL_COLORS.manualConfirmed;
  return PALETTE.cream;
}

export function cellSymbol(state: CellState): string {
  if (state === 'confirmed') return '\u2713';
  if (state === 'eliminated') return '\u2717';
  return '';
}
