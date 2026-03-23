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
  loseBackground: '#E8DCC8',
  midBrown: '#A0784C',
  warmGreyBrown: '#7A6652',
  amberLight: '#F0C060',
  amberStrong: '#F0A020',
  errorRed: '#C0392B',
  parchmentMid: '#E8D9B0',
  parchmentLight: '#D6CAAD',
  playerBlue: '#2980B9',
  successGreen: '#27AE60',
  // Semi-transparent variants
  warmBrownFaint: 'rgba(139, 105, 20, 0.12)',
  warmBrownLight: 'rgba(139, 105, 20, 0.19)',
  warmBrownMild: 'rgba(139, 105, 20, 0.25)',
  darkBrownFaint: 'rgba(61, 43, 31, 0.03)',
  stoneGreyLight: 'rgba(160, 147, 125, 0.19)',
  parchment: '#F5EACB',
  goldOverlay: 'rgba(255, 215, 0, 0.9)',
  goldHalf: 'rgba(255, 215, 0, 0.5)',
  debugText: '#1E140F',
  white: '#FFFFFF',
  blackOverlay60: 'rgba(0, 0, 0, 0.6)',
  whiteStroke60: 'rgba(255, 255, 255, 0.6)',
  successToast: 'rgba(39, 174, 96, 0.9)',
  tileOnBorder: '#1a3a18',
  parchmentDark: '#E8DCC8',
  // Logic grid cell colors
  gridAutoEliminated: '#EAE4DA',
  gridManualEliminated: '#E0D8CC',
  gridAutoConfirmed: '#C4E0B0',
  gridManualConfirmed: '#B8D9A0',
  clueHighlight: '#FFF8E7',
  glassWhite30: 'rgba(255, 255, 255, 0.3)',
  borderBlack15: 'rgba(0, 0, 0, 0.15)',
  // Mosaic minigame colors
  mosaicGridBg: '#F0E6D0',
  mosaicTargetCell: '#E8E0D0',
  stoneGreyMid: 'rgba(160, 147, 125, 0.35)',
  blackOverlay12: 'rgba(0, 0, 0, 0.12)',
  blackOverlay50: 'rgba(0, 0, 0, 0.5)',
  black: '#000000',
  ghostValidFill: 'rgba(122, 188, 94, 0.45)',
  ghostInvalidFill: 'rgba(226, 75, 74, 0.45)',
  overlapRed50: 'rgba(226, 75, 74, 0.5)',
  ghostValidBorder: 'rgba(45, 90, 39, 0.7)',
  ghostInvalidBorder: 'rgba(180, 50, 50, 0.7)',
  mushroomRed: '#C0392B',
} as const;

export const CLAN_LABELS: Record<ClanId, string> = {
  ember: 'Seekers',
  tide: 'Guardians',
  bloom: 'Wardens',
  gale: 'Keepers',
  hearth: 'Chroniclers',
};

export const LORE_CLANS = [
  {
    id: 'seekers',
    name: 'Seekers',
    element: 'Paths & Discovery',
    description: 'Wandered the paths and discovered hidden places.',
    emoji: '🧭',
    color: '#9E5550',
  },
  {
    id: 'guardians',
    name: 'Guardians',
    element: 'Balance & Ground',
    description: 'Watched the grounds and protected the balance of the land.',
    emoji: '🛡️',
    color: '#4E7FA3',
  },
  {
    id: 'keepers',
    name: 'Keepers',
    element: 'Craft & Wonders',
    description: 'Shaped tools, crafted wonders, turned simple things into treasures.',
    emoji: '⚒️',
    color: '#4A9966',
  },
  {
    id: 'wardens',
    name: 'Wardens',
    element: 'Wind & Trees',
    description: 'Listened to the wind and the trees, learning the quiet language of nature.',
    emoji: '🌿',
    color: '#C4A832',
  },
  {
    id: 'chroniclers',
    name: 'Chroniclers',
    element: 'Memory & Story',
    description: 'Remembered everything — every path walked, every story told.',
    emoji: '📜',
    color: '#6E5082',
  },
] as const;

export const CLAN_TO_LORE_MAP: Record<string, string> = {
  ember: 'seekers',
  tide: 'guardians',
  bloom: 'wardens',
  gale: 'keepers',
  hearth: 'chroniclers',
};

/** Keyboard / tile feedback colors shared by Wordle and Cipher Stones. */
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
  statusConnected: '#27AE60',
  statusDisconnected: '#95A5A6',
} as const;
