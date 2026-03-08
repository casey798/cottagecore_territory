import { ClanId } from '@/types';

export const CLAN_COLORS: Record<ClanId, string> = {
  ember: '#C0392B',
  tide: '#2980B9',
  bloom: '#F1C40F',
  gale: '#27AE60',
};

export const PALETTE = {
  darkBrown: '#3D2B1F',
  warmBrown: '#8B6914',
  cream: '#FFF5DC',
  softGreen: '#7CAA5E',
  deepGreen: '#2D5A27',
  honeyGold: '#D4A843',
  mutedRose: '#C48B8B',
  softBlue: '#7BA3C4',
  parchmentBg: '#F5EACB',
  stoneGrey: '#A0937D',
} as const;

export const UI = {
  background: PALETTE.parchmentBg,
  text: PALETTE.darkBrown,
  textMuted: PALETTE.stoneGrey,
  border: PALETTE.warmBrown,
  overlay: 'rgba(61, 43, 31, 0.5)',
} as const;
