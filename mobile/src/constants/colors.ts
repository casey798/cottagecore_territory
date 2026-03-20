import { ClanId } from '@/types';

export const CLAN_COLORS: Record<ClanId, string> = {
  ember: '#9E5550',
  tide: '#4E7FA3',
  bloom: '#C4A832',
  gale: '#4A9966',
  hearth: '#6E5082',
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
  amberLight: '#F0C060',
  amberStrong: '#F0A020',
  errorRed: '#C0392B',
} as const;

export const LORE_CLANS = [
  {
    id: 'seekers',
    name: 'Seekers',
    element: 'Paths & Discovery',
    description: 'Wandered the paths and discovered hidden places.',
    emoji: '🧭',
    color: '#4A9966',
  },
  {
    id: 'guardians',
    name: 'Guardians',
    element: 'Balance & Ground',
    description: 'Watched the grounds and protected the balance of the land.',
    emoji: '🛡️',
    color: '#6E5082',
  },
  {
    id: 'makers',
    name: 'Makers',
    element: 'Craft & Wonders',
    description: 'Shaped tools, crafted wonders, turned simple things into treasures.',
    emoji: '⚒️',
    color: '#C4A832',
  },
  {
    id: 'wardens',
    name: 'Wardens',
    element: 'Wind & Trees',
    description: 'Listened to the wind and the trees, learning the quiet language of nature.',
    emoji: '🌿',
    color: '#9E5550',
  },
  {
    id: 'chroniclers',
    name: 'Chroniclers',
    element: 'Memory & Story',
    description: 'Remembered everything — every path walked, every story told.',
    emoji: '📜',
    color: '#4E7FA3',
  },
] as const;

export const CLAN_TO_LORE_MAP: Record<string, string> = {
  ember: 'wardens',
  tide: 'chroniclers',
  bloom: 'makers',
  gale: 'seekers',
  hearth: 'guardians',
};

/** Keyboard / tile feedback colors shared by Grove Words and Cipher Stones. */
export const KEYBOARD = {
  correctGreen: '#538D4E',
  presentYellow: '#B59F3B',
  absentGray: '#3A3A3C',
  defaultBg: '#D3D6DA',
  textDark: '#1A1A1B',
  textLight: '#FFFFFF',
  wrongTileBg: '#C48B8B',
} as const;

export const UI = {
  background: PALETTE.parchmentBg,
  text: PALETTE.darkBrown,
  textMuted: PALETTE.stoneGrey,
  border: PALETTE.warmBrown,
  overlay: 'rgba(61, 43, 31, 0.5)',
  modalBackdrop: 'rgba(0, 0, 0, 0.55)',
} as const;
