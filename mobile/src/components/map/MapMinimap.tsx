import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import {
  Canvas,
  Image as SkiaImage,
  Circle,
  Group,
  Skia,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { PALETTE, CLAN_COLORS } from '@/constants/colors';
import { MAP_WIDTH, MAP_HEIGHT, MAP_TILE_SIZE } from '@/constants/config';
import { gpsToPixel } from '@/utils/affineTransform';
import { useMapStore } from '@/store/useMapStore';
import { AffineMatrix, ClanId, Location, CapturedSpace } from '@/types';

const FRAME_MINIMAP = require('../../assets/ui/frames/frame_minimap.png');

const MINIMAP_SIZE = 150;
const FRAME_PAD = 4;
const OUTER_SIZE = MINIMAP_SIZE + FRAME_PAD * 2;
const HALF = MINIMAP_SIZE / 2;

// Fixed scale: how many minimap pixels per map pixel.
// Show roughly 1/3.5 of the map width in the minimap diameter.
const SCALE = MINIMAP_SIZE / (MAP_WIDTH / 3.5);

// Circular clip path for the Skia canvas content
const clipPath = Skia.Path.Make();
clipPath.addCircle(HALF, HALF, HALF);

interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  viewport: ViewportRect;
  playerX: number | null;
  playerY: number | null;
  clan: ClanId | null;
  locations: Location[];
  capturedSpaces: CapturedSpace[];
  transformMatrix: AffineMatrix | null;
  onNavigate: (mapX: number, mapY: number) => void;
  isDebugMode?: boolean;
}

export function MapMinimap({
  viewport,
  playerX,
  playerY,
  clan,
  locations,
  capturedSpaces,
  transformMatrix,
  onNavigate,
  isDebugMode,
}: Props) {
  const mapImage = useMapStore((s) => s.skiaMapImage);

  // The viewport center in map-pixel coords — this is what we center the minimap on
  const focusX = viewport.x + viewport.width / 2;
  const focusY = viewport.y + viewport.height / 2;

  // Convert a map-pixel coordinate to minimap-canvas coordinate.
  // The focus point maps to the canvas center (HALF, HALF).
  const toMinimapX = (mapX: number) => HALF + (mapX - focusX) * SCALE;
  const toMinimapY = (mapY: number) => HALF + (mapY - focusY) * SCALE;

  // Map image: rendered at scale, offset so focusX/Y lands at canvas center
  const mapRenderW = MAP_WIDTH * SCALE;
  const mapRenderH = MAP_HEIGHT * SCALE;
  const mapOffsetX = HALF - focusX * SCALE;
  const mapOffsetY = HALF - focusY * SCALE;

  const handleTap = useCallback(
    (x: number, y: number) => {
      const canvasX = x - FRAME_PAD;
      const canvasY = y - FRAME_PAD;
      if (canvasX < 0 || canvasY < 0 || canvasX > MINIMAP_SIZE || canvasY > MINIMAP_SIZE) return;
      // Reverse: canvas coord → map coord
      const mapX = focusX + (canvasX - HALF) / SCALE;
      const mapY = focusY + (canvasY - HALF) / SCALE;
      onNavigate(mapX, mapY);
    },
    [onNavigate, focusX, focusY],
  );

  const tapGesture = Gesture.Tap().onEnd((e) => {
    'worklet';
    runOnJS(handleTap)(e.x, e.y);
  });

  // Pin positions in minimap coords
  const pinPositions = useMemo(() => {
    if (!transformMatrix) return [];
    return locations.map((loc) => {
      const pixel = gpsToPixel(loc.gpsLat, loc.gpsLng, transformMatrix);
      const snappedX = Math.round(pixel.x / MAP_TILE_SIZE) * MAP_TILE_SIZE;
      const snappedY = Math.round(pixel.y / MAP_TILE_SIZE) * MAP_TILE_SIZE;
      const dotX = toMinimapX(snappedX);
      const dotY = toMinimapY(snappedY);
      const visible = dotX > -5 && dotX < MINIMAP_SIZE + 5 && dotY > -5 && dotY < MINIMAP_SIZE + 5;
      return { x: dotX, y: dotY, visible };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, transformMatrix, focusX, focusY]);

  // Player position in minimap coords
  const playerMini = useMemo(() => {
    if (playerX == null || playerY == null) return null;
    return { x: toMinimapX(playerX), y: toMinimapY(playerY) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerX, playerY, focusX, focusY]);

  // Viewport circle: its center is exactly HALF,HALF since we center on it
  const vpRadius = Math.min(viewport.width, viewport.height) / 2 * SCALE;

  const dotColor = (__DEV__ && isDebugMode) ? '#FFD700' : (clan ? CLAN_COLORS[clan] : '#FFFFFF');

  return (
    <GestureDetector gesture={tapGesture}>
      <View style={styles.container}>
        <Canvas style={styles.canvas}>
          <Group clip={clipPath} invertClip={false}>
            {mapImage && (
              <SkiaImage
                image={mapImage}
                x={mapOffsetX}
                y={mapOffsetY}
                width={mapRenderW}
                height={mapRenderH}
                fit="fill"
              />
            )}

            {pinPositions.map((pos, i) =>
              pos.visible ? (
                <Circle
                  key={i}
                  cx={pos.x}
                  cy={pos.y}
                  r={3}
                  color={PALETTE.honeyGold}
                  style="fill"
                />
              ) : null,
            )}

            {playerMini && (
              <>
                <Circle
                  cx={playerMini.x}
                  cy={playerMini.y}
                  r={5}
                  color={dotColor + '30'}
                  style="fill"
                />
                <Circle
                  cx={playerMini.x}
                  cy={playerMini.y}
                  r={3}
                  color={dotColor + 'AA'}
                  style="fill"
                />
              </>
            )}

            {/* Viewport circle — always centered since minimap is centered on viewport */}
            <Circle
              cx={HALF}
              cy={HALF}
              r={vpRadius}
              color="rgba(255, 255, 255, 0.45)"
              style="stroke"
              strokeWidth={1.5}
            />
            <Circle
              cx={HALF}
              cy={HALF}
              r={vpRadius}
              color="rgba(255, 255, 255, 0.06)"
              style="fill"
            />

            {/* Vignette gradient inside circular clip */}
            <Circle cx={75} cy={75} r={75}>
              <RadialGradient
                c={vec(75, 75)}
                r={75}
                colors={['transparent', 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.75)']}
                positions={[0, 0.55, 1]}
              />
            </Circle>
          </Group>
        </Canvas>

        <Image
          source={FRAME_MINIMAP}
          style={styles.frameImage}
          resizeMode="contain"
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 68,
    right: 8,
    width: OUTER_SIZE,
    height: OUTER_SIZE,
    zIndex: 15,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  canvas: {
    position: 'absolute',
    top: FRAME_PAD,
    left: FRAME_PAD,
    width: MINIMAP_SIZE,
    height: MINIMAP_SIZE,
  },
  frameImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: OUTER_SIZE,
    height: OUTER_SIZE,
  },
});
