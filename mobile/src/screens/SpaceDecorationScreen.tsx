import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  LayoutChangeEvent,
  ActivityIndicator,
} from 'react-native';
import { Canvas, Rect as SkiaRect, RoundedRect } from '@shopify/react-native-skia';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { PALETTE, CLAN_COLORS, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { MainModalParamList } from '@/navigation/MainStack';
import { PlayerAsset, AssetRarity, ClanId } from '@/types';
import * as playerApi from '@/api/player';
import * as spacesApi from '@/api/spaces';
import { useAssetStore } from '@/store/useAssetStore';

type Route = RouteProp<MainModalParamList, 'SpaceDecoration'>;

const TILE_PX = 16;

const RARITY_COLORS: Record<AssetRarity, string> = {
  common: PALETTE.stoneGrey,
  uncommon: PALETTE.softGreen,
  rare: PALETTE.honeyGold,
  legendary: PALETTE.mutedRose,
};

const CATEGORY_LETTERS: Record<string, string> = {
  banner: 'B',
  statue: 'S',
  furniture: 'F',
  mural: 'M',
  pet: 'P',
  special: 'X',
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function SpaceDecorationScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { spaceId, spaceName, clan, gridCells, userAssetId } = route.params;

  const clanColor = CLAN_COLORS[clan as ClanId] ?? PALETTE.honeyGold;

  // Decoration state
  const [placedAssets, setPlacedAssets] = useState<Record<string, PlayerAsset>>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Inventory
  const [allAssets, setAllAssets] = useState<PlayerAsset[]>([]);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // Loading states
  const [decorationLoading, setDecorationLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Track asset IDs that were placed when we loaded (for sync on save)
  const initialPlacedAssetIds = useRef<Set<string>>(new Set());

  // Loading skeleton pulse animation
  const pulseVal = useSharedValue(0.15);
  useEffect(() => {
    pulseVal.value = withRepeat(
      withTiming(0.35, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulseVal]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseVal.value,
  }));

  // Fetch player assets first, then load existing decoration
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Step 1: fetch player assets
      let assets: PlayerAsset[] = [];
      try {
        const assetsResult = await playerApi.getAssets();
        if (assetsResult.success && assetsResult.data) {
          assets = assetsResult.data.assets;
        }
      } catch {
        // Continue with empty assets
      }
      if (cancelled) return;
      setAllAssets(assets);
      setAssetsLoaded(true);

      // Step 2: fetch existing decoration
      try {
        const decoResult = await spacesApi.getDecoration(spaceId);
        if (
          decoResult.success &&
          decoResult.data?.layout?.placedAssets?.length
        ) {
          // Build asset lookup by assetId
          const assetById = new Map<string, PlayerAsset>();
          for (const a of assets) {
            assetById.set(a.assetId, a);
          }

          const restored: Record<string, PlayerAsset> = {};
          const initialIds = new Set<string>();
          for (const pa of decoResult.data.layout.placedAssets) {
            const playerAsset = assetById.get(pa.assetId);
            if (playerAsset) {
              const key = `${pa.x},${pa.y}`;
              restored[key] = playerAsset;
              initialIds.add(playerAsset.userAssetId);
            }
          }
          if (!cancelled) {
            setPlacedAssets(restored);
            initialPlacedAssetIds.current = initialIds;
          }
        }
      } catch {
        // 404 or error — start fresh, which is the default empty state
      }
      if (!cancelled) {
        setDecorationLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [spaceId]);

  // Pre-select asset when navigated from inventory with userAssetId
  useEffect(() => {
    if (userAssetId && allAssets.length > 0) {
      setSelectedAssetId(userAssetId);
    }
  }, [userAssetId, allAssets]);

  // Show toast briefly
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), type === 'success' ? 2000 : 4000);
  }, []);

  // Save handler
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Map placed assets to API shape
      const apiAssets = Object.entries(placedAssets).map(([key, asset]) => {
        const [xStr, yStr] = key.split(',');
        return {
          assetId: asset.assetId,
          x: parseInt(xStr, 10),
          y: parseInt(yStr, 10),
          rotation: 0,
        };
      });

      const result = await spacesApi.saveDecoration(spaceId, apiAssets);

      if (result.success) {
        // Sync asset store: compute new unplaced count
        const currentPlacedIds = new Set<string>();
        for (const asset of Object.values(placedAssets)) {
          currentPlacedIds.add(asset.userAssetId);
        }

        // Update allAssets placed status for accurate count
        const now = Date.now();
        const updatedAssets = allAssets.map((a) => {
          if (currentPlacedIds.has(a.userAssetId)) {
            return { ...a, placed: true };
          }
          // If it was initially placed but now removed, mark unplaced
          if (initialPlacedAssetIds.current.has(a.userAssetId) && !currentPlacedIds.has(a.userAssetId)) {
            return { ...a, placed: false };
          }
          return a;
        });

        const activeUnplaced = updatedAssets.filter((a) => {
          if (a.expiresAt && new Date(a.expiresAt).getTime() <= now) return false;
          return !a.placed;
        });
        useAssetStore.getState().setUnplacedCount(activeUnplaced.length);

        showToast('success', 'Saved!');
        setTimeout(() => navigation.goBack(), 600);
      } else {
        showToast('error', 'Save failed, try again');
      }
    } catch {
      showToast('error', 'Save failed, try again');
    } finally {
      setSaving(false);
    }
  }, [placedAssets, spaceId, allAssets, navigation, showToast]);

  // Unplaced assets: not expired, not placed on the server, and not placed locally on this grid
  const placedAssetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const asset of Object.values(placedAssets)) {
      ids.add(asset.userAssetId);
    }
    return ids;
  }, [placedAssets]);

  const unplacedAssets = useMemo(() => {
    const now = Date.now();
    return allAssets.filter((a) => {
      if (a.expiresAt && new Date(a.expiresAt).getTime() <= now) return false;
      if (a.placed && !initialPlacedAssetIds.current.has(a.userAssetId)) return false;
      if (placedAssetIds.has(a.userAssetId)) return false;
      return true;
    });
  }, [allAssets, placedAssetIds]);

  // Grid bounds
  const gridBounds = useMemo(() => {
    if (!gridCells || gridCells.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, cols: 1, rows: 1 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of gridCells) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
    return { minX, minY, maxX, maxY, cols: maxX - minX + 1, rows: maxY - minY + 1 };
  }, [gridCells]);

  // Grid cell set for fast lookup
  const cellSet = useMemo(() => {
    const s = new Set<string>();
    for (const c of gridCells) {
      s.add(`${c.x},${c.y}`);
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

  // Handle grid cell tap
  const handleCanvasTap = useCallback((screenX: number, screenY: number) => {
    if (gridScale <= 0 || decorationLoading) return;
    const localX = (screenX - offsetX) / gridScale;
    const localY = (screenY - offsetY) / gridScale;
    const cellX = Math.floor(localX / TILE_PX) + gridBounds.minX;
    const cellY = Math.floor(localY / TILE_PX) + gridBounds.minY;
    const key = `${cellX},${cellY}`;

    if (!cellSet.has(key)) return;

    if (placedAssets[key]) {
      setPlacedAssets((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else if (selectedAssetId) {
      const asset = allAssets.find((a) => a.userAssetId === selectedAssetId);
      if (!asset) return;

      setPlacedAssets((prev) => {
        const next: Record<string, PlayerAsset> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.userAssetId !== selectedAssetId) {
            next[k] = v;
          }
        }
        next[key] = asset;
        return next;
      });
      setSelectedAssetId(null);
    }
  }, [gridScale, offsetX, offsetY, gridBounds, cellSet, placedAssets, selectedAssetId, allAssets, decorationLoading]);

  // Handle tray item tap
  const handleTrayTap = useCallback((asset: PlayerAsset) => {
    setSelectedAssetId((prev) =>
      prev === asset.userAssetId ? null : asset.userAssetId,
    );
  }, []);

  // Prepare cell render data
  const cellRenderData = useMemo(() => {
    return gridCells.map((c) => {
      const key = `${c.x},${c.y}`;
      const asset = placedAssets[key];
      const rx = (c.x - gridBounds.minX) * TILE_PX * gridScale + offsetX;
      const ry = (c.y - gridBounds.minY) * TILE_PX * gridScale + offsetY;
      const size = TILE_PX * gridScale;
      return { key, x: c.x, y: c.y, rx, ry, size, asset };
    });
  }, [gridCells, placedAssets, gridBounds, gridScale, offsetX, offsetY]);

  // Render tray item
  const renderTrayItem = useCallback(({ item }: { item: PlayerAsset }) => {
    const isSelected = selectedAssetId === item.userAssetId;
    const rarityColor = RARITY_COLORS[item.rarity] ?? PALETTE.stoneGrey;
    return (
      <Pressable
        onPress={() => handleTrayTap(item)}
        style={[
          styles.trayItem,
          { borderColor: isSelected ? clanColor : PALETTE.warmBrown + '30' },
          isSelected && styles.trayItemSelected,
        ]}
      >
        <View style={[styles.trayItemIcon, { backgroundColor: rarityColor + '40' }]}>
          <Text style={[styles.trayItemLetter, { color: rarityColor }]}>
            {CATEGORY_LETTERS[item.category] ?? '?'}
          </Text>
        </View>
        <Text style={styles.trayItemName} numberOfLines={1}>{item.name}</Text>
      </Pressable>
    );
  }, [selectedAssetId, clanColor, handleTrayTap]);

  const trayKeyExtractor = useCallback((item: PlayerAsset) => item.userAssetId, []);

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: clanColor + '40' }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={[styles.spaceName, { color: clanColor }]}>{spaceName}</Text>
          <Text style={styles.topBarSubtitle}>Decorate</Text>
        </View>
        <Pressable
          onPress={handleSave}
          disabled={saving || decorationLoading}
          style={[
            styles.saveBtn,
            { backgroundColor: clanColor },
            (saving || decorationLoading) && styles.saveBtnDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={PALETTE.cream} />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
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

      {/* Grid zone */}
      <View style={styles.gridZone} onLayout={handleGridLayout}>
        {/* Loading skeleton overlay */}
        {decorationLoading && gridZoneWidth > 0 && gridZoneHeight > 0 && (
          <Animated.View
            style={[
              styles.loadingSkeleton,
              { backgroundColor: clanColor },
              pulseStyle,
            ]}
            pointerEvents="none"
          />
        )}

        {gridZoneWidth > 0 && gridZoneHeight > 0 && !decorationLoading && (
          <Pressable
            style={{ width: gridZoneWidth, height: gridZoneHeight }}
            onPress={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              handleCanvasTap(locationX, locationY);
            }}
          >
            <Canvas style={{ width: gridZoneWidth, height: gridZoneHeight }}>
              {cellRenderData.map((cell) => {
                if (cell.asset) {
                  const rarityColor = RARITY_COLORS[cell.asset.rarity] ?? PALETTE.stoneGrey;
                  const inset = 2 * gridScale;
                  return (
                    <React.Fragment key={cell.key}>
                      <SkiaRect
                        x={cell.rx}
                        y={cell.ry}
                        width={cell.size}
                        height={cell.size}
                        color={hexToRgba(clanColor, 0.15)}
                      />
                      <SkiaRect
                        x={cell.rx}
                        y={cell.ry}
                        width={cell.size}
                        height={cell.size}
                        color={hexToRgba(clanColor, 0.4)}
                        style="stroke"
                        strokeWidth={1}
                      />
                      <RoundedRect
                        x={cell.rx + inset}
                        y={cell.ry + inset}
                        width={cell.size - inset * 2}
                        height={cell.size - inset * 2}
                        r={2 * gridScale}
                        color={hexToRgba(rarityColor, 0.7)}
                      />
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={cell.key}>
                    <SkiaRect
                      x={cell.rx}
                      y={cell.ry}
                      width={cell.size}
                      height={cell.size}
                      color={hexToRgba(clanColor, 0.15)}
                    />
                    <SkiaRect
                      x={cell.rx}
                      y={cell.ry}
                      width={cell.size}
                      height={cell.size}
                      color={hexToRgba(clanColor, 0.4)}
                      style="stroke"
                      strokeWidth={1}
                    />
                  </React.Fragment>
                );
              })}
            </Canvas>
            {/* Overlay category letters for placed assets */}
            {cellRenderData
              .filter((c) => c.asset)
              .map((cell) => (
                <View
                  key={`lbl-${cell.key}`}
                  style={[
                    styles.cellLabel,
                    {
                      left: cell.rx,
                      top: cell.ry,
                      width: cell.size,
                      height: cell.size,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Text
                    style={[
                      styles.cellLabelText,
                      { fontSize: Math.max(8, cell.size * 0.45) },
                    ]}
                  >
                    {CATEGORY_LETTERS[cell.asset!.category] ?? '?'}
                  </Text>
                </View>
              ))}
          </Pressable>
        )}
        {gridCells.length === 0 && (
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyGridText}>No grid cells defined</Text>
          </View>
        )}
      </View>

      {/* Placed count */}
      <View style={styles.placedCountBar}>
        <Text style={styles.placedCountText}>
          {Object.keys(placedAssets).length} / {gridCells.length} cells filled
        </Text>
        {selectedAssetId && (
          <Text style={[styles.selectHint, { color: clanColor }]}>
            Tap a cell to place
          </Text>
        )}
      </View>

      {/* Inventory tray */}
      <View style={styles.trayContainer}>
        <Text style={styles.trayTitle}>Your Assets</Text>
        {!assetsLoaded ? (
          <Text style={styles.trayLoading}>Loading assets...</Text>
        ) : unplacedAssets.length === 0 ? (
          <Text style={styles.trayEmpty}>No unplaced assets available</Text>
        ) : (
          <FlatList
            data={unplacedAssets}
            horizontal
            keyExtractor={trayKeyExtractor}
            renderItem={renderTrayItem}
            contentContainerStyle={styles.trayList}
            showsHorizontalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    backgroundColor: PALETTE.cream,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: PALETTE.darkBrown,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  spaceName: {
    fontSize: 24,
    fontFamily: FONTS.headerBold,
  },
  topBarSubtitle: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
    marginTop: -2,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
  },
  // Toast
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
  // Grid zone
  gridZone: {
    flex: 6,
    backgroundColor: PALETTE.darkBrown + '08',
  },
  loadingSkeleton: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
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
    fontFamily: FONTS.bodyBold,
    color: PALETTE.cream,
  },
  // Placed count bar
  placedCountBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: PALETTE.warmBrown + '20',
    backgroundColor: PALETTE.cream,
  },
  placedCountText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
  },
  selectHint: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
  },
  // Inventory tray
  trayContainer: {
    flex: 3,
    borderTopWidth: 1,
    borderTopColor: PALETTE.warmBrown + '30',
    backgroundColor: PALETTE.cream,
    paddingTop: 8,
  },
  trayTitle: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  trayLoading: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    paddingHorizontal: 16,
  },
  trayEmpty: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    paddingHorizontal: 16,
  },
  trayList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  trayItem: {
    width: 72,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 10,
    padding: 4,
    backgroundColor: PALETTE.parchmentBg,
  },
  trayItemSelected: {
    borderWidth: 2.5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  trayItemIcon: {
    width: 52,
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trayItemLetter: {
    fontSize: 22,
    fontFamily: FONTS.headerBold,
  },
  trayItemName: {
    fontSize: 9,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginTop: 2,
    textAlign: 'center',
    width: 60,
  },
});
