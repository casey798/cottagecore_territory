import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, LayoutChangeEvent } from 'react-native';
import FastImage from 'react-native-fast-image';
import {
  Canvas,
  Circle,
  Group,
  Path as SkiaPath,
} from '@shopify/react-native-skia';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { CLAN_COLORS } from '@/constants/colors';
import { useMapStore } from '@/store/useMapStore';
import { useDebugStore } from '@/store/useDebugStore';
import { ClanId, Location, CapturedSpace } from '@/types';
import { isWithinMapBounds, getEdgeIndicator } from '@/utils/mapBounds';
import { pixelToGps } from '@/utils/affineTransform';
import { MapPinsLayer } from './MapPinsLayer';
import { MapOverlay } from './MapOverlay';

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 4;
const INITIAL_ZOOM = 1.5;

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  playerX?: number | null;
  playerY?: number | null;
  clan?: ClanId | null;
  locations?: Location[];
  onPinPress?: (location: Location) => void;
  inRangeIds?: Set<string>;
  xpExhaustedIds?: Set<string>;
  onViewportChange?: (viewport: ViewportRect) => void;
  registerNavigate?: (fn: (mapX: number, mapY: number) => void) => void;
  capturedSpaces?: CapturedSpace[];
  followPlayer?: boolean;
  onFollowChange?: (following: boolean) => void;
  selectedSpaceId?: string | null;
  onSpaceTap?: (space: CapturedSpace | null, screenX: number, screenY: number) => void;
}

function pointInPolygon(px: number, py: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function MapCanvas({ playerX, playerY, clan, locations, onPinPress, inRangeIds, xpExhaustedIds, onViewportChange, registerNavigate, capturedSpaces, followPlayer, onFollowChange, selectedSpaceId, onSpaceTap }: Props) {
  const mapConfig = useMapStore((s) => s.mapConfig);
  const isDebugMode = useDebugStore((s) => s.isDebugMode);
  const tapToSetMode = useDebugStore((s) => s.tapToSetMode);

  // Brief toast after tap-to-set
  const [tapToast, setTapToast] = useState(false);

  // Map image loading state + fade-in
  const [mapImageLoaded, setMapImageLoaded] = useState(false);
  const fadeOpacity = useSharedValue(0);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  const handleMapImageLoad = useCallback(() => {
    setMapImageLoaded(true);
    fadeOpacity.value = withTiming(1, { duration: 300 });
  }, [fadeOpacity]);

  // View dimensions
  const viewW = useSharedValue(0);
  const viewH = useSharedValue(0);

  // Map dimensions as shared values for worklet access
  const mapW = useSharedValue(mapConfig?.mapWidth ?? 0);
  const mapH = useSharedValue(mapConfig?.mapHeight ?? 0);

  // Keep map dimensions in sync
  useEffect(() => {
    if (mapConfig) {
      mapW.value = mapConfig.mapWidth;
      mapH.value = mapConfig.mapHeight;
    }
  }, [mapConfig, mapW, mapH]);

  // Transform state
  const scale = useSharedValue(INITIAL_ZOOM);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Saved state for gesture continuity
  const savedScale = useSharedValue(INITIAL_ZOOM);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Track whether we've done initial centering
  const hasCentered = useSharedValue(false);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    viewW.value = width;
    viewH.value = height;
  }, [viewW, viewH]);

  // Center map on a point at a given zoom, clamped to bounds
  const centerOn = useCallback((
    focusX: number, focusY: number, z: number,
    vw: number, vh: number, mw: number, mh: number,
  ) => {
    let tx = vw / 2 - focusX * z;
    let ty = vh / 2 - focusY * z;

    // Apply same clamp logic as gestures
    const scaledW = mw * z;
    const scaledH = mh * z;
    if (scaledW <= vw) {
      tx = (vw - scaledW) / 2;
    } else {
      tx = Math.min(0, Math.max(vw - scaledW, tx));
    }
    if (scaledH <= vh) {
      ty = (vh - scaledH) / 2;
    } else {
      ty = Math.min(0, Math.max(vh - scaledH, ty));
    }

    translateX.value = tx;
    translateY.value = ty;
    savedTranslateX.value = tx;
    savedTranslateY.value = ty;
    scale.value = z;
    savedScale.value = z;
    hasCentered.value = true;
  }, [translateX, translateY, savedTranslateX, savedTranslateY, scale, savedScale, hasCentered]);

  // Report current viewport to parent (for minimap)
  const reportViewport = useCallback(() => {
    if (!onViewportChange || viewW.value === 0 || viewH.value === 0) return;
    const s = scale.value;
    onViewportChange({
      x: -translateX.value / s,
      y: -translateY.value / s,
      width: viewW.value / s,
      height: viewH.value / s,
    });
  }, [onViewportChange, scale, translateX, translateY, viewW, viewH]);

  // Navigate to a map-pixel point (called from minimap tap)
  const navigateToPoint = useCallback((mapX: number, mapY: number) => {
    if (!mapConfig) return;
    centerOn(mapX, mapY, scale.value,
      viewW.value, viewH.value, mapConfig.mapWidth, mapConfig.mapHeight);
    // Report after centering
    setTimeout(reportViewport, 0);
  }, [mapConfig, scale, viewW, viewH, centerOn, reportViewport]);

  // Register the navigate function with the parent
  useEffect(() => {
    registerNavigate?.(navigateToPoint);
  }, [registerNavigate, navigateToPoint]);

  // Center on player or map center when image loads
  useEffect(() => {
    if (!mapConfig || hasCentered.value) return;
    if (viewW.value === 0 || viewH.value === 0) return;

    const focusX = playerX ?? mapConfig.mapWidth / 2;
    const focusY = playerY ?? mapConfig.mapHeight / 2;
    centerOn(focusX, focusY, INITIAL_ZOOM,
      viewW.value, viewH.value, mapConfig.mapWidth, mapConfig.mapHeight);
    setTimeout(reportViewport, 0);
  }, [
    mapConfig, playerX, playerY,
    viewW, viewH, centerOn, reportViewport,
  ]);

  // Also trigger centering after layout
  const handleLayoutAndCenter = useCallback((e: LayoutChangeEvent) => {
    onLayout(e);
    if (!mapConfig || hasCentered.value) return;

    const { width, height } = e.nativeEvent.layout;
    const focusX = playerX ?? mapConfig.mapWidth / 2;
    const focusY = playerY ?? mapConfig.mapHeight / 2;
    centerOn(focusX, focusY, INITIAL_ZOOM,
      width, height, mapConfig.mapWidth, mapConfig.mapHeight);
    setTimeout(reportViewport, 0);
  }, [onLayout, mapConfig, playerX, playerY, centerOn, hasCentered, reportViewport]);

  // Auto-follow player when followPlayer is true
  useEffect(() => {
    if (!followPlayer || playerX == null || playerY == null || !mapConfig) return;
    if (viewW.value === 0 || viewH.value === 0) return;

    const z = scale.value;
    let tx = viewW.value / 2 - playerX * z;
    let ty = viewH.value / 2 - playerY * z;

    const scaledW = mapConfig.mapWidth * z;
    const scaledH = mapConfig.mapHeight * z;
    if (scaledW <= viewW.value) {
      tx = (viewW.value - scaledW) / 2;
    } else {
      tx = Math.min(0, Math.max(viewW.value - scaledW, tx));
    }
    if (scaledH <= viewH.value) {
      ty = (viewH.value - scaledH) / 2;
    } else {
      ty = Math.min(0, Math.max(viewH.value - scaledH, ty));
    }

    translateX.value = withTiming(tx, { duration: 300 });
    translateY.value = withTiming(ty, { duration: 300 });
    savedTranslateX.value = tx;
    savedTranslateY.value = ty;
    setTimeout(reportViewport, 350);
  }, [followPlayer, playerX, playerY, mapConfig, viewW, viewH, scale, translateX, translateY, savedTranslateX, savedTranslateY, reportViewport]);

  // Saved focal point for pinch gesture (track two-finger drag during pinch)
  const savedFocalX = useSharedValue(0);
  const savedFocalY = useSharedValue(0);

  // Clamp translation so map never shows empty space outside edges.
  // If scaled map is smaller than viewport, center it.
  function clampTranslate(
    tx: number, ty: number, s: number,
    vw: number, vh: number, mw: number, mh: number,
  ) {
    'worklet';
    const scaledW = mw * s;
    const scaledH = mh * s;

    let cx: number;
    let cy: number;

    if (scaledW <= vw) {
      cx = (vw - scaledW) / 2;
    } else {
      cx = Math.min(0, Math.max(vw - scaledW, tx));
    }

    if (scaledH <= vh) {
      cy = (vh - scaledH) / 2;
    } else {
      cy = Math.min(0, Math.max(vh - scaledH, ty));
    }

    return { x: cx, y: cy };
  }

  // --- Pinch gesture: zoom toward focal point + two-finger drag ---
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      'worklet';
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      savedFocalX.value = e.focalX;
      savedFocalY.value = e.focalY;
    })
    .onUpdate((e) => {
      'worklet';
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, savedScale.value * e.scale));
      const scaleChange = newScale / savedScale.value;

      // Two-finger drag delta (focal point movement since gesture start)
      const focalDeltaX = e.focalX - savedFocalX.value;
      const focalDeltaY = e.focalY - savedFocalY.value;

      // Zoom around the initial focal point, then add two-finger drag
      const newTx = savedFocalX.value * (1 - scaleChange)
                   + savedTranslateX.value * scaleChange
                   + focalDeltaX;
      const newTy = savedFocalY.value * (1 - scaleChange)
                   + savedTranslateY.value * scaleChange
                   + focalDeltaY;

      scale.value = newScale;
      const clamped = clampTranslate(
        newTx, newTy, newScale,
        viewW.value, viewH.value, mapW.value, mapH.value,
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      runOnJS(reportViewport)();
    });

  // Callback for disabling follow mode from worklet
  const disableFollow = useCallback(() => {
    onFollowChange?.(false);
  }, [onFollowChange]);

  // --- Pan gesture: single-finger drag only ---
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      runOnJS(disableFollow)();
    })
    .onUpdate((e) => {
      'worklet';
      const newTx = savedTranslateX.value + e.translationX;
      const newTy = savedTranslateY.value + e.translationY;

      const clamped = clampTranslate(
        newTx, newTy, scale.value,
        viewW.value, viewH.value, mapW.value, mapH.value,
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      runOnJS(reportViewport)();
    });

  // --- Double-tap: toggle between INITIAL_ZOOM and 3.5x ---
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      'worklet';
      const isZoomedIn = scale.value > INITIAL_ZOOM + 0.3;
      const targetScale = isZoomedIn ? INITIAL_ZOOM : MAX_ZOOM;
      const scaleChange = targetScale / scale.value;

      // Zoom toward tap point
      const newTx = e.x * (1 - scaleChange) + translateX.value * scaleChange;
      const newTy = e.y * (1 - scaleChange) + translateY.value * scaleChange;

      const clamped = clampTranslate(
        newTx, newTy, targetScale,
        viewW.value, viewH.value, mapW.value, mapH.value,
      );

      scale.value = withTiming(targetScale, { duration: 250 });
      translateX.value = withTiming(clamped.x, { duration: 250 });
      translateY.value = withTiming(clamped.y, { duration: 250 });
      savedScale.value = targetScale;
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
      runOnJS(reportViewport)();
    });

  // --- Debug: tap-to-set location (single tap, only in tapToSetMode) ---
  const handleTapToSet = useCallback((screenX: number, screenY: number) => {
    if (!mapConfig?.transformMatrix) return;
    const mapPixelX = (screenX - translateX.value) / scale.value;
    const mapPixelY = (screenY - translateY.value) / scale.value;
    const { lat, lng } = pixelToGps(mapPixelX, mapPixelY, mapConfig.transformMatrix);
    useDebugStore.getState().setDebugLocation(lat, lng);
    setTapToast(true);
    setTimeout(() => setTapToast(false), 1500);
  }, [mapConfig, translateX, translateY, scale]);

  const debugTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .enabled(__DEV__ && tapToSetMode)
    .onEnd((e) => {
      'worklet';
      runOnJS(handleTapToSet)(e.x, e.y);
    });

  // --- Space tap: detect taps on captured space polygons ---
  const handleSpaceTap = useCallback((screenX: number, screenY: number) => {
    if (!onSpaceTap) return;
    const mapPixelX = (screenX - translateX.value) / scale.value;
    const mapPixelY = (screenY - translateY.value) / scale.value;

    if (capturedSpaces) {
      for (const space of capturedSpaces) {
        if (!space.polygonPoints || space.polygonPoints.length < 3) continue;
        if (pointInPolygon(mapPixelX, mapPixelY, space.polygonPoints)) {
          onSpaceTap(space, screenX, screenY);
          return;
        }
      }
    }
    onSpaceTap(null, screenX, screenY);
  }, [capturedSpaces, onSpaceTap, translateX, translateY, scale]);

  const spaceTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((e) => {
      'worklet';
      runOnJS(handleSpaceTap)(e.x, e.y);
    });

  // Pan + Pinch simultaneous; debug tap, double-tap, or space tap
  const composedGesture = Gesture.Race(
    debugTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
    Gesture.Exclusive(doubleTapGesture, spaceTapGesture),
  );

  // Animated style for the canvas wrapper — applies transform
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Out-of-bounds detection (hooks must be above early returns)
  const mapWidth = mapConfig?.mapWidth ?? 0;
  const mapHeight = mapConfig?.mapHeight ?? 0;

  const inBounds = playerX != null && playerY != null
    ? isWithinMapBounds({ x: playerX, y: playerY }, mapWidth, mapHeight)
    : true; // no position = don't show OOB

  const edgeIndicator = useMemo(() => {
    if (inBounds || playerX == null || playerY == null || !mapConfig) return null;
    return getEdgeIndicator(
      { x: playerX, y: playerY },
      mapConfig.mapWidth,
      mapConfig.mapHeight,
    );
  }, [inBounds, playerX, playerY, mapConfig]);

  // Build chevron path pointing right (0°), rotated by angleDeg
  const chevronPath = useMemo(() => {
    if (!edgeIndicator) return null;
    const { edgeX, edgeY, angleDeg } = edgeIndicator;
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const pts = [
      { x: 10, y: 0 },   // tip
      { x: -6, y: -8 },  // top-left
      { x: -2, y: 0 },   // inner notch
      { x: -6, y: 8 },   // bottom-left
    ];

    const transformed = pts.map((p) => ({
      x: edgeX + p.x * cos - p.y * sin,
      y: edgeY + p.x * sin + p.y * cos,
    }));

    return `M ${transformed[0].x} ${transformed[0].y} L ${transformed[1].x} ${transformed[1].y} L ${transformed[2].x} ${transformed[2].y} L ${transformed[3].x} ${transformed[3].y} Z`;
  }, [edgeIndicator]);

  // Pulse animation for out-of-bounds indicator
  const pulseProgress = useSharedValue(0);

  useEffect(() => {
    if (!inBounds && edgeIndicator) {
      pulseProgress.value = 0;
      pulseProgress.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulseProgress.value = 0;
    }
  }, [inBounds, edgeIndicator, pulseProgress]);

  // Animated style for OOB text label
  const oobLabelStyle = useAnimatedStyle(() => {
    if (!edgeIndicator) return { opacity: 0 };
    const screenX = edgeIndicator.edgeX * scale.value + translateX.value;
    const screenY = edgeIndicator.edgeY * scale.value + translateY.value;
    const opacity = 0.7 + 0.3 * Math.sin(pulseProgress.value * Math.PI);
    return {
      position: 'absolute' as const,
      left: screenX - 50,
      top: screenY + 20 * scale.value,
      opacity,
    };
  });

  // Early returns AFTER all hooks
  if (!mapConfig) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="large" color={PALETTE.softGreen} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  const DEBUG_COLOR = '#FFD700';
  const dotColor = (__DEV__ && isDebugMode) ? DEBUG_COLOR : (clan ? CLAN_COLORS[clan] : null);

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container} onLayout={handleLayoutAndCenter}>
        {isDebugMode && (
          <View style={styles.debugBadge}>
            <Text style={styles.debugBadgeText}>DEBUG GPS</Text>
          </View>
        )}
        {/* Loading indicator while map image downloads */}
        {!mapImageLoaded && (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={PALETTE.honeyGold} />
            <Text style={styles.mapLoadingText}>Preparing the grove...</Text>
          </View>
        )}
        <Animated.View
            style={[
              {
                width: mapConfig.mapWidth,
                height: mapConfig.mapHeight,
                transformOrigin: 'left top',
              },
              animatedStyle,
              fadeStyle,
            ]}
          >
            <FastImage
              source={{
                uri: mapConfig.mapImageUrl,
                priority: FastImage.priority.high,
                cache: FastImage.cacheControl.immutable,
              }}
              style={{ width: mapConfig.mapWidth, height: mapConfig.mapHeight }}
              resizeMode={FastImage.resizeMode.contain}
              onLoad={handleMapImageLoad}
            />
            <Canvas style={styles.overlayCanvas}>
              {capturedSpaces && capturedSpaces.length > 0 && (
                <MapOverlay
                  capturedSpaces={capturedSpaces}
                  selectedSpaceId={selectedSpaceId}
                />
              )}
              {playerX != null && playerY != null && dotColor && inBounds && (
                <Group>
                  {/* Accuracy ring */}
                  <Circle
                    cx={playerX}
                    cy={playerY}
                    r={32}
                    color={dotColor + '30'}
                    style="fill"
                  />
                  <Circle
                    cx={playerX}
                    cy={playerY}
                    r={32}
                    color={dotColor + '60'}
                    style="stroke"
                    strokeWidth={2}
                  />
                  {/* Player dot */}
                  <Circle
                    cx={playerX}
                    cy={playerY}
                    r={14}
                    color={dotColor}
                    style="fill"
                  />
                  <Circle
                    cx={playerX}
                    cy={playerY}
                    r={14}
                    color="rgba(255, 255, 255, 0.6)"
                    style="stroke"
                    strokeWidth={2}
                  />
                  {/* Inner white dot */}
                  <Circle
                    cx={playerX}
                    cy={playerY}
                    r={4}
                    color="rgba(255, 255, 255, 0.8)"
                    style="fill"
                  />
                </Group>
              )}
              {/* Out-of-bounds edge indicator */}
              {edgeIndicator && dotColor && chevronPath && (
                <Group>
                  {/* Pulsing background circle */}
                  <Circle
                    cx={edgeIndicator.edgeX}
                    cy={edgeIndicator.edgeY}
                    r={14}
                    color={dotColor + '50'}
                    style="fill"
                  />
                  <Circle
                    cx={edgeIndicator.edgeX}
                    cy={edgeIndicator.edgeY}
                    r={18}
                    color={dotColor + '25'}
                    style="fill"
                  />
                  {/* Arrow chevron pointing toward player */}
                  <SkiaPath
                    path={chevronPath}
                    color="white"
                    style="fill"
                  />
                  <SkiaPath
                    path={chevronPath}
                    color={dotColor}
                    style="stroke"
                    strokeWidth={1.5}
                  />
                </Group>
              )}
            </Canvas>
            {locations && locations.length > 0 && mapConfig.transformMatrix && onPinPress && (
              <MapPinsLayer
                locations={locations}
                transformMatrix={mapConfig.transformMatrix}
                onPinPress={onPinPress}
                inRangeIds={inRangeIds}
                xpExhaustedIds={xpExhaustedIds}
              />
            )}
        </Animated.View>
        {/* Out-of-bounds text overlay (React Native layer, above Skia) */}
        {edgeIndicator && (
          <Animated.View style={[styles.oobLabel, oobLabelStyle]} pointerEvents="none">
            <Text style={styles.oobLabelText}>OUT OF BOUNDS</Text>
          </Animated.View>
        )}
        {/* Tap-to-set mode overlays */}
        {__DEV__ && tapToSetMode && (
          <>
            <View style={styles.tapModeBorder} pointerEvents="none" />
            <View style={styles.tapModeBanner} pointerEvents="none">
              <Text style={styles.tapModeBannerText}>TAP MAP TO SET LOCATION</Text>
            </View>
            <View style={styles.crosshair} pointerEvents="none">
              <Text style={styles.crosshairText}>+</Text>
            </View>
          </>
        )}
        {/* Toast after tap-to-set */}
        {tapToast && (
          <View style={styles.tapToast} pointerEvents="none">
            <Text style={styles.tapToastText}>Debug location set</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.deepGreen,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PALETTE.deepGreen,
  },
  loadingText: {
    color: PALETTE.cream,
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    marginTop: 12,
  },
  overlayCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  mapLoadingText: {
    color: PALETTE.cream,
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  debugBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 10,
  },
  debugBadgeText: {
    color: '#1E140F',
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
  },
  oobLabel: {
    width: 100,
    alignItems: 'center',
  },
  oobLabelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  tapModeBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 2,
  },
  tapModeBanner: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tapModeBannerText: {
    color: '#1E140F',
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.5,
  },
  crosshair: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairText: {
    color: 'rgba(255, 215, 0, 0.5)',
    fontSize: 48,
    fontWeight: '200',
  },
  tapToast: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tapToastText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
  },
});
