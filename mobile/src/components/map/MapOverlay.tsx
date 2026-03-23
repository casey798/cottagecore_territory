import React, { useMemo } from 'react';
import {
  Path as SkiaPath,
  BlurMask,
  Skia,
} from '@shopify/react-native-skia';
import { CLAN_COLORS, PALETTE } from '@/constants/colors';
import { CapturedSpace, ClanId } from '@/types';

interface Props {
  capturedSpaces: CapturedSpace[];
  selectedSpaceId?: string | null;
}

function buildPolygonPath(points: Array<{ x: number; y: number }>) {
  const path = Skia.Path.Make();
  if (points.length < 3) return path;

  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i].x, points[i].y);
  }
  path.close();
  return path;
}

function clanColorWithOpacity(clan: ClanId, opacity: number): string {
  const hex = CLAN_COLORS[clan] ?? PALETTE.white;
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${hex}${alpha}`;
}

function SpacePolygon({ space, isSelected }: { space: CapturedSpace; isSelected: boolean }) {
  const polygonPath = useMemo(
    () => (space.polygonPoints ? buildPolygonPath(space.polygonPoints) : null),
    [space.polygonPoints],
  );

  if (!polygonPath) return null;

  const clan = space.clan as ClanId;

  return (
    <>
      {/* Layer 1 — Glow halo: wide blurred stroke */}
      <SkiaPath
        path={polygonPath}
        style="stroke"
        strokeWidth={15}
        strokeJoin="round"
        strokeCap="round"
        color={clanColorWithOpacity(clan, 0.55)}
      >
        <BlurMask blur={15} style="normal" respectCTM={true} />
      </SkiaPath>

      {/* Layer 2 — Crisp border line */}
      <SkiaPath
        path={polygonPath}
        style="stroke"
        strokeWidth={4}
        strokeJoin="round"
        strokeCap="round"
        color={clanColorWithOpacity(clan, 0.9)}
      />

      {/* Layer 3 — Selection highlight */}
      {isSelected && (
        <SkiaPath
          path={polygonPath}
          style="stroke"
          strokeWidth={3.5}
          strokeJoin="round"
          strokeCap="round"
          color={PALETTE.parchment}
          opacity={0.85}
        />
      )}
    </>
  );
}

export function MapOverlay({ capturedSpaces, selectedSpaceId }: Props) {
  const renderableSpaces = capturedSpaces.filter(
    (s) => s.polygonPoints && s.polygonPoints.length >= 3,
  );

  if (renderableSpaces.length === 0) return null;

  return (
    <>
      {renderableSpaces.map((space) => (
        <SpacePolygon
          key={space.spaceId}
          space={space}
          isSelected={space.spaceId === selectedSpaceId}
        />
      ))}
    </>
  );
}
