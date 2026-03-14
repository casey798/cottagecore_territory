import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Image as SkiaImage,
  Rect,
  Circle,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { PALETTE, CLAN_COLORS } from '@/constants/colors';
import { MAP_WIDTH, MAP_HEIGHT, MAP_TILE_SIZE } from '@/constants/config';
import { gpsToPixel } from '@/utils/affineTransform';
import { useMapStore } from '@/store/useMapStore';
import { AffineMatrix, ClanId, Location, CapturedSpace } from '@/types';

// Minimap dimensions — 16:9 to match campus map ratio
const MINIMAP_W = 160;
const MINIMAP_H = 90;
const FRAME_PAD = 4;

// Scale factors from full map to minimap
const SCALE_X = MINIMAP_W / MAP_WIDTH;
const SCALE_Y = MINIMAP_H / MAP_HEIGHT;

interface ViewportRect {
  x: number; // map-pixel left edge
  y: number; // map-pixel top edge
  width: number; // map-pixel visible width
  height: number; // map-pixel visible height
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

  // Convert minimap tap to full-map coordinates
  const handleTap = useCallback(
    (x: number, y: number) => {
      // Offset by frame padding
      const minimapX = x - FRAME_PAD;
      const minimapY = y - FRAME_PAD;
      if (minimapX < 0 || minimapY < 0 || minimapX > MINIMAP_W || minimapY > MINIMAP_H) return;
      const mapX = minimapX / SCALE_X;
      const mapY = minimapY / SCALE_Y;
      onNavigate(mapX, mapY);
    },
    [onNavigate],
  );

  const tapGesture = Gesture.Tap().onEnd((e) => {
    'worklet';
    runOnJS(handleTap)(e.x, e.y);
  });

  // Pin positions on minimap
  const pinPositions = useMemo(() => {
    if (!transformMatrix) return [];
    return locations.map((loc) => {
      const pixel = gpsToPixel(loc.gpsLat, loc.gpsLng, transformMatrix);
      // Snap to tile grid then scale
      const snappedX = Math.round(pixel.x / MAP_TILE_SIZE) * MAP_TILE_SIZE;
      const snappedY = Math.round(pixel.y / MAP_TILE_SIZE) * MAP_TILE_SIZE;
      return { x: snappedX * SCALE_X, y: snappedY * SCALE_Y };
    });
  }, [locations, transformMatrix]);

  // Player position on minimap
  const playerMini = useMemo(() => {
    if (playerX == null || playerY == null) return null;
    return { x: playerX * SCALE_X, y: playerY * SCALE_Y };
  }, [playerX, playerY]);

  // Viewport rectangle on minimap
  const vpRect = useMemo(() => ({
    x: viewport.x * SCALE_X,
    y: viewport.y * SCALE_Y,
    width: viewport.width * SCALE_X,
    height: viewport.height * SCALE_Y,
  }), [viewport]);

  const dotColor = (__DEV__ && isDebugMode) ? '#FFD700' : (clan ? CLAN_COLORS[clan] : '#FFFFFF');

  return (
    <GestureDetector gesture={tapGesture}>
      <View style={styles.frame}>
        <Canvas style={styles.canvas}>
          {/* Map thumbnail */}
          {mapImage && (
            <SkiaImage
              image={mapImage}
              x={0}
              y={0}
              width={MINIMAP_W}
              height={MINIMAP_H}
              fit="fill"
            />
          )}

          {/* Captured space overlays */}
          {capturedSpaces.map((space) => {
            const clanColor = CLAN_COLORS[space.clan];
            if (!clanColor) return null;
            // Use spaceId hash to place overlay — placeholder until overlay geometry exists
            return null;
          })}

          {/* Location pin dots */}
          {pinPositions.map((pos, i) => (
            <Circle
              key={i}
              cx={pos.x}
              cy={pos.y}
              r={3}
              color={PALETTE.honeyGold}
              style="fill"
            />
          ))}

          {/* Player dot with glow */}
          {playerMini && (
            <>
              <Circle
                cx={playerMini.x}
                cy={playerMini.y}
                r={6}
                color={dotColor + '40'}
                style="fill"
              />
              <Circle
                cx={playerMini.x}
                cy={playerMini.y}
                r={4}
                color={dotColor}
                style="fill"
              />
              <Circle
                cx={playerMini.x}
                cy={playerMini.y}
                r={1.5}
                color="rgba(255,255,255,0.8)"
                style="fill"
              />
            </>
          )}

          {/* Viewport rectangle */}
          <Rect
            x={vpRect.x}
            y={vpRect.y}
            width={vpRect.width}
            height={vpRect.height}
            color="rgba(255, 255, 255, 0.5)"
            style="stroke"
            strokeWidth={1.5}
          />
          <Rect
            x={vpRect.x}
            y={vpRect.y}
            width={vpRect.width}
            height={vpRect.height}
            color="rgba(255, 255, 255, 0.08)"
            style="fill"
          />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    top: 68,
    left: 8,
    width: MINIMAP_W + FRAME_PAD * 2,
    height: MINIMAP_H + FRAME_PAD * 2,
    backgroundColor: PALETTE.warmBrown,
    borderRadius: 6,
    padding: FRAME_PAD,
    zIndex: 15,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    borderWidth: 1.5,
    borderColor: PALETTE.darkBrown,
  },
  canvas: {
    width: MINIMAP_W,
    height: MINIMAP_H,
    borderRadius: 3,
  },
});
