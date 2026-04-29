import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  ImageBackground,
  Modal,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import {
  Canvas,
  Rect as SkiaRect,
  Circle as SkiaCircle,
  Path as SkiaPath,
  Skia,
  Group,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { FIREFLY_TIME_LIMIT, XP_PER_WIN } from '@/constants/config';
import { generateClientCompletionHash } from '@/utils/hmac';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import {
  generatePuzzle,
  validateSolution,
  areCellsEqual,
  GRID_SIZE,
  COLOR_HEX,
  type Cell,
  type PairColor,
  type PlayerPath,
} from './FireflyFlowLogic';

// ─── Constants ──────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_WIDTH = Math.floor(SCREEN_WIDTH * 0.88);
const CELL_SIZE = Math.floor(GRID_WIDTH / GRID_SIZE);
const ACTUAL_GRID = CELL_SIZE * GRID_SIZE;

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

// ─── Helpers ────────────────────────────────────────────────────────────────

function cellFromPosition(x: number, y: number): Cell | null {
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
  return { row, col };
}

function cellCenter(cell: Cell): { x: number; y: number } {
  return {
    x: cell.col * CELL_SIZE + CELL_SIZE / 2,
    y: cell.row * CELL_SIZE + CELL_SIZE / 2,
  };
}

function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

function isEndpoint(cell: Cell, pairs: Array<{ color: PairColor; start: Cell; end: Cell }>): PairColor | null {
  for (const pair of pairs) {
    if (areCellsEqual(cell, pair.start) || areCellsEqual(cell, pair.end)) {
      return pair.color;
    }
  }
  return null;
}

function findColorAtCell(cell: Cell, paths: PlayerPath, pairs: Array<{ color: PairColor }>): PairColor | null {
  for (const pair of pairs) {
    const path = paths[pair.color];
    if (path && path.some((c) => areCellsEqual(c, cell))) {
      return pair.color;
    }
  }
  return null;
}

function buildSkiaPathStr(cells: Cell[]): string {
  if (cells.length === 0) return '';
  const start = cellCenter(cells[0]);
  let d = `M ${start.x} ${start.y}`;
  for (let i = 1; i < cells.length; i++) {
    const pt = cellCenter(cells[i]);
    d += ` L ${pt.x} ${pt.y}`;
  }
  return d;
}

function isPathConnected(path: Cell[] | undefined, pair: { start: Cell; end: Cell }): boolean {
  if (!path || path.length < 2) return false;
  const s = path[0];
  const e = path[path.length - 1];
  return (
    (areCellsEqual(s, pair.start) && areCellsEqual(e, pair.end)) ||
    (areCellsEqual(s, pair.end) && areCellsEqual(e, pair.start))
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FireflyFlowGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, practiceMode } = props;

  const puzzleRef = useRef(generatePuzzle());
  const puzzle = puzzleRef.current;
  const gameDuration = timeLimit > 0 ? timeLimit : FIREFLY_TIME_LIMIT;

  // React state for rendering
  const [playerPaths, setPlayerPaths] = useState<PlayerPath>(() => {
    const initial: Partial<PlayerPath> = {};
    for (const pair of puzzle.pairs) {
      initial[pair.color] = [];
    }
    return initial as PlayerPath;
  });
  const [activeColor, setActiveColor] = useState<PairColor | null>(null);
  const [drawingPath, setDrawingPath] = useState<Cell[]>([]);
  const [timeLeft, setTimeLeft] = useState(gameDuration);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [winFlash, setWinFlash] = useState(false);
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

  // Refs for gesture callbacks (they capture stale React state otherwise)
  const activeColorRef = useRef<PairColor | null>(null);
  const drawingPathRef = useRef<Cell[]>([]);
  const playerPathsRef = useRef(playerPaths);
  playerPathsRef.current = playerPaths;
  const gameOverRef = useRef(false);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const winTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);

  // Pulse animation for completed endpoint dots
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Timer using Date.now() deltas
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, gameDuration - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        finishGame('lose');
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, gameDuration]);

  const finishGame = useCallback(
    (result: 'win' | 'lose') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);
      gameOverRef.current = true;

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, result, timeTaken);

      const connectedCount = puzzle.pairs.filter((pair) => {
        const path = playerPathsRef.current[pair.color];
        return isPathConnected(path, pair);
      }).length;

      pendingResultRef.current = {
        result,
        timeTaken,
        completionHash,
        solutionData: {
          pairsConnected: connectedCount,
          totalPairs: puzzle.pairs.length,
          solved: result === 'win',
        },
      };

      setOverlayResult(result);
      setShowCompleteOverlay(true);
    },
    [sessionId, puzzle.pairs],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // Check win condition after every path change
  useEffect(() => {
    if (gameOver) return;
    if (validateSolution(puzzle, playerPaths)) {
      setWinFlash(true);
      winTimeoutRef.current = setTimeout(() => finishGame('win'), 400);
      return () => {
        if (winTimeoutRef.current) {
          clearTimeout(winTimeoutRef.current);
          winTimeoutRef.current = null;
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerPaths, gameOver]);

  // Pulse animation for completed paths
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Count connected pairs
  const connectedCount = useMemo(() => {
    return puzzle.pairs.filter((pair) => {
      const path = playerPaths[pair.color];
      return isPathConnected(path, pair);
    }).length;
  }, [playerPaths, puzzle.pairs]);

  // ─── How-To-Play ─────────────────────────────────────────────────────────

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

  // ─── Touch handling ───────────────────────────────────────────────────────
  // Use refs for all mutable state inside gesture callbacks so we never
  // read stale React state during a single pan gesture.

  /** Build occupied-cell map from current playerPaths, excluding a given color. */
  function getOccupiedExcluding(paths: PlayerPath, excludeColor: PairColor | null): Map<string, PairColor> {
    const map = new Map<string, PairColor>();
    for (const pair of puzzle.pairs) {
      if (pair.color === excludeColor) continue;
      const path = paths[pair.color];
      if (path) {
        for (const cell of path) {
          map.set(cellKey(cell), pair.color);
        }
      }
    }
    return map;
  }

  // Occupied cells ref (rebuilt whenever playerPaths or activeColor changes)
  const occupiedRef = useRef(getOccupiedExcluding(playerPaths, activeColor));
  useEffect(() => {
    occupiedRef.current = getOccupiedExcluding(playerPaths, activeColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerPaths, activeColor]);

  const gesture = useMemo(() => {
    return Gesture.Pan()
      .runOnJS(true)
      .onBegin((e) => {
        if (gameOverRef.current) return;
        const cell = cellFromPosition(e.x, e.y);
        if (!cell) return;

        const currentPaths = playerPathsRef.current;
        const endpointColor = isEndpoint(cell, puzzle.pairs);

        if (endpointColor) {
          // Starting from an endpoint — clear existing path and begin drawing
          activeColorRef.current = endpointColor;
          drawingPathRef.current = [cell];

          const newPaths = { ...currentPaths, [endpointColor]: [] };
          playerPathsRef.current = newPaths;
          occupiedRef.current = getOccupiedExcluding(newPaths, endpointColor);

          setActiveColor(endpointColor);
          setDrawingPath([cell]);
          setPlayerPaths(newPaths);
        } else {
          const existingColor = findColorAtCell(cell, currentPaths, puzzle.pairs);
          if (existingColor) {
            // Tapping an existing path — clear it
            const newPaths = { ...currentPaths, [existingColor]: [] };
            playerPathsRef.current = newPaths;

            setPlayerPaths(newPaths);
          }
        }
      })
      .onUpdate((e) => {
        const color = activeColorRef.current;
        if (gameOverRef.current || !color) return;

        const cell = cellFromPosition(e.x, e.y);
        if (!cell) return;

        const prev = drawingPathRef.current;
        if (prev.length === 0) return;
        const last = prev[prev.length - 1];

        // Same cell — no change
        if (areCellsEqual(cell, last)) return;

        // Must be adjacent (no diagonals)
        const dr = Math.abs(cell.row - last.row);
        const dc = Math.abs(cell.col - last.col);
        if (dr + dc !== 1) return;

        // If cell is already in our drawing path — backtrack to it
        const existingIdx = prev.findIndex((c) => areCellsEqual(c, cell));
        if (existingIdx >= 0) {
          const backtracked = prev.slice(0, existingIdx + 1);
          drawingPathRef.current = backtracked;
          setDrawingPath(backtracked);
          return;
        }

        // If cell is occupied by a DIFFERENT color — stop extending
        const key = cellKey(cell);
        const occupier = occupiedRef.current.get(key);
        if (occupier && occupier !== color) return;

        // If cell is an endpoint of a DIFFERENT color — stop extending
        const epColor = isEndpoint(cell, puzzle.pairs);
        if (epColor && epColor !== color) return;

        const extended = [...prev, cell];
        drawingPathRef.current = extended;
        setDrawingPath(extended);
      })
      .onEnd(() => {
        const color = activeColorRef.current;
        if (!color) return;

        const finalPath = [...drawingPathRef.current];

        // Find the pair for this color
        const pair = puzzle.pairs.find((p) => p.color === color);

        // Only keep the path if it ends on the matching endpoint
        const valid = pair && finalPath.length >= 2 && isPathConnected(finalPath, pair);
        const newPaths = {
          ...playerPathsRef.current,
          [color]: valid ? finalPath : [],
        };
        playerPathsRef.current = newPaths;

        activeColorRef.current = null;
        drawingPathRef.current = [];

        setPlayerPaths(newPaths);
        setActiveColor(null);
        setDrawingPath([]);
      })
      .minDistance(0)
      .shouldCancelWhenOutside(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle]);

  // ─── Render ─────────────────────────────────────────────────────────────

  // Build all path data for rendering
  const pathsToRender = useMemo(() => {
    const result: Array<{ color: PairColor; cells: Cell[]; connected: boolean }> = [];
    for (const pair of puzzle.pairs) {
      const cells =
        pair.color === activeColor ? drawingPath : playerPaths[pair.color];
      if (cells && cells.length > 0) {
        result.push({
          color: pair.color,
          cells,
          connected: isPathConnected(cells, pair),
        });
      }
    }
    return result;
  }, [puzzle.pairs, playerPaths, activeColor, drawingPath]);

  // Cells covered by all paths (tracks which color covers each cell)
  const coveredCells = useMemo(() => {
    const map = new Map<string, PairColor>();
    for (const { color, cells } of pathsToRender) {
      for (const cell of cells) {
        map.set(cellKey(cell), color);
      }
    }
    return map;
  }, [pathsToRender]);

  return (
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar */}
      <View style={styles.topBar}>
        <View />
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.instruction}>Connect the pairs. Light every tile.</Text>

      {/* Timer */}
      <Text style={styles.timerText}>{Math.ceil(timeLeft)}s</Text>
      <View style={styles.timerBarBg}>
        <View
          style={[
            styles.timerBarFill,
            {
              width: `${(timeLeft / gameDuration) * 100}%`,
              backgroundColor:
                timeLeft / gameDuration > 0.25 ? PALETTE.softGreen : PALETTE.mutedRose,
            },
          ]}
        />
      </View>

      {/* Grid */}
      <View style={styles.gridWrapper}>
        <GestureDetector gesture={gesture}>
          <View style={[styles.gridContainer, { width: ACTUAL_GRID, height: ACTUAL_GRID }]}>
            <Canvas style={{ width: ACTUAL_GRID, height: ACTUAL_GRID }}>
              {/* Cell backgrounds */}
              {Array.from({ length: GRID_SIZE }, (_, row) =>
                Array.from({ length: GRID_SIZE }, (_, col) => {
                  const x = col * CELL_SIZE;
                  const y = row * CELL_SIZE;
                  const key = `${row},${col}`;
                  const coverColor = coveredCells.get(key);

                  return (
                    <Group key={key}>
                      <SkiaRect
                        x={x + 1}
                        y={y + 1}
                        width={CELL_SIZE - 2}
                        height={CELL_SIZE - 2}
                        color={coverColor ? COLOR_HEX[coverColor] : PALETTE.parchmentBg}
                        opacity={coverColor ? 0.4 : 1}
                      />
                      <SkiaRect
                        x={x + 1}
                        y={y + 1}
                        width={CELL_SIZE - 2}
                        height={CELL_SIZE - 2}
                        color={PALETTE.warmBrown}
                        style="stroke"
                        strokeWidth={1}
                      />
                    </Group>
                  );
                }),
              )}

              {/* Drawn paths */}
              {pathsToRender.map(({ color, cells, connected }) => {
                if (cells.length < 2) return null;
                const pathStr = buildSkiaPathStr(cells);
                const path = Skia.Path.MakeFromSVGString(pathStr);
                if (!path) return null;

                return (
                  <SkiaPath
                    key={`path-${color}`}
                    path={path}
                    color={COLOR_HEX[color]}
                    style="stroke"
                    strokeWidth={8}
                    strokeCap="round"
                    strokeJoin="round"
                    opacity={connected ? 1 : 0.8}
                  />
                );
              })}

              {/* Endpoint dots with glow halos */}
              {puzzle.pairs.map((pair) => {
                const hexColor = COLOR_HEX[pair.color];
                return [pair.start, pair.end].map((endpoint, ei) => {
                  const center = cellCenter(endpoint);
                  return (
                    <Group key={`ep-${pair.color}-${ei}`}>
                      <SkiaCircle
                        cx={center.x}
                        cy={center.y}
                        r={18}
                        color={hexColor}
                        opacity={0.3}
                      />
                      <SkiaCircle
                        cx={center.x}
                        cy={center.y}
                        r={10}
                        color={hexColor}
                      />
                    </Group>
                  );
                });
              })}

              {/* Win flash overlay */}
              {winFlash && (
                <SkiaRect
                  x={0}
                  y={0}
                  width={ACTUAL_GRID}
                  height={ACTUAL_GRID}
                  color={PALETTE.honeyGold}
                  opacity={0.3}
                />
              )}
            </Canvas>
          </View>
        </GestureDetector>
      </View>

      {/* Pair count indicator */}
      <Text style={styles.pairCount}>
        {connectedCount} / {puzzle.pairs.length} connected
      </Text>

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          practiceMode={practiceMode}
          onContinue={handleContinue}
          xpEarned={overlayResult === 'win' ? XP_PER_WIN : 0}
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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Connect the Dots</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} A 6{'\u00D7'}6 grid shows pairs of coloured dots.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Draw a path connecting each matching pair.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Paths cannot cross each other.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Every cell on the grid must be covered to win.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap a mid-path cell to erase that colour's path and redraw.
            </Text>
            <Text style={styles.modalTip}>
              Tip: Fill every cell {'\u2014'} a solution that connects all pairs but leaves gaps won't count.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  topBar: {
    width: '100%',
    height: 48,
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
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.darkBrown,
    alignSelf: 'flex-start',
    marginLeft: '5%',
    marginBottom: 2,
  },
  timerBarBg: {
    width: '90%',
    height: 8,
    backgroundColor: PALETTE.stoneGrey,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 2,
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  instruction: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: PALETTE.stoneGrey,
    marginTop: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  gridWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  gridContainer: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  pairCount: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: PALETTE.darkBrown,
    marginBottom: 20,
    textAlign: 'center',
  },

  // How to Play modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
