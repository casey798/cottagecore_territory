import React, { useMemo } from 'react';
import {
  Path as SkiaPath,
  Skia,
} from '@shopify/react-native-skia';
import { CLAN_COLORS } from '@/constants/colors';
import { CapturedSpace, ClanId } from '@/types';

const TILE_SIZE = 16;

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

function buildGridBordersPath(cells: Array<{ x: number; y: number }>) {
  const path = Skia.Path.Make();
  for (const cell of cells) {
    const px = cell.x * TILE_SIZE;
    const py = cell.y * TILE_SIZE;
    path.moveTo(px, py);
    path.lineTo(px + TILE_SIZE, py);
    path.lineTo(px + TILE_SIZE, py + TILE_SIZE);
    path.lineTo(px, py + TILE_SIZE);
    path.close();
  }
  return path;
}

function SpacePolygon({
  space,
  isSelected,
}: {
  space: CapturedSpace;
  isSelected: boolean;
}) {
  const hex = CLAN_COLORS[space.clan as ClanId] ?? '#FFFFFF';

  const polygonPath = useMemo(
    () => (space.polygonPoints ? buildPolygonPath(space.polygonPoints) : null),
    [space.polygonPoints],
  );

  const gridPath = useMemo(
    () =>
      isSelected && space.gridCells ? buildGridBordersPath(space.gridCells) : null,
    [isSelected, space.gridCells],
  );

  if (!polygonPath) return null;

  return (
    <>
      {/* Clan-colored polygon fill at 20% opacity */}
      <SkiaPath
        path={polygonPath}
        color={hexToRgba(hex, 0.2)}
        style="fill"
      />
      {/* Selected state: grid cell outlines */}
      {isSelected && gridPath && (
        <SkiaPath
          path={gridPath}
          color={hexToRgba(hex, 0.6)}
          style="stroke"
          strokeWidth={1}
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
