import React, { useEffect, useMemo } from 'react';
import {
  Path as SkiaPath,
  Rect as SkiaRect,
  Circle as SkiaCircle,
  Skia,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { CLAN_COLORS } from '@/constants/colors';
import { CapturedSpace, ClanId } from '@/types';

const TILE_SIZE = 16;
const INSET = 1;
const CORNER_R = 1.5;

interface Props {
  capturedSpaces: CapturedSpace[];
  scale: number;
  translateX: number;
  translateY: number;
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

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function buildBordersPath(cells: Array<{ x: number; y: number }>) {
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

function uniqueCorners(cells: Array<{ x: number; y: number }>) {
  const set = new Set<string>();
  const corners: Array<{ cx: number; cy: number }> = [];
  for (const cell of cells) {
    const px = cell.x * TILE_SIZE;
    const py = cell.y * TILE_SIZE;
    const pts = [
      [px, py],
      [px + TILE_SIZE, py],
      [px, py + TILE_SIZE],
      [px + TILE_SIZE, py + TILE_SIZE],
    ];
    for (const [cx, cy] of pts) {
      const key = `${cx},${cy}`;
      if (!set.has(key)) {
        set.add(key);
        corners.push({ cx, cy });
      }
    }
  }
  return corners;
}

function GlowingCells({
  cells,
  hex,
  isTarget,
  clanPulse,
  targetPulse,
}: {
  cells: Array<{ x: number; y: number }>;
  hex: string;
  isTarget: boolean;
  clanPulse: SharedValue<number>;
  targetPulse: SharedValue<number>;
}) {
  const [r, g, b] = hexToRgb(hex);
  const fillColor = rgba(r, g, b, isTarget ? 0.08 : 0.1);
  const glowColor = rgba(r, g, b, 0.15);
  const cornerColor = rgba(r, g, b, 0.95);

  const borderPath = useMemo(() => buildBordersPath(cells), [cells]);
  const corners = useMemo(() => uniqueCorners(cells), [cells]);

  const pulse = isTarget ? targetPulse : clanPulse;

  const borderColor = useDerivedValue(() => {
    'worklet';
    const a = 0.6 + 0.4 * pulse.value;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  });

  return (
    <>
      {/* 1. Inner fill — 10% (target 8%) opacity */}
      {cells.map((cell) => (
        <SkiaRect
          key={`f-${cell.x}-${cell.y}`}
          x={cell.x * TILE_SIZE}
          y={cell.y * TILE_SIZE}
          width={TILE_SIZE}
          height={TILE_SIZE}
          color={fillColor}
        />
      ))}

      {/* 3. Inner glow — inset 2px, 15% opacity */}
      {cells.map((cell) => (
        <SkiaRect
          key={`g-${cell.x}-${cell.y}`}
          x={cell.x * TILE_SIZE + INSET}
          y={cell.y * TILE_SIZE + INSET}
          width={TILE_SIZE - INSET * 2}
          height={TILE_SIZE - INSET * 2}
          color={glowColor}
        />
      ))}

      {/* 2. Grid border — pulsing 60%-100% opacity */}
      <SkiaPath
        path={borderPath}
        color={borderColor}
        style="stroke"
        strokeWidth={1}
      />

      {/* 4. Corner dots — 95% opacity, deduplicated */}
      {corners.map((c) => (
        <SkiaCircle
          key={`c-${c.cx}-${c.cy}`}
          cx={c.cx}
          cy={c.cy}
          r={CORNER_R}
          color={cornerColor}
        />
      ))}
    </>
  );
}

export function MapOverlay({ capturedSpaces }: Props) {
  const clanPulse = useSharedValue(0);
  const targetPulse = useSharedValue(0);

  useEffect(() => {
    clanPulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    targetPulse.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [clanPulse, targetPulse]);

  const renderableSpaces = capturedSpaces.filter(
    (s) =>
      (s.gridCells && s.gridCells.length > 0) ||
      (s.polygonPoints && s.polygonPoints.length >= 3),
  );

  if (renderableSpaces.length === 0) return null;

  return (
    <>
      {renderableSpaces.map((space) => {
        const clanColor = CLAN_COLORS[space.clan as ClanId];
        const isTarget = !clanColor;
        const hex = clanColor ?? '#FFFFFF';

        if (space.gridCells && space.gridCells.length > 0) {
          return (
            <GlowingCells
              key={space.spaceId}
              cells={space.gridCells}
              hex={hex}
              isTarget={isTarget}
              clanPulse={clanPulse}
              targetPulse={targetPulse}
            />
          );
        }

        // Fallback to polygon path (no grid cells)
        const [r, g, b] = hexToRgb(hex);
        const path = buildPolygonPath(space.polygonPoints!);
        return (
          <SkiaPath
            key={space.spaceId}
            path={path}
            color={rgba(r, g, b, isTarget ? 0.08 : 0.1)}
            style="fill"
          />
        );
      })}
    </>
  );
}
