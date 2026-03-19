import { PALETTE } from '@/constants/colors';

export interface CharacterPreset {
  index: number;
  emoji: string;
  color: string;
}

/**
 * 8 character presets (1-based index). Index 0 means "not set".
 */
export const CHARACTER_PRESETS: CharacterPreset[] = [
  { index: 1, emoji: '\u{1F9D1}', color: PALETTE.warmBrown },
  { index: 2, emoji: '\u{1F9D2}', color: PALETTE.softGreen },
  { index: 3, emoji: '\u{1F467}', color: PALETTE.mutedRose },
  { index: 4, emoji: '\u{1F9D4}', color: PALETTE.softBlue },
  { index: 5, emoji: '\u{1F469}', color: PALETTE.honeyGold },
  { index: 6, emoji: '\u{1F9D3}', color: PALETTE.stoneGrey },
  { index: 7, emoji: '\u{1F466}', color: PALETTE.deepGreen },
  { index: 8, emoji: '\u{1F474}', color: PALETTE.errorRed },
];

export function getPresetByIndex(index: number): CharacterPreset | undefined {
  return CHARACTER_PRESETS.find((p) => p.index === index);
}
