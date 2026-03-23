import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Vibration,
  ImageBackground,
  Modal,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import {
  Canvas,
  Rect as SkiaRect,
  Group,
  Skia,
  Path as SkiaPath,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { XP_PER_WIN } from '@/constants/config';
import { generateClientCompletionHash } from '@/utils/hmac';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import type { MosaicPuzzleClient, MosaicTile, MosaicTilePlacement, MosaicCell } from '@/types';
import {
  getShapeCells,
  rotateCells,
  getPlacedCells,
  computePlacementState,
} from './MosaicLogic';

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

// ─── Constants ───────────────────────────────────────────────────────────────

const TILE_COLORS: Record<string, string> = {
  mo_tile_leaf:     PALETTE.softGreen,
  mo_tile_mushroom: PALETTE.mushroomRed,
  mo_tile_stone:    PALETTE.stoneGrey,
  mo_tile_acorn:    PALETTE.honeyGold,
};

const GHOST_VALID   = PALETTE.ghostValidFill;
const GHOST_INVALID = PALETTE.ghostInvalidFill;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TRAY_PREVIEW_CELL = 14;
const FLOAT_PREVIEW_CELL = 20;

const SELECT_SPRING = { damping: 14, stiffness: 160, mass: 0.8 };
const DESELECT_SPRING = { damping: 16, stiffness: 200, mass: 0.7 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a Skia path outlining each cell in a list (for tile borders). */
function buildCellBordersPath(
  cells: MosaicCell[],
  cellSize: number,
  allCellKeys: Set<string>,
): ReturnType<typeof Skia.Path.Make> {
  const path = Skia.Path.Make();
  for (const cell of cells) {
    const x = cell.col * cellSize;
    const y = cell.row * cellSize;
    // Only draw border edges that are NOT shared with another cell of the same tile
    if (!allCellKeys.has(`${cell.col},${cell.row - 1}`)) {
      path.moveTo(x, y); path.lineTo(x + cellSize, y);
    }
    if (!allCellKeys.has(`${cell.col + 1},${cell.row}`)) {
      path.moveTo(x + cellSize, y); path.lineTo(x + cellSize, y + cellSize);
    }
    if (!allCellKeys.has(`${cell.col},${cell.row + 1}`)) {
      path.moveTo(x, y + cellSize); path.lineTo(x + cellSize, y + cellSize);
    }
    if (!allCellKeys.has(`${cell.col - 1},${cell.row}`)) {
      path.moveTo(x, y); path.lineTo(x, y + cellSize);
    }
  }
  return path;
}

// ─── TrayTile (animated sub-component) ───────────────────────────────────────

interface TrayTileProps {
  tile: MosaicTile;
  isSelected: boolean;
  isOtherSelected: boolean;
  rotation: 0 | 90 | 180 | 270;
  onTap: (tileId: string) => void;
  makePanGesture: (tileId: string) => ReturnType<typeof Gesture.Pan>;
}

function TrayTile({ tile, isSelected, isOtherSelected, rotation, onTap, makePanGesture }: TrayTileProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.5 : 1, isSelected ? SELECT_SPRING : DESELECT_SPRING);
  }, [isSelected, scale]);

  useEffect(() => {
    opacity.value = withTiming(isOtherSelected ? 0.45 : 1, { duration: 150 });
  }, [isOtherSelected, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Show rotated cells when selected, base shape when not
  const cells = isSelected
    ? rotateCells(getShapeCells(tile.shape), rotation / 90)
    : getShapeCells(tile.shape);
  const maxCol = Math.max(...cells.map(c => c.col)) + 1;
  const maxRow = Math.max(...cells.map(c => c.row)) + 1;
  const cellSet = new Set(cells.map(c => `${c.col},${c.row}`));
  const color = TILE_COLORS[tile.assetKey] || PALETTE.stoneGrey;

  const gridCells: React.JSX.Element[] = [];
  for (let r = 0; r < maxRow; r++) {
    for (let c = 0; c < maxCol; c++) {
      const filled = cellSet.has(`${c},${r}`);
      gridCells.push(
        <View
          key={`${c},${r}`}
          style={{
            position: 'absolute',
            left: c * TRAY_PREVIEW_CELL,
            top: r * TRAY_PREVIEW_CELL,
            width: TRAY_PREVIEW_CELL,
            height: TRAY_PREVIEW_CELL,
            backgroundColor: filled ? color : 'transparent',
            borderWidth: filled ? 1 : 0,
            borderColor: filled ? PALETTE.darkBrown : 'transparent',
            borderRadius: 2,
          }}
        />,
      );
    }
  }

  const tapGesture = useMemo(() =>
    Gesture.Tap().onEnd(() => {
      'worklet';
      runOnJS(onTap)(tile.tileId);
    }),
    [onTap, tile.tileId],
  );

  const panGesture = useMemo(
    () => makePanGesture(tile.tileId).enabled(isSelected),
    [makePanGesture, tile.tileId, isSelected],
  );

  // Pan wins over Tap when finger moves; otherwise Tap fires
  const composedGesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.tileCard,
          isSelected && styles.tileCardSelected,
          animStyle,
        ]}
      >
        <View style={{ width: maxCol * TRAY_PREVIEW_CELL, height: maxRow * TRAY_PREVIEW_CELL }}>
          {gridCells}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MosaicGame(props: MinigamePlayProps): React.JSX.Element {
  const { sessionId, timeLimit, onComplete, practiceMode } = props;
  const puzzle = props.puzzleData as MosaicPuzzleClient | undefined;

  // No puzzle data → auto-lose
  useEffect(() => {
    if (!puzzle || !puzzle.gridCols) {
      const timeTaken = 0;
      const completionHash = generateClientCompletionHash(sessionId, 'lose', timeTaken);
      onComplete({ result: 'lose', timeTaken, completionHash, solutionData: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!puzzle || !puzzle.gridCols) {
    return (
      <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
        <Text style={styles.errorFallback}>
          Puzzle data missing. Returning...
        </Text>
      </ImageBackground>
    );
  }

  return <MosaicGameInner puzzle={puzzle} sessionId={sessionId} timeLimit={timeLimit} onComplete={onComplete} practiceMode={practiceMode} />;
}

// ─── Inner game (puzzle guaranteed) ──────────────────────────────────────────

interface InnerProps {
  puzzle: MosaicPuzzleClient;
  sessionId: string;
  timeLimit: number;
  onComplete: (result: MinigameResult) => void;
  practiceMode?: boolean;
}

function MosaicGameInner({ puzzle, sessionId, timeLimit, onComplete, practiceMode }: InnerProps): React.JSX.Element {
  const gameDuration = timeLimit > 0 ? timeLimit : 120;

  // ── Game state ──
  const [placements, setPlacements] = useState<MosaicTilePlacement[]>([]);
  const [timeLeft, setTimeLeft] = useState(gameDuration);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingCompleteRef = useRef<MinigameResult | null>(null);
  const placementOrderRef = useRef<string[]>([]);

  // ── How to Play modal (pauses timer) ──
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);

  // ── Selection state (tap-to-select, tap-to-rotate in tray) ──
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedRotation, setSelectedRotation] = useState<0 | 90 | 180 | 270>(0);

  // ── Drag state ──
  const [dragTileId, setDragTileId] = useState<string | null>(null);
  const [snapCol, setSnapCol] = useState<number | null>(null);
  const [snapRow, setSnapRow] = useState<number | null>(null);
  const [ghostValid, setGhostValid] = useState(false);
  const [lastSnapKey, setLastSnapKey] = useState('');

  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Grid layout tracking (absolute position on screen)
  const gridLayoutRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // ── Shared value for gesture worklets (useRef won't work — worklets snapshot closure values) ──
  const selectedRotationSV = useSharedValue(0);
  useEffect(() => { selectedRotationSV.value = selectedRotation; }, [selectedRotation, selectedRotationSV]);

  // ── Derived data ──
  const placedTileIds = useMemo(() => new Set(placements.map(p => p.tileId)), [placements]);
  const unplacedTiles = useMemo(() => puzzle.tiles.filter(t => !placedTileIds.has(t.tileId)), [puzzle.tiles, placedTileIds]);

  const { cellStates, isComplete } = useMemo(
    () => computePlacementState(puzzle, placements),
    [puzzle, placements],
  );

  // ── Grid sizing ──
  const gridPadding = 16;
  const availableWidth = SCREEN_WIDTH - gridPadding * 2;
  const availableHeight = SCREEN_HEIGHT * 0.50;
  const cellSize = Math.min(
    Math.floor(availableWidth / puzzle.gridCols),
    Math.floor(availableHeight / puzzle.gridRows),
    56,
  );
  const gridWidth = cellSize * puzzle.gridCols;
  const gridHeight = cellSize * puzzle.gridRows;

  const targetSet = useMemo(
    () => new Set(puzzle.targetCells.map(c => `${c.col},${c.row}`)),
    [puzzle.targetCells],
  );

  // ── Timer ──
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, gameDuration - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) finishGame('lose');
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  // ── Win check ──
  useEffect(() => {
    if (isComplete && !completedRef.current) {
      const timer = setTimeout(() => finishGame('win'), 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // ── Finish game ──
  const finishGame = useCallback(
    (outcome: 'win' | 'lose') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);
      setOverlayResult(outcome);
      setShowCompleteOverlay(true);
      setDragTileId(null);
      setSelectedTileId(null);
      isDragging.value = false;

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, outcome, timeTaken);
      pendingCompleteRef.current = {
        result: outcome,
        timeTaken,
        completionHash,
        solutionData: { placements },
      };
    },
    [placements, sessionId, isDragging],
  );

  const handleContinue = useCallback(() => {
    if (pendingCompleteRef.current) {
      onComplete(pendingCompleteRef.current);
      pendingCompleteRef.current = null;
    }
  }, [onComplete]);

  // ── How to Play open/close ──
  const openHowToPlay = useCallback(() => {
    isPausedRef.current = true;
    pauseStartRef.current = Date.now();
    setIsHowToPlayVisible(true);
  }, []);

  const closeHowToPlay = useCallback(() => {
    const pausedMs = Date.now() - pauseStartRef.current;
    startTimeRef.current += pausedMs;
    isPausedRef.current = false;
    setIsHowToPlayVisible(false);
  }, []);

  // ── Tray tap: select or rotate ──
  const handleTrayTap = useCallback((tileId: string) => {
    if (gameOver) return;
    if (selectedTileId === tileId) {
      // Already selected → rotate 90°
      setSelectedRotation(prev => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
      Vibration.vibrate(5);
    } else {
      // Select new tile (or switch from another)
      setSelectedTileId(tileId);
      setSelectedRotation(0);
      Vibration.vibrate(8);
    }
  }, [gameOver, selectedTileId]);

  // ── Deselect ──
  const handleDeselect = useCallback(() => {
    if (selectedTileId && !dragTileId) {
      setSelectedTileId(null);
      setSelectedRotation(0);
    }
  }, [selectedTileId, dragTileId]);

  // ── Drag callbacks (called via runOnJS from gesture worklets) ──

  const onDragStart = useCallback((tileId: string) => {
    if (gameOver) return;
    setDragTileId(tileId);
    setSnapCol(null);
    setSnapRow(null);
    setGhostValid(false);
    setLastSnapKey('');
    Vibration.vibrate(10);
  }, [gameOver]);

  const onDragUpdate = useCallback((absX: number, absY: number, tileId: string, rotation: number) => {
    if (gameOver || !tileId) return;

    const gl = gridLayoutRef.current;
    const relX = absX - gl.x;
    const relY = absY - gl.y;

    // Check if finger is over the grid
    if (relX >= 0 && relY >= 0 && relX < gl.w && relY < gl.h) {
      const col = Math.floor(relX / cellSize);
      const row = Math.floor(relY / cellSize);
      const clampedCol = Math.max(0, Math.min(col, puzzle.gridCols - 1));
      const clampedRow = Math.max(0, Math.min(row, puzzle.gridRows - 1));

      // Compute validity
      const tile = puzzle.tiles.find(t => t.tileId === tileId);
      if (tile) {
        const placement: MosaicTilePlacement = {
          tileId,
          originCol: clampedCol,
          originRow: clampedRow,
          rotation: rotation as 0 | 90 | 180 | 270,
        };
        const cells = getPlacedCells(tile, placement);
        const outOfBounds = cells.some(
          c => c.col < 0 || c.row < 0 || c.col >= puzzle.gridCols || c.row >= puzzle.gridRows,
        );
        const offTarget = cells.some(
          c => !targetSet.has(`${c.col},${c.row}`),
        );
        const occupiedKeys = new Set<string>();
        for (const p of placements) {
          const pt = puzzle.tiles.find(t => t.tileId === p.tileId);
          if (!pt) continue;
          for (const c of getPlacedCells(pt, p)) {
            occupiedKeys.add(`${c.col},${c.row}`);
          }
        }
        const hasOverlap = cells.some(c => occupiedKeys.has(`${c.col},${c.row}`));
        const valid = !outOfBounds && !offTarget && !hasOverlap;

        setSnapCol(clampedCol);
        setSnapRow(clampedRow);
        setGhostValid(valid);

        // Haptic on new valid snap
        const newKey = `${clampedCol},${clampedRow}`;
        if (newKey !== lastSnapKey) {
          setLastSnapKey(newKey);
          if (valid) Vibration.vibrate(5);
        }
      }
    } else {
      setSnapCol(null);
      setSnapRow(null);
    }
  }, [gameOver, puzzle, placements, cellSize, lastSnapKey]);

  const onDragEnd = useCallback((tileId: string, rotation: number) => {
    if (gameOver || !tileId) {
      setDragTileId(null);
      isDragging.value = false;
      return;
    }

    if (snapCol !== null && snapRow !== null && ghostValid) {
      // Place the tile
      const placement: MosaicTilePlacement = {
        tileId,
        originCol: snapCol,
        originRow: snapRow,
        rotation: rotation as 0 | 90 | 180 | 270,
      };
      setPlacements(prev => [...prev, placement]);
      placementOrderRef.current.push(tileId);
      Vibration.vibrate(15);
      // Clear selection after successful placement
      setSelectedTileId(null);
      setSelectedRotation(0);
    }
    // If not placed, tile stays selected in tray (returns to enlarged state)

    setDragTileId(null);
    setSnapCol(null);
    setSnapRow(null);
    setGhostValid(false);
    setLastSnapKey('');
    isDragging.value = false;
  }, [gameOver, snapCol, snapRow, ghostValid, isDragging]);

  // ── Grid tap to pick up placed tile or deselect ──
  const handleGridTap = useCallback((absX: number, absY: number) => {
    if (gameOver) return;

    // Don't process grid taps while actively dragging
    if (dragTileId) return;

    const gl = gridLayoutRef.current;
    const relX = absX - gl.x;
    const relY = absY - gl.y;
    if (relX < 0 || relY < 0 || relX >= gl.w || relY >= gl.h) return;

    const col = Math.floor(relX / cellSize);
    const row = Math.floor(relY / cellSize);
    const key = `${col},${row}`;

    const overlappingPlacements = placements.filter(p => {
      const tile = puzzle.tiles.find(t => t.tileId === p.tileId);
      if (!tile) return false;
      return getPlacedCells(tile, p).some(c => `${c.col},${c.row}` === key);
    });

    if (overlappingPlacements.length > 0) {
      const order = placementOrderRef.current;
      const toPick = overlappingPlacements.reduce((latest, p) =>
        order.indexOf(p.tileId) > order.indexOf(latest.tileId) ? p : latest,
      );
      setPlacements(prev => prev.filter(p => p.tileId !== toPick.tileId));
      placementOrderRef.current = placementOrderRef.current.filter(id => id !== toPick.tileId);
      Vibration.vibrate(10);
    } else {
      // Tapped empty grid area → deselect
      handleDeselect();
    }
  }, [gameOver, dragTileId, placements, puzzle, cellSize, handleDeselect]);

  // ── Grid tap gesture ──
  const gridTapGesture = useMemo(() =>
    Gesture.Tap()
      .onEnd((e) => {
        'worklet';
        runOnJS(handleGridTap)(e.absoluteX, e.absoluteY);
      }),
    [handleGridTap],
  );

  // ── Floating piece animated style ──
  const floatingStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: fingerX.value - 40,
    top: fingerY.value - 40,
    opacity: isDragging.value ? 0.85 : 0,
    transform: [{ scale: isDragging.value ? 1 : 0.5 }],
    pointerEvents: 'none' as const,
  }));

  // ── Build Skia elements for the grid ──

  // 1. Target cells
  const targetCellRects = useMemo(() => {
    return puzzle.targetCells.map(cell => ({
      key: `target-${cell.col}-${cell.row}`,
      x: cell.col * cellSize,
      y: cell.row * cellSize,
    }));
  }, [puzzle.targetCells, cellSize]);

  // 2. Placed tile groups (cells + borders + shadow)
  const placedTileRenderData = useMemo(() => {
    const data: Array<{
      tileId: string;
      color: string;
      cells: MosaicCell[];
      borderPath: ReturnType<typeof Skia.Path.Make>;
    }> = [];

    for (const p of placements) {
      const tile = puzzle.tiles.find(t => t.tileId === p.tileId);
      if (!tile) continue;
      const cells = getPlacedCells(tile, p);
      const cellKeys = new Set(cells.map(c => `${c.col},${c.row}`));
      const color = TILE_COLORS[tile.assetKey] || PALETTE.stoneGrey;
      const borderPath = buildCellBordersPath(cells, cellSize, cellKeys);
      data.push({ tileId: tile.tileId, color, cells, borderPath });
    }
    return data;
  }, [placements, puzzle.tiles, cellSize]);

  // 3. Ghost preview cells (uses selectedRotation — rotation is locked before drag)
  const ghostCells = useMemo(() => {
    if (!dragTileId || snapCol === null || snapRow === null) return null;
    const tile = puzzle.tiles.find(t => t.tileId === dragTileId);
    if (!tile) return null;

    const placement: MosaicTilePlacement = {
      tileId: dragTileId,
      originCol: snapCol,
      originRow: snapRow,
      rotation: selectedRotation,
    };
    return getPlacedCells(tile, placement);
  }, [dragTileId, snapCol, snapRow, selectedRotation, puzzle.tiles]);

  const ghostBorderPath = useMemo(() => {
    if (!ghostCells) return null;
    const keys = new Set(ghostCells.map(c => `${c.col},${c.row}`));
    return buildCellBordersPath(ghostCells, cellSize, keys);
  }, [ghostCells, cellSize]);

  // 4. Grid outline path
  const gridOutlinePath = useMemo(() => {
    const path = Skia.Path.Make();
    // Outer border
    path.addRect(Skia.XYWHRect(0, 0, gridWidth, gridHeight));
    // Inner grid lines
    for (let col = 1; col < puzzle.gridCols; col++) {
      path.moveTo(col * cellSize, 0);
      path.lineTo(col * cellSize, gridHeight);
    }
    for (let row = 1; row < puzzle.gridRows; row++) {
      path.moveTo(0, row * cellSize);
      path.lineTo(gridWidth, row * cellSize);
    }
    return path;
  }, [puzzle.gridCols, puzzle.gridRows, cellSize, gridWidth, gridHeight]);

  // 5. Overlap overlay cells
  const overlapCells = useMemo(() => {
    const cells: MosaicCell[] = [];
    for (const [key, state] of cellStates) {
      if (state === 'overlap') {
        const [c, r] = key.split(',').map(Number);
        cells.push({ col: c, row: r });
      }
    }
    return cells;
  }, [cellStates]);

  // ── Timer fraction ──
  const timerFraction = timeLeft / gameDuration;

  // ── Floating piece preview data (uses selectedRotation) ──
  const floatingPieceCells = useMemo(() => {
    if (!dragTileId) return [];
    const tile = puzzle.tiles.find(t => t.tileId === dragTileId);
    if (!tile) return [];
    return rotateCells(getShapeCells(tile.shape), selectedRotation / 90);
  }, [dragTileId, selectedRotation, puzzle.tiles]);

  const floatingPieceColor = useMemo(() => {
    if (!dragTileId) return PALETTE.stoneGrey;
    const tile = puzzle.tiles.find(t => t.tileId === dragTileId);
    return tile ? (TILE_COLORS[tile.assetKey] || PALETTE.stoneGrey) : PALETTE.stoneGrey;
  }, [dragTileId, puzzle.tiles]);

  // ── Pan gesture factory for tray tiles ──
  // Only activates when the tile is currently selected (enlarged).
  // minDistance(10) distinguishes drag from tap.
  const makeTilePanGesture = useCallback((tileId: string) => {
    return Gesture.Pan()
      .minDistance(10)
      .onStart((e) => {
        'worklet';
        fingerX.value = e.absoluteX;
        fingerY.value = e.absoluteY;
        isDragging.value = true;
        runOnJS(onDragStart)(tileId);
      })
      .onUpdate((e) => {
        'worklet';
        fingerX.value = e.absoluteX;
        fingerY.value = e.absoluteY;
        runOnJS(onDragUpdate)(e.absoluteX, e.absoluteY, tileId, selectedRotationSV.value);
      })
      .onEnd(() => {
        'worklet';
        runOnJS(onDragEnd)(tileId, selectedRotationSV.value);
      })
      .onFinalize(() => {
        'worklet';
        isDragging.value = false;
      });
  }, [fingerX, fingerY, isDragging, onDragStart, onDragUpdate, onDragEnd]);

  const gridContainerRef = useRef<View>(null);

  const measureGrid = useCallback(() => {
    gridContainerRef.current?.measureInWindow((x, y, w, h) => {
      gridLayoutRef.current = { x, y, w, h };
    });
  }, []);

  // Measure grid position after layout
  useEffect(() => {
    const timer = setTimeout(measureGrid, 100);
    return () => clearTimeout(timer);
  }, [measureGrid]);

  return (
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar with help button */}
      <View style={styles.topBar}>
        <View style={{ width: 32 }} />
        <TouchableOpacity
          style={styles.helpBtn}
          onPress={openHowToPlay}
          disabled={gameOver}
          activeOpacity={0.7}
        >
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* Timer bar */}
      <View style={styles.timerBarBg}>
        <View
          style={[
            styles.timerBarFill,
            {
              width: `${timerFraction * 100}%`,
              backgroundColor: timerFraction > 0.25 ? PALETTE.softGreen : PALETTE.mutedRose,
            },
          ]}
        />
      </View>
      <Text style={styles.timerText}>{Math.ceil(timeLeft)}s</Text>

      {/* Grid area */}
      <GestureDetector gesture={gridTapGesture}>
        <View
          ref={gridContainerRef}
          style={styles.gridContainer}
          onLayout={measureGrid}
          collapsable={false}
        >
          <Canvas style={{ width: gridWidth, height: gridHeight }}>
            {/* Background fill */}
            <SkiaRect
              x={0} y={0}
              width={gridWidth} height={gridHeight}
              color={PALETTE.mosaicGridBg}
            />

            {/* Target cells (unfilled) */}
            {targetCellRects.map(cell => (
              <SkiaRect
                key={cell.key}
                x={cell.x} y={cell.y}
                width={cellSize} height={cellSize}
                color={PALETTE.mosaicTargetCell}
              />
            ))}

            {/* Grid lines */}
            <SkiaPath
              path={gridOutlinePath}
              color={PALETTE.stoneGreyMid}
              style="stroke"
              strokeWidth={1}
            />

            {/* Placed tiles */}
            {placedTileRenderData.map(({ tileId, color, cells, borderPath }) => (
              <Group key={`placed-${tileId}`}>
                {/* Shadow layer */}
                {cells.map(cell => (
                  <SkiaRect
                    key={`sh-${cell.col}-${cell.row}`}
                    x={cell.col * cellSize + 2}
                    y={cell.row * cellSize + 2}
                    width={cellSize}
                    height={cellSize}
                    color={PALETTE.blackOverlay12}
                  />
                ))}
                {/* Tile fill */}
                {cells.map(cell => (
                  <SkiaRect
                    key={`tf-${cell.col}-${cell.row}`}
                    x={cell.col * cellSize}
                    y={cell.row * cellSize}
                    width={cellSize}
                    height={cellSize}
                    color={color}
                  />
                ))}
                {/* Tile outline */}
                <SkiaPath
                  path={borderPath}
                  color={PALETTE.darkBrown}
                  style="stroke"
                  strokeWidth={2}
                />
              </Group>
            ))}

            {/* Overlap indicators */}
            {overlapCells.map(cell => (
              <SkiaRect
                key={`ov-${cell.col}-${cell.row}`}
                x={cell.col * cellSize}
                y={cell.row * cellSize}
                width={cellSize}
                height={cellSize}
                color={PALETTE.overlapRed50}
              />
            ))}

            {/* Ghost preview */}
            {ghostCells && ghostCells.map(cell => {
              // Only draw ghost cells that are within grid bounds
              if (cell.col < 0 || cell.row < 0 || cell.col >= puzzle.gridCols || cell.row >= puzzle.gridRows) {
                return null;
              }
              return (
                <SkiaRect
                  key={`ghost-${cell.col}-${cell.row}`}
                  x={cell.col * cellSize}
                  y={cell.row * cellSize}
                  width={cellSize}
                  height={cellSize}
                  color={ghostValid ? GHOST_VALID : GHOST_INVALID}
                />
              );
            })}
            {ghostBorderPath && (
              <SkiaPath
                path={ghostBorderPath}
                color={ghostValid ? PALETTE.ghostValidBorder : PALETTE.ghostInvalidBorder}
                style="stroke"
                strokeWidth={2}
              />
            )}
          </Canvas>
        </View>
      </GestureDetector>

      {/* Tile tray */}
      <View style={styles.trayContainer}>
        <View style={styles.trayContent}>
          {unplacedTiles.map(tile => (
            <TrayTile
              key={tile.tileId}
              tile={tile}
              isSelected={selectedTileId === tile.tileId}
              isOtherSelected={selectedTileId !== null && selectedTileId !== tile.tileId}
              rotation={selectedTileId === tile.tileId ? selectedRotation : 0}
              onTap={handleTrayTap}
              makePanGesture={makeTilePanGesture}
            />
          ))}
          {unplacedTiles.length === 0 && !isComplete && (
            <Text style={styles.trayEmpty}>All tiles placed</Text>
          )}
        </View>
      </View>

      {/* Floating drag piece (follows finger) */}
      <Animated.View style={floatingStyle} pointerEvents="none">
        {dragTileId && (
          <View style={styles.floatingPiece}>
            {floatingPieceCells.map(cell => (
              <View
                key={`fl-${cell.col}-${cell.row}`}
                style={{
                  position: 'absolute',
                  left: cell.col * FLOAT_PREVIEW_CELL,
                  top: cell.row * FLOAT_PREVIEW_CELL,
                  width: FLOAT_PREVIEW_CELL,
                  height: FLOAT_PREVIEW_CELL,
                  backgroundColor: floatingPieceColor,
                  borderWidth: 1,
                  borderColor: PALETTE.darkBrown,
                  borderRadius: 3,
                }}
              />
            ))}
          </View>
        )}
      </Animated.View>

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          xpEarned={overlayResult === 'win' ? XP_PER_WIN : 0}
          onContinue={handleContinue}
          practiceMode={practiceMode}
        />
      )}

      {/* How to Play modal */}
      <Modal
        animationType="slide"
        transparent
        visible={isHowToPlayVisible}
        onRequestClose={closeHowToPlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeHowToPlay}>
          <Pressable style={styles.modalPanel} onPress={() => {}}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={closeHowToPlay}>
              <Text style={styles.modalCloseBtnText}>{'\u00D7'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>How to Play — Tile Fit</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Place all tiles to fill the highlighted area exactly.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap a tile in the tray to select it. Drag it onto the grid to place.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap a selected tile again to rotate it 90{'\u00B0'}.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tiles cannot overlap. All highlighted cells must be covered.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap any placed tile on the grid to pick it back up.
            </Text>
            <Text style={styles.modalTip}>
              Tip: If a piece doesn{'\u2019'}t fit, try rotating it{'\u2014'}it may work in a different orientation.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  errorFallback: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 16,
    color: PALETTE.mutedRose,
    textAlign: 'center',
    marginTop: 40,
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  helpBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.parchmentDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: PALETTE.darkBrown,
  },
  timerBarBg: {
    width: '90%',
    height: 8,
    backgroundColor: PALETTE.stoneGrey,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 2,
    alignSelf: 'center',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI.text,
    marginBottom: 6,
    alignSelf: 'center',
  },
  gridContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: PALETTE.stoneGrey,
    borderRadius: 6,
    padding: 2,
    backgroundColor: PALETTE.mosaicGridBg,
    elevation: 3,
    shadowColor: PALETTE.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  trayContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 12,
  },
  trayContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  tileCard: {
    backgroundColor: PALETTE.cream,
    borderWidth: 2,
    borderColor: PALETTE.stoneGrey,
    borderRadius: 8,
    padding: 10,
    minWidth: 60,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: PALETTE.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tileCardSelected: {
    borderColor: PALETTE.honeyGold,
    borderWidth: 3,
    elevation: 6,
    shadowColor: PALETTE.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    zIndex: 10,
  },
  trayEmpty: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: PALETTE.stoneGrey,
    alignSelf: 'center',
  },
  floatingPiece: {
    width: 80,
    height: 80,
  },
  // ── How to Play modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: PALETTE.blackOverlay50,
    justifyContent: 'flex-end',
  },
  modalPanel: {
    backgroundColor: PALETTE.parchment,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.parchmentDark,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  modalCloseBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 18,
    color: PALETTE.darkBrown,
  },
  modalTitle: {
    fontFamily: FONTS.title,
    fontSize: 18,
    color: PALETTE.darkBrown,
    marginBottom: 16,
  },
  modalRule: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.darkBrown,
    lineHeight: 22,
    marginBottom: 8,
  },
  modalTip: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.darkBrown,
    lineHeight: 22,
    fontStyle: 'italic',
    marginTop: 12,
  },
});
