import React, { useMemo } from 'react';
import {
  Path as SkiaPath,
  LinearGradient,
  vec,
  Skia,
} from '@shopify/react-native-skia';
import { CLAN_COLORS } from '@/constants/colors';
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

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getBounds(points: Array<{ x: number; y: number }>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function SpacePolygon({ space }: { space: CapturedSpace }) {
  const hex = CLAN_COLORS[space.clan as ClanId] ?? '#FFFFFF';

  const polygonPath = useMemo(
    () => (space.polygonPoints ? buildPolygonPath(space.polygonPoints) : null),
    [space.polygonPoints],
  );

  const bounds = useMemo(
    () => (space.polygonPoints ? getBounds(space.polygonPoints) : null),
    [space.polygonPoints],
  );

  if (!polygonPath || !bounds) return null;

  return (
    <>
      {/* Inner glow — gradient fill from clan color to transparent */}
      <SkiaPath
        path={polygonPath}
        style="fill"
      >
        <LinearGradient
          start={vec(bounds.minX, bounds.minY)}
          end={vec(bounds.maxX, bounds.maxY)}
          colors={[hexToRgba(hex, 0.10), hexToRgba(hex, 0.04)]}
        />
      </SkiaPath>

      {/* Border — stroke outline */}
      <SkiaPath
        path={polygonPath}
        style="stroke"
        strokeWidth={2.5}
        color={hexToRgba(hex, 0.50)}
      />
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
        />
      ))}
    </>
  );
}
