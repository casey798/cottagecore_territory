import { ImageSourcePropType } from 'react-native';

export const PLAYER_DOT_IMAGES: Record<string, ImageSourcePropType> = {
  ember: require('../assets/sprites/players/player_ember.png'),
  tide: require('../assets/sprites/players/player_tide.png'),
  bloom: require('../assets/sprites/players/player_bloom.png'),
  gale: require('../assets/sprites/players/player_gale.png'),
  hearth: require('../assets/sprites/players/player_hearth.png'),
};

export const GPS_RING_COLORS: Record<string, { fill: string; stroke: string }> = {
  ember: {
    fill: 'rgba(158, 85, 80, 0.18)',
    stroke: 'rgba(158, 85, 80, 0.45)',
  },
  tide: {
    fill: 'rgba(78, 127, 163, 0.18)',
    stroke: 'rgba(78, 127, 163, 0.45)',
  },
  bloom: {
    fill: 'rgba(196, 168, 50, 0.18)',
    stroke: 'rgba(196, 168, 50, 0.45)',
  },
  gale: {
    fill: 'rgba(74, 153, 102, 0.18)',
    stroke: 'rgba(74, 153, 102, 0.45)',
  },
  hearth: {
    fill: 'rgba(110, 80, 130, 0.18)',
    stroke: 'rgba(110, 80, 130, 0.45)',
  },
};
