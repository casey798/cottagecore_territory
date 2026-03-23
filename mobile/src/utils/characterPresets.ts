import type { ImageSourcePropType } from 'react-native';
import type { AvatarConfig } from '@/types';

export interface CharacterPreset {
  id: number;
  name: string;
  icon: ImageSourcePropType;
  fullBody: ImageSourcePropType;
  avatarConfig: AvatarConfig;
}

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 0,
    name: 'Reed',
    icon: require('../assets/sprites/character/reed.png'),
    fullBody: require('../assets/sprites/character/reed_big.png'),
    avatarConfig: { hairStyle: 0, hairColor: 2, skinTone: 3, outfit: 1, accessory: 0 },
  },
  {
    id: 1,
    name: 'Milo',
    icon: require('../assets/sprites/character/milo.png'),
    fullBody: require('../assets/sprites/character/milo_big.png'),
    avatarConfig: { hairStyle: 1, hairColor: 5, skinTone: 1, outfit: 3, accessory: 2 },
  },
  {
    id: 2,
    name: 'Sage',
    icon: require('../assets/sprites/character/sage.png'),
    fullBody: require('../assets/sprites/character/sage_big.png'),
    avatarConfig: { hairStyle: 2, hairColor: 0, skinTone: 5, outfit: 4, accessory: 1 },
  },
  {
    id: 3,
    name: 'Wren',
    icon: require('../assets/sprites/character/wren.png'),
    fullBody: require('../assets/sprites/character/wren_big.png'),
    avatarConfig: { hairStyle: 3, hairColor: 7, skinTone: 2, outfit: 6, accessory: 3 },
  },
  {
    id: 4,
    name: 'Fern',
    icon: require('../assets/sprites/character/fern.png'),
    fullBody: require('../assets/sprites/character/fern_big.png'),
    avatarConfig: { hairStyle: 5, hairColor: 3, skinTone: 4, outfit: 0, accessory: 4 },
  },
  {
    id: 5,
    name: 'Hazel',
    icon: require('../assets/sprites/character/hazel.png'),
    fullBody: require('../assets/sprites/character/hazel_big.png'),
    avatarConfig: { hairStyle: 4, hairColor: 1, skinTone: 6, outfit: 5, accessory: 0 },
  },
  {
    id: 6,
    name: 'Ivy',
    icon: require('../assets/sprites/character/ivy.png'),
    fullBody: require('../assets/sprites/character/ivy_big.png'),
    avatarConfig: { hairStyle: 6, hairColor: 4, skinTone: 0, outfit: 2, accessory: 5 },
  },
  {
    id: 7,
    name: 'Cob',
    icon: require('../assets/sprites/character/cob.png'),
    fullBody: require('../assets/sprites/character/cob_big.png'),
    avatarConfig: { hairStyle: 7, hairColor: 6, skinTone: 7, outfit: 7, accessory: 0 },
  },
];

export function getPresetById(id: number): CharacterPreset | undefined {
  return CHARACTER_PRESETS.find((p) => p.id === id);
}
