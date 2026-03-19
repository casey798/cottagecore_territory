import { ImageRequireSource } from 'react-native';

export interface ShiftSlideImage {
  id: string;
  label: string;
  source: ImageRequireSource;
}

export const SHIFT_SLIDE_IMAGES: ShiftSlideImage[] = [
  { id: 'fox-face',         label: 'Fox',            source: require('../../assets/sprites/minigames/shift-slide/fox-face.png') },
  { id: 'mushroom-cluster', label: 'Mushrooms',      source: require('../../assets/sprites/minigames/shift-slide/mushroom-cluster.png') },
  { id: 'flowers',          label: 'Flower Basket',  source: require('../../assets/sprites/minigames/shift-slide/flowers.png') },
  { id: 'cottage',          label: 'Cottage',        source: require('../../assets/sprites/minigames/shift-slide/cottage.png') },
  { id: 'owl',              label: 'Owl',            source: require('../../assets/sprites/minigames/shift-slide/owl.png') },
  { id: 'butterfly',        label: 'Butterfly',      source: require('../../assets/sprites/minigames/shift-slide/butterfly.png') },
  { id: 'hedgehog',         label: 'Hedgehog',       source: require('../../assets/sprites/minigames/shift-slide/hedgehog.png') },
  { id: 'watering-can',     label: 'Watering Can',   source: require('../../assets/sprites/minigames/shift-slide/watering-can.png') },
  { id: 'bird-on-branch',   label: 'Robin',          source: require('../../assets/sprites/minigames/shift-slide/bird-on-branch.png') },
  { id: 'sunflower',        label: 'Sunflower',      source: require('../../assets/sprites/minigames/shift-slide/sunflower.png') },
];

export function getImageById(id: string): ShiftSlideImage | undefined {
  return SHIFT_SLIDE_IMAGES.find((img) => img.id === id);
}
