import React from 'react';
import {
  Image as SkiaImage,
  RoundedRect,
  Text as SkiaText,
  Group,
  useImage,
} from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import { ASSET_MAP } from '@/constants/assets';
import { PALETTE } from '@/constants/colors';

interface Props {
  assetId: string;
  category: string;
  mapPixelX: number;
  mapPixelY: number;
  width: number;
  height: number;
  color: string;
  font: SkFont | null;
}

export function DecorationMapItem({
  assetId,
  category,
  mapPixelX,
  mapPixelY,
  width,
  height,
  color,
  font,
}: Props) {
  const assetDef = ASSET_MAP[assetId];
  const imageSource = assetDef?.image ?? null;
  const skiaImage = useImage(imageSource as number | null);

  if (skiaImage) {
    return (
      <SkiaImage
        image={skiaImage}
        x={mapPixelX}
        y={mapPixelY}
        width={width}
        height={height}
        fit="contain"
      />
    );
  }

  const letter = (category.charAt(0) || '?').toUpperCase();

  return (
    <Group>
      <RoundedRect
        x={mapPixelX}
        y={mapPixelY}
        width={width}
        height={height}
        r={3}
        color={color + '60'}
      />
      <RoundedRect
        x={mapPixelX}
        y={mapPixelY}
        width={width}
        height={height}
        r={3}
        color={color}
        style="stroke"
        strokeWidth={1}
      />
      {font && (
        <SkiaText
          x={mapPixelX + width / 2 - 3}
          y={mapPixelY + height / 2 + 4}
          text={letter}
          font={font}
          color={PALETTE.white}
        />
      )}
    </Group>
  );
}
