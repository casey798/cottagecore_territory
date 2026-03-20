import { PALETTE } from '@/constants/colors';
import type { AvatarConfig } from '@/types';

export interface CharacterPreset {
  id: number;
  emoji: string;
  label: string;
  color: string;
  avatarConfig: AvatarConfig;
}

/**
 * 8 character presets (1-based id). Each maps to a unique AvatarConfig.
 */
export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 1,
    emoji: '\u{1F9D1}',
    label: 'The Scholar',
    color: PALETTE.warmBrown,
    avatarConfig: { hairStyle: 0, hairColor: 0, skinTone: 0, outfit: 0, accessory: 0 },
  },
  {
    id: 2,
    emoji: '\u{1F9D2}',
    label: 'The Sprout',
    color: PALETTE.softGreen,
    avatarConfig: { hairStyle: 1, hairColor: 1, skinTone: 1, outfit: 1, accessory: 1 },
  },
  {
    id: 3,
    emoji: '\u{1F467}',
    label: 'The Wanderer',
    color: PALETTE.mutedRose,
    avatarConfig: { hairStyle: 2, hairColor: 2, skinTone: 2, outfit: 2, accessory: 2 },
  },
  {
    id: 4,
    emoji: '\u{1F9D4}',
    label: 'The Farmer',
    color: PALETTE.softBlue,
    avatarConfig: { hairStyle: 3, hairColor: 3, skinTone: 3, outfit: 3, accessory: 3 },
  },
  {
    id: 5,
    emoji: '\u{1F469}',
    label: 'The Keeper',
    color: PALETTE.honeyGold,
    avatarConfig: { hairStyle: 4, hairColor: 4, skinTone: 4, outfit: 4, accessory: 4 },
  },
  {
    id: 6,
    emoji: '\u{1F9D3}',
    label: 'The Elder',
    color: PALETTE.stoneGrey,
    avatarConfig: { hairStyle: 5, hairColor: 5, skinTone: 5, outfit: 5, accessory: 5 },
  },
  {
    id: 7,
    emoji: '\u{1F466}',
    label: 'The Scout',
    color: PALETTE.deepGreen,
    avatarConfig: { hairStyle: 6, hairColor: 6, skinTone: 6, outfit: 6, accessory: 0 },
  },
  {
    id: 8,
    emoji: '\u{1F474}',
    label: 'The Hermit',
    color: PALETTE.errorRed,
    avatarConfig: { hairStyle: 7, hairColor: 7, skinTone: 7, outfit: 7, accessory: 0 },
  },
];

export function getPresetById(id: number): CharacterPreset | undefined {
  return CHARACTER_PRESETS.find((p) => p.id === id);
}
