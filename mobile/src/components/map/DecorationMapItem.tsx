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
import { DECORATION_PACKS, getAssetImage } from '@/data/decorationPacks';
import { PALETTE } from '@/constants/colors';

// Build a static lookup: assetId → require() image source from decoration packs
const DECO_PACK_IMAGE_MAP: Record<string, ReturnType<typeof require>> = {};
for (const pack of DECORATION_PACKS) {
  for (const asset of pack.assets) {
    const img = getAssetImage(asset.imageKey);
    if (img) DECO_PACK_IMAGE_MAP[asset.assetId] = img;
  }
}

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
  // Try curated asset map first, then decoration packs
  const assetDef = ASSET_MAP[assetId];
  const imageSource = assetDef?.image ?? DECO_PACK_IMAGE_MAP[assetId] ?? null;
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
