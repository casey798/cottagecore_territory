import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, LayoutChangeEvent } from 'react-native';
import FastImage from 'react-native-fast-image';
import {
  Canvas,
  Circle,
  Group,
  Path as SkiaPath,
  Image as SkiaImage,
  useImage,
  useFont,
  BlurMask,
} from '@shopify/react-native-skia';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  interpolate,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { PALETTE, CLAN_COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useMapStore } from '@/store/useMapStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useDebugStore } from '@/store/useDebugStore';
import { ClanId, Location, CapturedSpace } from '@/types';
import { SpaceAssignmentItem, MyDecorationItem } from '@/api/spaces';
import { isWithinMapBounds, getEdgeIndicator } from '@/utils/mapBounds';
import { pixelToGps } from '@/utils/affineTransform';
import { GPS_RING_COLORS } from '@/constants/playerAssets';
import { getPresetById } from '@/utils/characterPresets';
import { gpsToPixel } from '@/utils/affineTransform';
import { MAP_TILE_SIZE } from '@/constants/config';
import { MapPin } from './MapPin';
import { MapPinsLayer } from './MapPinsLayer';
import { MapOverlay } from './MapOverlay';
import { DecorationMapItem } from './DecorationMapItem';

const MAX_ZOOM = 4;

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
  lockedUntilMap?: Record<string, string>;
  onViewportChange?: (viewport: ViewportRect) => void;
  registerNavigate?: (fn: (mapX: number, mapY: number) => void) => void;
  capturedSpaces?: CapturedSpace[];
  followPlayer?: boolean;
  onFollowChange?: (following: boolean) => void;
  selectedSpaceId?: string | null;
  onSpaceTap?: (space: CapturedSpace | null, screenX: number, screenY: number) => void;
  onMapTap?: (pixelX: number, pixelY: number) => void;
  pinColor?: string;
  pinRingColor?: string;
  pinProximities?: Map<string, { distance: number; geofenceRadius: number }>;
  interactive?: boolean;
  tutorialGlowPin?: { px: number; py: number };
  tutorialPinPress?: () => void;
  highlightClanId?: ClanId | null;
  assignedSpaces?: SpaceAssignmentItem[];
  onAssignedSpaceTap?: (space: SpaceAssignmentItem) => void;
  spacePinProximities?: Map<string, { distance: number; geofenceRadius: number }>;
  inRangeSpaceIds?: Set<string>;
  showOverlay?: boolean;
  myDecorations?: MyDecorationItem[];
}

function getPolygonCentroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
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

export function MapCanvas({ playerX, playerY, clan, locations, onPinPress, inRangeIds, xpExhaustedIds, lockedUntilMap, onViewportChange, registerNavigate, capturedSpaces, followPlayer, onFollowChange, selectedSpaceId, onSpaceTap, onMapTap, pinColor, pinRingColor, pinProximities, interactive = true, tutorialGlowPin, tutorialPinPress, highlightClanId, assignedSpaces, onAssignedSpaceTap, spacePinProximities, inRangeSpaceIds, showOverlay = true, myDecorations }: Props) {
  const mapConfig = useMapStore((s) => s.mapConfig);
  const playerClan = useAuthStore((s) => s.clan);
  const isDebugMode = useDebugStore((s) => s.isDebugMode);
  const tapToSetMode = useDebugStore((s) => s.tapToSetMode);
  const INITIAL_ZOOM = 1.5;
  const MIN_ZOOM = 1;

  // Font for decoration category letters on the Skia canvas
  const decoFont = useFont(require('../../assets/fonts/PixelifySans-VariableFont_wght.ttf'), 10);

  // Load player character icon as a Skia image (icon require() values are numeric module IDs at runtime)
  const selectedPresetId = useAuthStore((s) => s.selectedPresetId);
  const characterPreset = selectedPresetId !== null ? getPresetById(selectedPresetId) : undefined;
  const playerCharacterImage = useImage(
    characterPreset ? (characterPreset.icon as unknown as number) : null,
  );
  const gpsRingColors = GPS_RING_COLORS[clan ?? 'ember'];

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
    .enabled(interactive)
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
    .enabled(interactive)
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

  // --- Space tap: detect taps on assigned spaces first, then captured space polygons ---
  const handleSpaceTap = useCallback((screenX: number, screenY: number) => {
    if (!onSpaceTap && !onAssignedSpaceTap) return;
    const mapPixelX = (screenX - translateX.value) / scale.value;
    const mapPixelY = (screenY - translateY.value) / scale.value;

    // Check assigned spaces first (higher priority)
    if (assignedSpaces && onAssignedSpaceTap) {
      for (const space of assignedSpaces) {
        if (!space.polygonPoints || space.polygonPoints.length < 3) continue;
        if (pointInPolygon(mapPixelX, mapPixelY, space.polygonPoints)) {
          onAssignedSpaceTap(space);
          return;
        }
      }
    }

    if (onSpaceTap) {
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
    }
  }, [capturedSpaces, onSpaceTap, assignedSpaces, onAssignedSpaceTap, translateX, translateY, scale]);

  const spaceTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((e) => {
      'worklet';
      runOnJS(handleSpaceTap)(e.x, e.y);
    });

  // --- Map tap: generic tap callback for external consumers ---
  const handleMapTapInternal = useCallback((screenX: number, screenY: number) => {
    if (!onMapTap) return;
    const mapPixelX = (screenX - translateX.value) / scale.value;
    const mapPixelY = (screenY - translateY.value) / scale.value;
    onMapTap(mapPixelX, mapPixelY);
  }, [onMapTap, translateX, translateY, scale]);

  const mapTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .enabled(!!onMapTap && !(__DEV__ && tapToSetMode))
    .onEnd((e) => {
      'worklet';
      runOnJS(handleMapTapInternal)(e.x, e.y);
    });

  // Pan + Pinch simultaneous; debug tap, double-tap, space tap, or map tap
  // mapTapGesture is last in the Exclusive race so pin/space taps take priority
  const singleTapGesture = (onSpaceTap || onAssignedSpaceTap)
    ? Gesture.Exclusive(spaceTapGesture, mapTapGesture)
    : mapTapGesture;

  const composedGesture = Gesture.Race(
    debugTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
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

  // Breathing pulse for in-range pin glows
  const pulseValue = useSharedValue(0);

  // Sonar ripples for player marker
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const ripple2TimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    pulseValue.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    ripple1.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    ripple2TimerRef.current = setTimeout(() => {
      ripple2.value = withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
    }, 900);
    return () => {
      if (ripple2TimerRef.current) clearTimeout(ripple2TimerRef.current);
    };
  }, [pulseValue, ripple1, ripple2]);

  // Derived animated values for in-range pulse ring
  const animatedPulseRadius = useDerivedValue(() =>
    interpolate(pulseValue.value, [0, 1], [0, 10]),
  );
  const animatedPulseOpacity = useDerivedValue(() =>
    interpolate(pulseValue.value, [0, 1], [0.0, 0.25]),
  );

  // Derived animated values for player sonar ripples
  const ripple1Radius = useDerivedValue(() => interpolate(ripple1.value, [0, 1], [12, 36]));
  const ripple1Opacity = useDerivedValue(() => interpolate(ripple1.value, [0, 0.3, 1], [0.7, 0.5, 0.0]));
  const ripple2Radius = useDerivedValue(() => interpolate(ripple2.value, [0, 1], [12, 36]));
  const ripple2Opacity = useDerivedValue(() => interpolate(ripple2.value, [0, 0.3, 1], [0.7, 0.5, 0.0]));

  // FIX 4 — Highlight rings for selectSpace mode (pulsing border on own-clan spaces)
  const highlightActive = useSharedValue(false);
  useEffect(() => {
    highlightActive.value = !!highlightClanId;
  }, [highlightClanId, highlightActive]);
  const animatedHighlightOpacity = useDerivedValue(() =>
    highlightActive.value ? interpolate(pulseValue.value, [0, 1], [0.35, 0.9]) : 0,
  );
  const highlightClanPaths = useMemo(() => {
    if (!highlightClanId || !capturedSpaces) return [];
    return capturedSpaces
      .filter((s) => s.clan === highlightClanId && s.polygonPoints && s.polygonPoints.length >= 3)
      .map((s) => {
        const pts = s.polygonPoints!;
        const d = `M ${pts[0].x} ${pts[0].y} ` +
          pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') + ' Z';
        return { key: s.spaceId, d, color: CLAN_COLORS[highlightClanId] };
      });
  }, [highlightClanId, capturedSpaces]);

  // Assigned space polygon paths
  const assignedSpacePaths = useMemo(() => {
    if (!assignedSpaces || assignedSpaces.length === 0) return [];
    return assignedSpaces
      .filter((s) => s.polygonPoints && s.polygonPoints.length >= 3)
      .map((s) => {
        const pts = s.polygonPoints;
        const d = `M ${pts[0].x} ${pts[0].y} ` +
          pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') + ' Z';
        return { key: s.spaceId, d, completed: s.completed };
      });
  }, [assignedSpaces]);

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

  // Compute decoration render data from myDecorations (user's submitted decorations)
  const decorationRenderData = useMemo(() => {
    if (!myDecorations || myDecorations.length === 0) return [];
    const clanColor = CLAN_COLORS[clan ?? 'ember'] ?? PALETTE.honeyGold;
    const items: Array<{
      key: string;
      pixelX: number;
      pixelY: number;
      width: number;
      height: number;
      assetId: string;
      category: string;
      clanColor: string;
    }> = [];

    for (const deco of myDecorations) {
      if (!deco.polygonPoints || deco.polygonPoints.length < 3) continue;
      if (!deco.placedAssets || deco.placedAssets.length === 0) continue;

      // Polygon bounding box in map pixel space
      let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
      for (const p of deco.polygonPoints) {
        if (p.x < bMinX) bMinX = p.x;
        if (p.y < bMinY) bMinY = p.y;
        if (p.x > bMaxX) bMaxX = p.x;
        if (p.y > bMaxY) bMaxY = p.y;
      }
      const bboxW = bMaxX - bMinX;
      const bboxH = bMaxY - bMinY;
      if (bboxW <= 0 || bboxH <= 0) continue;

      // Determine grid extent from gridCells + placed assets
      const gridCells = deco.gridCells ?? [];
      let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
      for (const c of gridCells) {
        if (c.col < gMinX) gMinX = c.col;
        if (c.row < gMinY) gMinY = c.row;
        if (c.col > gMaxX) gMaxX = c.col;
        if (c.row > gMaxY) gMaxY = c.row;
      }
      for (const a of deco.placedAssets) {
        if (a.x < gMinX) gMinX = a.x;
        if (a.y < gMinY) gMinY = a.y;
        if (a.x > gMaxX) gMaxX = a.x;
        if (a.y > gMaxY) gMaxY = a.y;
      }
      if (!isFinite(gMinX)) continue;

      const gridCols = gMaxX - gMinX + 1;
      const gridRows = gMaxY - gMinY + 1;
      if (gridCols <= 0 || gridRows <= 0) continue;

      const cellMapW = bboxW / gridCols;
      const cellMapH = bboxH / gridRows;

      for (const asset of deco.placedAssets) {
        const assetGridW = asset.gridW ?? 1;
        const assetGridH = asset.gridH ?? 1;

        const px = bMinX + (asset.x - gMinX) * cellMapW;
        const py = bMinY + (asset.y - gMinY) * cellMapH;

        items.push({
          key: `${deco.spaceId}_${asset.assetId}_${asset.x}_${asset.y}`,
          pixelX: px,
          pixelY: py,
          width: assetGridW * cellMapW,
          height: assetGridH * cellMapH,
          assetId: asset.assetId,
          category: asset.packCategory ?? '',
          clanColor,
        });
      }
    }
    return items;
  }, [myDecorations, clan]);

  // Faint backings for locked pins (visible without glow)
  const lockedPinBackings = useMemo(() => {
    if (!locations || !mapConfig?.transformMatrix) return [];
    return locations
      .filter((loc) => loc.locked)
      .map((loc) => {
        const pixel = gpsToPixel(loc.gpsLat, loc.gpsLng, mapConfig.transformMatrix);
        const px = Math.round(pixel.x / MAP_TILE_SIZE) * MAP_TILE_SIZE;
        const py = Math.round(pixel.y / MAP_TILE_SIZE) * MAP_TILE_SIZE;
        return { px, py, key: loc.locationId };
      });
  }, [locations, mapConfig?.transformMatrix]);

  // Compute Skia glow data for each pin — idle glow always visible, intensifies with proximity
  const pinGlowData = useMemo(() => {
    const glowEntries: Array<{ px: number; py: number; factor: number; baseColor: string; key: string; isInRange: boolean }> = [];

    if (locations && mapConfig?.transformMatrix) {
      locations
        .filter((loc) => !loc.locked && !xpExhaustedIds?.has(loc.locationId))
        .forEach((loc) => {
          const prox = pinProximities?.get(loc.locationId);
          // factor: 0 = far/no GPS (idle glow), 1 = right on top of pin
          const factor = prox
            ? Math.max(0, Math.min(1, 1 - prox.distance / (prox.geofenceRadius * 2)))
            : 0;
          const pixel = gpsToPixel(loc.gpsLat, loc.gpsLng, mapConfig.transformMatrix);
          const px = Math.round(pixel.x / MAP_TILE_SIZE) * MAP_TILE_SIZE;
          const py = Math.round(pixel.y / MAP_TILE_SIZE) * MAP_TILE_SIZE;

          // State-aware glow color
          const isInRange = inRangeIds?.has(loc.locationId) ?? false;
          let baseColor: string;
          if (loc.isCoop) {
            baseColor = '#A78BFA';
          } else if (loc.bonusXP) {
            baseColor = '#E8F4FD';
          } else {
            const clanHex = CLAN_COLORS[clan ?? 'ember'];
            baseColor = isInRange ? clanHex : clanHex + 'AA';
          }

          glowEntries.push({ px, py, factor, baseColor, key: loc.locationId, isInRange });
        });
    }

    if (tutorialGlowPin && mapConfig?.transformMatrix) {
      glowEntries.push({
        px: tutorialGlowPin.px,
        py: tutorialGlowPin.py,
        factor: 1.0,
        isInRange: true,
        baseColor: '#FFD700',
        key: 'tutorial-pin',
      });
    }

    return glowEntries;
  }, [locations, mapConfig?.transformMatrix, pinProximities, xpExhaustedIds, inRangeIds, tutorialGlowPin]);

  // Space pin glow data — mirrors location glow logic (same sizing, clan color, dark backing)
  const spaceGlowData = useMemo(() => {
    if (!assignedSpaces || assignedSpaces.length === 0) return [];
    const clanHex = CLAN_COLORS[clan ?? 'ember'];
    return assignedSpaces.map((space) => {
      const prox = spacePinProximities?.get(space.spaceId);
      // factor: 0 = far/no GPS (idle glow), 1 = right on top of pin
      const factor = prox
        ? Math.max(0, Math.min(1, 1 - prox.distance / (prox.geofenceRadius * 2)))
        : 0;
      const centroid = space.polygonPoints && space.polygonPoints.length >= 3
        ? getPolygonCentroid(space.polygonPoints)
        : { x: space.mapPixelX, y: space.mapPixelY };
      const px = Math.round(centroid.x / MAP_TILE_SIZE) * MAP_TILE_SIZE;
      const py = Math.round(centroid.y / MAP_TILE_SIZE) * MAP_TILE_SIZE;
      const isInRange = inRangeSpaceIds?.has(space.spaceId) ?? false;
      const baseColor = isInRange ? '#CC2200' : '#CC2200AA';
      return { px, py, factor, isInRange, baseColor, key: space.spaceId };
    });
  }, [assignedSpaces, spacePinProximities, inRangeSpaceIds, clan]);

  // Early returns AFTER all hooks
  if (!mapConfig) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="large" color={PALETTE.softGreen} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  const dotColor = (__DEV__ && isDebugMode) ? PALETTE.honeyGold : (clan ? CLAN_COLORS[clan] : (pinColor ?? null));
  const ringStroke = pinRingColor ? pinRingColor + '73' : gpsRingColors.stroke;

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
              resizeMode={FastImage.resizeMode.cover}
              onLoad={handleMapImageLoad}
            />
            <View style={styles.desatOverlay} pointerEvents="none" />
            <Canvas style={styles.overlayCanvas}>
              {/* Locked pin backings — faint red circle for visibility */}
              {showOverlay && lockedPinBackings.map((b) => (
                <Circle
                  key={`locked-bg-${b.key}`}
                  cx={b.px}
                  cy={b.py}
                  r={28}
                  color="rgba(160, 40, 40, 0.25)"
                  style="fill"
                >
                  <BlurMask blur={12} style="normal" />
                </Circle>
              ))}
              {/* Pin proximity glow (Skia) */}
              {showOverlay && pinGlowData.map((g) => {
                const glowRadius = 18 + g.factor * 10;
                const blurAmount = 10 + g.factor * 6;
                const glowOpacity = 0.35 + g.factor * 0.25;
                const coreRadius = 4 + g.factor * 3;
                const coreOpacity = 0.5 + g.factor * 0.25;
                const ringRadius = glowRadius * 0.65;
                return (
                  <Group key={`glow-${g.key}`}>
                    {/* Dark map-separation backing */}
                    <Circle cx={g.px} cy={g.py} r={glowRadius * 1.3} color="rgba(15, 10, 5, 0.3)" style="fill">
                      <BlurMask blur={12} style="normal" />
                    </Circle>
                    {/* Wide soft outer halo */}
                    <Circle cx={g.px} cy={g.py} r={glowRadius * 1.2} color={g.baseColor} opacity={glowOpacity * 0.25}>
                      <BlurMask blur={blurAmount + 6} style="normal" />
                    </Circle>
                    {/* Main glow blob */}
                    <Circle cx={g.px} cy={g.py} r={glowRadius} color={g.baseColor} opacity={glowOpacity}>
                      <BlurMask blur={blurAmount} style="normal" />
                    </Circle>
                    {/* Bright core dot */}
                    <Circle cx={g.px} cy={g.py} r={coreRadius} color="#FFFFFF" opacity={coreOpacity} />
                    {/* Outline ring */}
                    <Circle cx={g.px} cy={g.py} r={ringRadius} color={g.baseColor} style="stroke" strokeWidth={1.5} opacity={0.5} />
                    {/* In-range breathing pulse ring */}
                    {g.isInRange && (
                      <Circle
                        cx={g.px}
                        cy={g.py}
                        r={glowRadius + animatedPulseRadius.value + 8}
                        color={g.baseColor}
                        opacity={animatedPulseOpacity.value}
                        style="stroke"
                        strokeWidth={2.5}
                      />
                    )}
                  </Group>
                );
              })}
              {/* Decoration assets from user's past submissions */}
              {decorationRenderData.length > 0 && (
                <Group>
                  {decorationRenderData.map((d) => (
                    <DecorationMapItem
                      key={`deco-${d.key}`}
                      assetId={d.assetId}
                      category={d.category}
                      mapPixelX={d.pixelX}
                      mapPixelY={d.pixelY}
                      width={d.width}
                      height={d.height}
                      color={d.clanColor}
                      font={decoFont}
                    />
                  ))}
                </Group>
              )}
              {/* Assigned space overlays — glow halo + crisp border */}
              {showOverlay && assignedSpacePaths.map((sp) => (
                <SkiaPath
                  key={`assigned-glow-${sp.key}`}
                  path={sp.d}
                  color="#CC2200BB"
                  style="stroke"
                  strokeWidth={20}
                  strokeJoin="round"
                  strokeCap="round"
                >
                  <BlurMask blur={18} style="normal" respectCTM={true} />
                </SkiaPath>
              ))}
              {showOverlay && assignedSpacePaths.map((sp) => (
                <SkiaPath
                  key={`assigned-border-${sp.key}`}
                  path={sp.d}
                  color="#CC2200"
                  style="stroke"
                  strokeWidth={5}
                  strokeJoin="round"
                  strokeCap="round"
                />
              ))}
              {showOverlay && assignedSpacePaths.filter((sp) => sp.completed).map((sp) => (
                <SkiaPath
                  key={`assigned-inner-${sp.key}`}
                  path={sp.d}
                  color="#FF6644"
                  style="stroke"
                  strokeWidth={1.5}
                  opacity={0.7}
                />
              ))}
              {/* FIX 4 — Highlight rings for selectSpace mode */}
              {showOverlay && highlightClanPaths.map((h) => (
                <SkiaPath
                  key={`highlight-ring-${h.key}`}
                  path={h.d}
                  color={h.color}
                  style="stroke"
                  strokeWidth={5}
                  opacity={animatedHighlightOpacity}
                >
                  <BlurMask blur={4} style="outer" />
                </SkiaPath>
              ))}
              {/* Space pin proximity glow — rendered AFTER territory overlay so it's not buried */}
              {showOverlay && spaceGlowData.map((g) => {
                const glowRadius = 26 + g.factor * 10;
                const blurAmount = 14 + g.factor * 6;
                const glowOpacity = 0.55 + g.factor * 0.25;
                const coreRadius = 6 + g.factor * 3;
                const coreOpacity = 0.7 + g.factor * 0.2;
                const ringRadius = glowRadius * 0.65;
                return (
                  <Group key={`space-glow-${g.key}`}>
                    {/* Dark map-separation backing */}
                    <Circle cx={g.px} cy={g.py} r={glowRadius * 1.3} color="rgba(15, 10, 5, 0.3)" style="fill">
                      <BlurMask blur={12} style="normal" />
                    </Circle>
                    {/* Wide soft outer halo */}
                    <Circle cx={g.px} cy={g.py} r={glowRadius * 1.2} color={g.baseColor} opacity={glowOpacity * 0.25}>
                      <BlurMask blur={blurAmount + 6} style="normal" />
                    </Circle>
                    {/* Main glow blob */}
                    <Circle cx={g.px} cy={g.py} r={glowRadius} color={g.baseColor} opacity={glowOpacity}>
                      <BlurMask blur={blurAmount} style="normal" />
                    </Circle>
                    {/* Bright core dot */}
                    <Circle cx={g.px} cy={g.py} r={coreRadius} color="#FFFFFF" opacity={coreOpacity} />
                    {/* Outline ring */}
                    <Circle cx={g.px} cy={g.py} r={ringRadius} color={g.baseColor} style="stroke" strokeWidth={1.5} opacity={0.5} />
                    {/* In-range breathing pulse ring */}
                    {g.isInRange && (
                      <Circle
                        cx={g.px}
                        cy={g.py}
                        r={glowRadius + animatedPulseRadius.value + 8}
                        color={g.baseColor}
                        opacity={animatedPulseOpacity.value}
                        style="stroke"
                        strokeWidth={2.5}
                      />
                    )}
                  </Group>
                );
              })}
              {playerX != null && playerY != null && dotColor && inBounds && (
                <Group>
                  {/* Expanding sonar ripple 1 */}
                  <Circle
                    cx={playerX}
                    cy={playerY}
                    r={ripple1Radius}
                    color={ringStroke}
                    style="stroke"
                    strokeWidth={1.5}
                    opacity={ripple1Opacity}
                  />
                  {/* Expanding sonar ripple 2 */}
                  <Circle
                    cx={playerX}
                    cy={playerY}
                    r={ripple2Radius}
                    color={ringStroke}
                    style="stroke"
                    strokeWidth={1.5}
                    opacity={ripple2Opacity}
                  />
                  {/* Dark backing under badge */}
                  <Circle cx={playerX} cy={playerY} r={16} color="rgba(15, 10, 5, 0.4)" style="fill">
                    <BlurMask blur={6} style="normal" />
                  </Circle>
                  {/* Player character icon */}
                  {!isDebugMode && playerCharacterImage ? (
                    <SkiaImage
                      image={playerCharacterImage}
                      x={playerX - 11}
                      y={playerY - 11}
                      width={22}
                      height={22}
                      fit="contain"
                    />
                  ) : (
                    <>
                      <Circle
                        cx={playerX}
                        cy={playerY}
                        r={11}
                        color={dotColor}
                        style="fill"
                      />
                      <Circle
                        cx={playerX}
                        cy={playerY}
                        r={11}
                        color={PALETTE.whiteStroke60}
                        style="stroke"
                        strokeWidth={1.5}
                      />
                    </>
                  )}
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
                    color={PALETTE.white}
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
            {showOverlay && mapConfig.transformMatrix && onPinPress && ((locations && locations.length > 0) || (assignedSpaces && assignedSpaces.length > 0)) && (
              <MapPinsLayer
                locations={locations ?? []}
                transformMatrix={mapConfig.transformMatrix}
                onPinPress={onPinPress}
                inRangeIds={inRangeIds}
                xpExhaustedIds={xpExhaustedIds}
                lockedUntilMap={lockedUntilMap}
                spaces={assignedSpaces}
                onSpacePress={onAssignedSpaceTap}
                inRangeSpaceIds={inRangeSpaceIds}
              />
            )}
            {tutorialGlowPin && tutorialPinPress && (
              <MapPin
                location={{ locationId: 'tutorial-location', name: 'The Grove', gpsLat: 0, gpsLng: 0, geofenceRadius: 0, category: 'other', locked: false }}
                pixelX={tutorialGlowPin.px}
                pixelY={tutorialGlowPin.py}
                onPress={tutorialPinPress}
                inRange
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
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: PALETTE.cream,
    fontSize: 14,
    fontFamily: FONTS.pixel,
    marginTop: 12,
  },
  desatOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
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
    fontFamily: FONTS.pixel,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  debugBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: PALETTE.goldOverlay,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 10,
  },
  debugBadgeText: {
    color: PALETTE.debugText,
    fontSize: 10,
    fontFamily: FONTS.pixel,
  },
  oobLabel: {
    width: 100,
    alignItems: 'center',
  },
  oobLabelText: {
    color: PALETTE.white,
    fontSize: 9,
    fontFamily: FONTS.pixel,
    letterSpacing: 1,
    backgroundColor: PALETTE.blackOverlay60,
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
    borderColor: PALETTE.honeyGold,
    borderRadius: 2,
  },
  tapModeBanner: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: PALETTE.goldOverlay,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tapModeBannerText: {
    color: PALETTE.debugText,
    fontSize: 10,
    fontFamily: FONTS.pixel,
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
    color: PALETTE.goldHalf,
    fontSize: 48,
    fontWeight: '200',
    fontFamily: FONTS.pixel,
  },
  tapToast: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: PALETTE.successToast,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tapToastText: {
    color: PALETTE.white,
    fontSize: 11,
    fontFamily: FONTS.pixel,
  },
});
