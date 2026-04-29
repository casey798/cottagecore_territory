import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  StyleSheet,
  Pressable,
  ScrollView,
  LayoutChangeEvent,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import {
  Canvas,
  Rect as SkiaRect,
  RoundedRect,
  Image as SkiaImage,
  Path as SkiaPath,
  BlurMask,
  Skia,
  useCanvasRef,
  useImage,
  ImageFormat,
} from '@shopify/react-native-skia';
import type { SkImage } from '@shopify/react-native-skia';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { MainModalParamList } from '@/navigation/MainStack';
import { PlacedDecorationAsset } from '@/api/spaces';
import * as spacesApi from '@/api/spaces';
import { useMapStore } from '@/store/useMapStore';
import {
  DECORATION_PACKS,
  DecorationAsset,
  DecorationPackCategory,
  getAssetImage,
} from '@/data/decorationPacks';

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

type Route = RouteProp<MainModalParamList, 'SpaceDecoration'>;

const TILE_PX = 16;
const TOP_BAR_HEIGHT = 72;
const BOTTOM_TRAY_HEIGHT = 220;
const TRAY_ITEM_SIZE = 64;
const GHOST_SIZE = 80;
const ACCENT_COLOR = PALETTE.honeyGold;

// Multi-cell placement types
interface PlacedAnchor {
  instanceId: string; // unique per placement — allows multiple of the same asset
  asset: DecorationAsset;
  x: number;      // top-left grid col (anchor)
  y: number;      // top-left grid row (anchor)
  gridW: number;
  gridH: number;
}

let _instanceCounter = 0;
function nextInstanceId(): string {
  return `inst_${++_instanceCounter}_${Date.now()}`;
}

// "col,row" → instanceId of the anchor occupying that cell
type OccupancyMap = Record<string, string>;

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clanColorWithOpacity(hex: string, opacity: number): string {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${hex}${alpha}`;
}

const PACK_COLORS: Record<DecorationPackCategory, string> = {
  furniture: PALETTE.warmBrown,
  aesthetics: PALETTE.mutedRose,
  nature: PALETTE.softGreen,
};

// ── Skia asset image — renders a decoration image inside the Canvas ───
function SkiaAssetImage({
  source,
  x,
  y,
  width,
  height,
}: {
  source: number;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const img = useImage(source);
  if (!img) return null;
  return <SkiaImage image={img} x={x} y={y} width={width} height={height} fit="contain" />;
}

// ── Draggable tray item ───────────────────────────────────

function DraggableTrayItem({
  asset,
  isDimmed,
  ghostX,
  ghostY,
  ghostOpacity,
  isDraggingShared,
  onDragStart,
  onDrop,
  onDragEnd,
}: {
  asset: DecorationAsset;
  isDimmed: boolean;
  ghostX: SharedValue<number>;
  ghostY: SharedValue<number>;
  ghostOpacity: SharedValue<number>;
  isDraggingShared: SharedValue<boolean>;
  onDragStart: (asset: DecorationAsset) => void;
  onDrop: (x: number, y: number) => void;
  onDragEnd: () => void;
}) {
  const packColor = PACK_COLORS[asset.category] ?? PALETTE.stoneGrey;
  const gridLabel = `${asset.gridW}\u00D7${asset.gridH}`;
  const imageSource = getAssetImage(asset.imageKey);

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart((e) => {
      ghostX.value = e.absoluteX;
      ghostY.value = e.absoluteY;
      ghostOpacity.value = 1;
      isDraggingShared.value = true;
      runOnJS(onDragStart)(asset);
    })
    .onUpdate((e) => {
      ghostX.value = e.absoluteX;
      ghostY.value = e.absoluteY;
    })
    .onEnd((e) => {
      runOnJS(onDrop)(e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      ghostOpacity.value = 0;
      isDraggingShared.value = false;
      runOnJS(onDragEnd)();
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.trayItem,
          { borderColor: PALETTE.warmBrownMild },
          isDimmed && styles.trayItemDimmed,
        ]}
      >
        <View style={[styles.trayItemIcon, { backgroundColor: hexToRgba(packColor, 0.25) }]}>
          {imageSource ? (
            <Image source={imageSource} style={styles.assetThumb} resizeMode="contain" />
          ) : (
            <View style={styles.assetThumbPlaceholder} />
          )}
          <View style={styles.gridSizeBadge}>
            <Text style={styles.gridSizeText}>{gridLabel}</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Ghost overlay ──────────────────────────────────────────

function GhostOverlay({
  ghostX,
  ghostY,
  ghostOpacity,
  imageSource,
}: {
  ghostX: SharedValue<number>;
  ghostY: SharedValue<number>;
  ghostOpacity: SharedValue<number>;
  imageSource: ReturnType<typeof require> | null;
}) {
  const animStyle = useAnimatedStyle(() => ({
    left: ghostX.value - GHOST_SIZE / 2,
    top: ghostY.value - GHOST_SIZE / 2,
    opacity: ghostOpacity.value,
  }));

  if (!imageSource) return null;

  return (
    <Animated.View style={[styles.ghostContainer, animStyle]} pointerEvents="none">
      <Image source={imageSource} style={styles.ghostImage} resizeMode="contain" />
    </Animated.View>
  );
}

// ── Main component ─────────────────────────────────────────

export default function SpaceDecorationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainModalParamList>>();
  const route = useRoute<Route>();
  const { spaceId, spaceName, gridCells, gridColumns, gridRows, polygonPoints } = route.params;

  // Campus map from store
  const skiaMapImage = useMapStore((s) => s.skiaMapImage);
  const mapConfig = useMapStore((s) => s.mapConfig);

  // Skia canvas ref for screenshot capture
  const canvasRef = useCanvasRef();

  // Ref for measuring canvas area position on screen
  const canvasAreaRef = useRef<View>(null);

  // Decoration state — multi-cell placement
  const [placedAnchors, setPlacedAnchors] = useState<PlacedAnchor[]>([]);
  const [occupancyMap, setOccupancyMap] = useState<OccupancyMap>({});

  // Load existing decoration on mount (for re-decoration)
  useEffect(() => {
    (async () => {
      try {
        const result = await spacesApi.getMyDecorations();
        if (!result.success || !result.data) return;
        const existing = result.data.decorations.find((d) => d.spaceId === spaceId);
        if (!existing || !existing.placedAssets || existing.placedAssets.length === 0) return;

        const allAssets = DECORATION_PACKS.flatMap((p) => p.assets);
        const anchors: PlacedAnchor[] = [];
        const occ: OccupancyMap = {};
        for (const pa of existing.placedAssets) {
          const asset = allAssets.find((a) => a.assetId === pa.assetId);
          if (!asset) continue;
          const gw = pa.gridW ?? asset.gridW ?? 1;
          const gh = pa.gridH ?? asset.gridH ?? 1;
          const id = nextInstanceId();
          anchors.push({ instanceId: id, asset, x: pa.x, y: pa.y, gridW: gw, gridH: gh });
          for (let dy = 0; dy < gh; dy++) {
            for (let dx = 0; dx < gw; dx++) {
              occ[`${pa.x + dx},${pa.y + dy}`] = id;
            }
          }
        }
        setPlacedAnchors(anchors);
        setOccupancyMap(occ);
      } catch {
        // Non-fatal — start with empty grid
      }
    })();
  }, [spaceId]);

  // Drag state
  const [draggingAsset, setDraggingAsset] = useState<DecorationAsset | null>(null);
  const draggingAssetRef = useRef<DecorationAsset | null>(null);

  // Shared values for ghost (UI thread)
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostOpacity = useSharedValue(0);
  const isDraggingShared = useSharedValue(false);

  // Pack tab state
  const [activePack, setActivePack] = useState<DecorationPackCategory>('furniture');
  const currentPackAssets = useMemo(
    () => DECORATION_PACKS.find((p) => p.category === activePack)?.assets ?? [],
    [activePack],
  );

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Show toast briefly
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), type === 'success' ? 2000 : 4000);
  }, []);

  // Grid bounds from gridCells
  const gridBounds = useMemo(() => {
    if (!gridCells || gridCells.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, cols: 1, rows: 1 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of gridCells) {
      if (c.col < minX) minX = c.col;
      if (c.row < minY) minY = c.row;
      if (c.col > maxX) maxX = c.col;
      if (c.row > maxY) maxY = c.row;
    }
    return { minX, minY, maxX, maxY, cols: maxX - minX + 1, rows: maxY - minY + 1 };
  }, [gridCells]);

  // Grid cell set for fast lookup
  const cellSet = useMemo(() => {
    const s = new Set<string>();
    for (const c of gridCells) {
      s.add(`${c.col},${c.row}`);
    }
    return s;
  }, [gridCells]);

  // Canvas sizing
  const [gridZoneWidth, setGridZoneWidth] = useState(0);
  const [gridZoneHeight, setGridZoneHeight] = useState(0);

  const handleGridLayout = useCallback((e: LayoutChangeEvent) => {
    setGridZoneWidth(e.nativeEvent.layout.width);
    setGridZoneHeight(e.nativeEvent.layout.height);
  }, []);

  // Scale factor: fit grid bounding box into available zone
  const { gridScale, offsetX, offsetY } = useMemo(() => {
    if (gridZoneWidth === 0 || gridZoneHeight === 0 || gridCells.length === 0) {
      return { gridScale: 1, offsetX: 0, offsetY: 0 };
    }
    const padding = 16;
    const availW = gridZoneWidth - padding * 2;
    const availH = gridZoneHeight - padding * 2;
    const gridW = gridBounds.cols * TILE_PX;
    const gridH = gridBounds.rows * TILE_PX;
    const s = Math.min(availW / gridW, availH / gridH);
    const ox = padding + (availW - gridW * s) / 2;
    const oy = padding + (availH - gridH * s) / 2;
    return { gridScale: s, offsetX: ox, offsetY: oy };
  }, [gridZoneWidth, gridZoneHeight, gridBounds, gridCells.length]);

  // Campus map aligned to grid cells
  const mapCrop = useMemo(() => {
    if (
      !polygonPoints || polygonPoints.length < 3 ||
      !mapConfig || gridZoneWidth === 0 || gridZoneHeight === 0 || gridCells.length === 0
    ) {
      return null;
    }
    let polyMinX = Infinity, polyMinY = Infinity, polyMaxX = -Infinity, polyMaxY = -Infinity;
    for (const p of polygonPoints) {
      if (p.x < polyMinX) polyMinX = p.x;
      if (p.y < polyMinY) polyMinY = p.y;
      if (p.x > polyMaxX) polyMaxX = p.x;
      if (p.y > polyMaxY) polyMaxY = p.y;
    }
    const polyW = polyMaxX - polyMinX;
    const polyH = polyMaxY - polyMinY;
    if (polyW <= 0 || polyH <= 0) return null;

    const cellMapW = polyW / gridBounds.cols;
    const cellMapH = polyH / gridBounds.rows;
    const scaleX = (TILE_PX * gridScale) / cellMapW;
    const scaleY = (TILE_PX * gridScale) / cellMapH;

    const imgX = -polyMinX * scaleX + offsetX;
    const imgY = -polyMinY * scaleY + offsetY;

    return {
      imgX,
      imgY,
      imgW: mapConfig.mapWidth * scaleX,
      imgH: mapConfig.mapHeight * scaleY,
      scaleX,
      scaleY,
    };
  }, [polygonPoints, mapConfig, gridZoneWidth, gridZoneHeight, gridCells.length, gridScale, gridBounds, offsetX, offsetY]);

  // Territory outline path
  const territoryPath = useMemo(() => {
    if (!polygonPoints || polygonPoints.length < 3 || !mapCrop) return null;
    const path = Skia.Path.Make();
    const cx0 = polygonPoints[0].x * mapCrop.scaleX + mapCrop.imgX;
    const cy0 = polygonPoints[0].y * mapCrop.scaleY + mapCrop.imgY;
    path.moveTo(cx0, cy0);
    for (let i = 1; i < polygonPoints.length; i++) {
      const cx = polygonPoints[i].x * mapCrop.scaleX + mapCrop.imgX;
      const cy = polygonPoints[i].y * mapCrop.scaleY + mapCrop.imgY;
      path.lineTo(cx, cy);
    }
    path.close();
    return path;
  }, [polygonPoints, mapCrop]);

  // Canvas bounds for tap/drop rejection
  const canvasMaxX = useMemo(
    () => gridBounds.cols * TILE_PX * gridScale + offsetX,
    [gridBounds.cols, gridScale, offsetX],
  );
  const canvasMaxY = useMemo(
    () => gridBounds.rows * TILE_PX * gridScale + offsetY,
    [gridBounds.rows, gridScale, offsetY],
  );

  // Place an asset at a grid cell — shared by handleDrop
  const placeAssetAtCell = useCallback((asset: DecorationAsset, cellCol: number, cellRow: number) => {
    const { gridW, gridH } = asset;

    // Bounds + collision check for all cells in the footprint
    for (let dy = 0; dy < gridH; dy++) {
      for (let dx = 0; dx < gridW; dx++) {
        const cx = cellCol + dx;
        const cy = cellRow + dy;
        const ck = `${cx},${cy}`;
        if (!cellSet.has(ck)) {
          showToast('error', 'Not enough space here');
          return;
        }
        if (occupancyMap[ck] !== undefined) {
          showToast('error', 'Not enough space here');
          return;
        }
      }
    }

    const id = nextInstanceId();
    const newAnchor: PlacedAnchor = { instanceId: id, asset, x: cellCol, y: cellRow, gridW, gridH };

    setPlacedAnchors((prev) => [...prev, newAnchor]);
    setOccupancyMap((prev) => {
      const next = { ...prev };
      for (let dy = 0; dy < gridH; dy++) {
        for (let dx = 0; dx < gridW; dx++) {
          next[`${cellCol + dx},${cellRow + dy}`] = id;
        }
      }
      return next;
    });
  }, [cellSet, occupancyMap, showToast]);

  // Drag callbacks
  const startDrag = useCallback((asset: DecorationAsset) => {
    draggingAssetRef.current = asset;
    setDraggingAsset(asset);
  }, []);

  const clearDrag = useCallback(() => {
    draggingAssetRef.current = null;
    setDraggingAsset(null);
  }, []);

  const handleDrop = useCallback((absoluteX: number, absoluteY: number) => {
    const asset = draggingAssetRef.current;
    if (!asset || !canvasAreaRef.current) return;

    canvasAreaRef.current.measureInWindow((pageX, pageY, width, height) => {
      const relX = absoluteX - pageX;
      const relY = absoluteY - pageY;

      // Dropped outside canvas area
      if (relX < 0 || relY < 0 || relX > width || relY > height) return;

      // Outside grid bounds within canvas
      if (gridScale <= 0) return;
      if (relX < offsetX || relY < offsetY || relX > canvasMaxX || relY > canvasMaxY) return;

      const localX = (relX - offsetX) / gridScale;
      const localY = (relY - offsetY) / gridScale;
      const cellCol = Math.floor(localX / TILE_PX) + gridBounds.minX;
      const cellRow = Math.floor(localY / TILE_PX) + gridBounds.minY;

      placeAssetAtCell(asset, cellCol, cellRow);
    });
  }, [gridScale, offsetX, offsetY, canvasMaxX, canvasMaxY, gridBounds, placeAssetAtCell]);

  // Handle grid cell tap — removal only
  const handleCanvasTap = useCallback((screenX: number, screenY: number) => {
    if (gridScale <= 0) return;
    if (screenX < offsetX || screenY < offsetY || screenX > canvasMaxX || screenY > canvasMaxY) return;

    const localX = (screenX - offsetX) / gridScale;
    const localY = (screenY - offsetY) / gridScale;
    const cellCol = Math.floor(localX / TILE_PX) + gridBounds.minX;
    const cellRow = Math.floor(localY / TILE_PX) + gridBounds.minY;
    const key = `${cellCol},${cellRow}`;

    if (!cellSet.has(key)) return;

    const occupyingId = occupancyMap[key];
    if (!occupyingId) return;

    // Remove the entire multi-cell asset by instanceId
    const anchor = placedAnchors.find((a) => a.instanceId === occupyingId);
    if (!anchor) return;

    setPlacedAnchors((prev) => prev.filter((a) => a.instanceId !== occupyingId));
    setOccupancyMap((prev) => {
      const next = { ...prev };
      for (let dy = 0; dy < anchor.gridH; dy++) {
        for (let dx = 0; dx < anchor.gridW; dx++) {
          delete next[`${anchor.x + dx},${anchor.y + dy}`];
        }
      }
      return next;
    });
  }, [gridScale, offsetX, offsetY, canvasMaxX, canvasMaxY, gridBounds, cellSet, occupancyMap, placedAnchors]);

  // Anchor lookup by assetId for rendering
  // Anchor lookup by instanceId for rendering
  const anchorByInstanceId = useMemo(() => {
    const map = new Map<string, PlacedAnchor>();
    for (const a of placedAnchors) {
      map.set(a.instanceId, a);
    }
    return map;
  }, [placedAnchors]);

  // Prepare cell render data — multi-cell aware
  const cellRenderData = useMemo(() => {
    return gridCells.map((c) => {
      const key = `${c.col},${c.row}`;
      const rx = (c.col - gridBounds.minX) * TILE_PX * gridScale + offsetX;
      const ry = (c.row - gridBounds.minY) * TILE_PX * gridScale + offsetY;
      const size = TILE_PX * gridScale;
      const occupyingId = occupancyMap[key];
      const anchor = occupyingId ? anchorByInstanceId.get(occupyingId) : undefined;
      const isAnchorCell = anchor ? (anchor.x === c.col && anchor.y === c.row) : false;
      return { key, col: c.col, row: c.row, rx, ry, size, occupyingId, anchor, isAnchorCell };
    });
  }, [gridCells, occupancyMap, anchorByInstanceId, gridBounds, gridScale, offsetX, offsetY]);

  // Memoized dynamic style for grid zone
  const gridZoneDynStyle = useMemo<ViewStyle>(
    () => ({ width: gridZoneWidth, height: gridZoneHeight, backgroundColor: '#1A120B' }),
    [gridZoneWidth, gridZoneHeight],
  );

  // Submit handler — capture screenshot then navigate to survey
  const handleSubmit = useCallback(async () => {
    if (placedAnchors.length === 0) {
      showToast('error', 'Place at least one item before submitting');
      return;
    }

    setSubmitting(true);

    try {
      const snapshot: SkImage | null = canvasRef.current?.makeImageSnapshot() ?? null;
      if (!snapshot) throw new Error('Failed to capture canvas snapshot');
      const base64 = snapshot.encodeToBase64(ImageFormat.PNG, 80);

      const builtAssets: PlacedDecorationAsset[] = placedAnchors.map((anchor) => ({
        assetId: anchor.asset.assetId,
        packCategory: anchor.asset.category,
        x: anchor.x,
        y: anchor.y,
        rotation: 0,
        gridW: anchor.gridW,
        gridH: anchor.gridH,
      }));

      setSubmitting(false);

      navigation.navigate('DecorationSurvey', {
        spaceId,
        spaceName,
        placedAssets: builtAssets,
        screenshotBase64: base64,
      });
    } catch (e) {
      console.error('[SpaceDecoration] screenshot capture failed:', e);
      setSubmitting(false);
      showToast('error', 'Failed to capture screenshot');
    }
  }, [placedAnchors, spaceId, spaceName, navigation, showToast]);

  // Occupied cell count
  const occupiedCellCount = Object.keys(occupancyMap).length;

  // Ghost image source (React state, for rendering the correct image)
  const ghostImageSource = draggingAsset ? getAssetImage(draggingAsset.imageKey) ?? null : null;

  return (
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={[styles.spaceName, { color: ACCENT_COLOR }]} numberOfLines={1} adjustsFontSizeToFit>
            {spaceName}
          </Text>
        </View>
        <Pressable
          onPress={handleSubmit}
          disabled={submitting || placedAnchors.length === 0}
          style={[
            styles.submitBtn,
            (submitting || placedAnchors.length === 0) && styles.submitBtnDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={PALETTE.cream} />
          ) : (
            <Text style={styles.submitBtnText}>Submit</Text>
          )}
        </Pressable>
      </View>

      {/* Toast */}
      {toast && (
        <View
          style={[
            styles.toast,
            toast.type === 'success' ? styles.toastSuccess : styles.toastError,
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* Grid zone — canvas area between top bar and bottom tray */}
      <View ref={canvasAreaRef} style={styles.canvasArea} onLayout={handleGridLayout}>
        {gridZoneWidth > 0 && gridZoneHeight > 0 && (
          <Pressable
            style={gridZoneDynStyle}
            onPress={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              handleCanvasTap(locationX, locationY);
            }}
          >
            <Canvas ref={canvasRef} style={gridZoneDynStyle}>
                {/* Campus map image underneath grid */}
                {skiaMapImage && mapCrop && (
                  <SkiaImage
                    image={skiaMapImage}
                    x={mapCrop.imgX}
                    y={mapCrop.imgY}
                    width={mapCrop.imgW}
                    height={mapCrop.imgH}
                    fit="fill"
                    opacity={0.7}
                  />
                )}

                {/* Territory outline glow + border */}
                {territoryPath && (
                  <>
                    <SkiaPath
                      path={territoryPath}
                      style="stroke"
                      strokeWidth={8}
                      strokeJoin="round"
                      strokeCap="round"
                      color={clanColorWithOpacity('#FF0000', 0.3)}
                    >
                      <BlurMask blur={10} style="solid" respectCTM={true} />
                    </SkiaPath>
                    <SkiaPath
                      path={territoryPath}
                      style="stroke"
                      strokeWidth={2}
                      strokeJoin="round"
                      strokeCap="round"
                      color={clanColorWithOpacity('#FF0000', 0.9)}
                    />
                  </>
                )}

                {cellRenderData.map((cell) => {
                  if (cell.isAnchorCell && cell.anchor) {
                    const anchor = cell.anchor;
                    const fullW = anchor.gridW * cell.size;
                    const fullH = anchor.gridH * cell.size;
                    return (
                      <React.Fragment key={cell.key}>
                        <SkiaRect
                          x={cell.rx}
                          y={cell.ry}
                          width={cell.size}
                          height={cell.size}
                          color={hexToRgba(ACCENT_COLOR, 0.4)}
                          style="stroke"
                          strokeWidth={1}
                        />
                        <RoundedRect
                          x={cell.rx}
                          y={cell.ry}
                          width={fullW}
                          height={fullH}
                          r={2 * gridScale}
                          color={ACCENT_COLOR}
                          style="stroke"
                          strokeWidth={1.5}
                        />
                      </React.Fragment>
                    );
                  }

                  // Occupied by a neighbor or empty — grid line only
                  return (
                    <React.Fragment key={cell.key}>
                      <SkiaRect
                        x={cell.rx}
                        y={cell.ry}
                        width={cell.size}
                        height={cell.size}
                        color={hexToRgba(ACCENT_COLOR, 0.4)}
                        style="stroke"
                        strokeWidth={1}
                      />
                    </React.Fragment>
                  );
                })}
                {/* Placed decoration assets — rendered inside Skia for snapshot capture */}
                {cellRenderData
                  .filter((c) => c.isAnchorCell && c.anchor)
                  .map((cell) => {
                    const anchor = cell.anchor!;
                    const fullW = anchor.gridW * cell.size;
                    const fullH = anchor.gridH * cell.size;
                    const imageSource = getAssetImage(anchor.asset.imageKey);
                    if (!imageSource) return null;
                    return (
                      <SkiaAssetImage
                        key={`skia-img-${cell.key}`}
                        source={imageSource as number}
                        x={cell.rx}
                        y={cell.ry}
                        width={fullW}
                        height={fullH}
                      />
                    );
                  })}
              </Canvas>
          </Pressable>
        )}
        {gridCells.length === 0 && (
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyGridText}>No grid cells defined</Text>
          </View>
        )}
      </View>

      {/* Bottom tray */}
      <View style={styles.bottomTray}>
        {/* Placed count + drag hint */}
        <View style={styles.placedCountBar}>
          <Text style={styles.placedCountText}>
            {occupiedCellCount} / {gridCells.length} cells filled
          </Text>
          {draggingAsset ? (
            <Text style={[styles.selectHint, { color: ACCENT_COLOR }]} numberOfLines={1}>
              {draggingAsset.name} — Drop on grid to place
            </Text>
          ) : (
            <Text style={styles.selectHint}>
              Long-press to drag
            </Text>
          )}
        </View>

        {/* Pack tabs */}
        <View style={styles.packTabRow}>
          {DECORATION_PACKS.map((pack) => {
            const isActive = activePack === pack.category;
            return (
              <Pressable
                key={pack.category}
                style={[
                  styles.packTab,
                  isActive && styles.packTabActive,
                ]}
                onPress={() => setActivePack(pack.category)}
              >
                <Text style={styles.packTabIcon}>{pack.icon}</Text>
                <Text
                  style={[
                    styles.packTabLabel,
                    isActive && styles.packTabLabelActive,
                  ]}
                >
                  {pack.displayName} ({pack.assets.length})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Inventory tray */}
        <View style={styles.trayContainer}>
          {currentPackAssets.length === 0 ? (
            <Text style={styles.trayEmpty}>No items in this pack yet</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayScrollContent}>
              <View style={styles.trayWrapContainer}>
                {currentPackAssets.map((asset) => (
                  <DraggableTrayItem
                    key={asset.assetId}
                    asset={asset}
                    isDimmed={draggingAsset?.assetId === asset.assetId}
                    ghostX={ghostX}
                    ghostY={ghostY}
                    ghostOpacity={ghostOpacity}
                    isDraggingShared={isDraggingShared}
                    onDragStart={startDrag}
                    onDrop={handleDrop}
                    onDragEnd={clearDrag}
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* Ghost overlay — rendered last so it's above everything */}
      <GhostOverlay
        ghostX={ghostX}
        ghostY={ghostY}
        ghostOpacity={ghostOpacity}
        imageSource={ghostImageSource}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_BAR_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: PALETTE.cream,
  },
  topBarCenter: {
    flex: 3,
    alignItems: 'center',
  },
  spaceName: {
    fontSize: 24,
    fontFamily: FONTS.heading,
    marginTop: 10,
  },
  submitBtn: {
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
  },
  toast: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    zIndex: 50,
    elevation: 10,
  },
  toastSuccess: {
    backgroundColor: PALETTE.softGreen,
  },
  toastError: {
    backgroundColor: PALETTE.errorRed,
  },
  toastText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
  },
  canvasArea: {
    flex: 1,
    marginTop: TOP_BAR_HEIGHT,
    marginBottom: BOTTOM_TRAY_HEIGHT,
  },
  emptyGrid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyGridText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
  },
  cellLabel: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellLabelText: {
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
    textAlign: 'center',
  },
  cellAssetImage: {
    width: '100%',
    height: '100%',
  },
  bottomTray: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_TRAY_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 4,
    zIndex: 10,
  },
  placedCountBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  placedCountText: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.parchment,
  },
  selectHint: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
  },
  packTabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 6,
  },
  packTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    gap: 4,
  },
  packTabActive: {
    backgroundColor: 'rgba(212, 168, 67, 0.3)',
    borderWidth: 1,
    borderColor: ACCENT_COLOR,
  },
  packTabIcon: {
    fontSize: 14,
  },
  packTabLabel: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.parchment,
  },
  packTabLabelActive: {
    color: ACCENT_COLOR,
  },
  trayContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  trayEmpty: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    paddingHorizontal: 16,
  },
  trayScrollContent: {
    paddingHorizontal: 12,
  },
  trayWrapContainer: {
    flexDirection: 'column',
    flexWrap: 'wrap',
    height: TRAY_ITEM_SIZE * 2 + 8 * 3,
    gap: 8,
  },
  trayItem: {
    width: TRAY_ITEM_SIZE,
    height: TRAY_ITEM_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 10,
    backgroundColor: PALETTE.parchmentBg,
  },
  trayItemDimmed: {
    opacity: 0.5,
  },
  trayItemIcon: {
    width: TRAY_ITEM_SIZE - 8,
    height: TRAY_ITEM_SIZE - 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetThumb: {
    width: TRAY_ITEM_SIZE - 16,
    height: TRAY_ITEM_SIZE - 16,
  },
  assetThumbPlaceholder: {
    width: TRAY_ITEM_SIZE - 16,
    height: TRAY_ITEM_SIZE - 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 6,
  },
  gridSizeBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  gridSizeText: {
    fontSize: 9,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.parchment,
  },
  ghostContainer: {
    position: 'absolute',
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    zIndex: 100,
    elevation: 100,
  },
  ghostImage: {
    width: GHOST_SIZE,
    height: GHOST_SIZE,
  },
});
