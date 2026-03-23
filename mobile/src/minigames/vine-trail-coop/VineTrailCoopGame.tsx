/**
 * Word Hunt Co-op — split-screen variant of Word Hunt (vine-trail).
 * P1 owns rows 0–3, P2 owns rows 4–7.
 * Boundary words (spanning both zones) require both players to trace
 * their portions, then jointly submit via a shared button.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { CLAN_COLORS, PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import { CoopDivider } from '@/components/minigames/CoopDivider';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import type { ClanId } from '@/types';
import { vineTrailPacks } from '../vine-trail/vineTrailPacks';
import {
  initGame,
  tapCell,
  submitWord,
  tickTimer,
  getWordFromPath,
  isAdjacent,
  isValidPath,
  type CellCoord,
  type VineTrailState,
} from '../vine-trail/VineTrailLogic';

// ── Grid constants ─────────────────────────────────────────────────

const ROWS = 8;
const COLS = 6;
const HALF_ROWS = 4;
const GRID_GAP = 3;
const GRID_PADDING = 8;
const screenWidth = Dimensions.get('window').width;
const cellSize = Math.floor((screenWidth - GRID_PADDING * 2 - GRID_GAP * (COLS - 1)) / COLS);
const halfGridHeight = cellSize * HALF_ROWS + GRID_GAP * (HALF_ROWS - 1);

// ── Per-word connector colors mapped to nearest PALETTE constants ──
const CONNECTOR_COLORS = [
  PALETTE.mutedRose,   // closest PALETTE match to #E07A5F (terracotta)
  PALETTE.softGreen,   // closest PALETTE match to #3D9970 (emerald)
  PALETTE.softBlue,    // closest PALETTE match to #7B6CF6 (lavender — no purple in PALETTE)
  PALETTE.amberLight,  // closest PALETTE match to #F4A261 (sandy orange)
  PALETTE.playerBlue,  // closest PALETTE match to #2196F3 (sky blue)
  PALETTE.errorRed,    // closest PALETTE match to #E91E8C (rose)
  PALETTE.deepGreen,   // closest PALETTE match to #81B29A (sage)
];

// ── Color helpers ──────────────────────────────────────────────────

function clanColor(clan: string): string {
  return CLAN_COLORS[clan as ClanId] ?? PALETTE.stoneGrey;
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + a;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function blendColorOver(baseHex: string, overlayHex: string, alpha: number): string {
  const base = hexToRgb(baseHex);
  const over = hexToRgb(overlayHex);
  const r = Math.round(base.r * (1 - alpha) + over.r * alpha);
  const g = Math.round(base.g * (1 - alpha) + over.g * alpha);
  const b = Math.round(base.b * (1 - alpha) + over.b * alpha);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ── Word ownership helpers ─────────────────────────────────────────

export type WordOwner = 'p1' | 'p2' | 'boundary';

export function classifyWordOwnership(
  words: { canonicalPath: CellCoord[] }[],
): WordOwner[] {
  return words.map(w => {
    let hasP1 = false;
    let hasP2 = false;
    for (const [r] of w.canonicalPath) {
      if (r < HALF_ROWS) hasP1 = true;
      else hasP2 = true;
    }
    if (hasP1 && hasP2) return 'boundary';
    if (hasP1) return 'p1';
    return 'p2';
  });
}

export function canPlayerTapRow(player: 'p1' | 'p2', row: number): boolean {
  if (player === 'p1') return row < HALF_ROWS;
  return row >= HALF_ROWS;
}

export function validateBoundaryPaths(
  p1Path: CellCoord[],
  p2Path: CellCoord[],
): { valid: boolean; combinedPath: CellCoord[] } {
  if (p1Path.length === 0 || p2Path.length === 0) {
    return { valid: false, combinedPath: [] };
  }

  // Try P1-end → P2-start
  const p1Last = p1Path[p1Path.length - 1];
  const p2First = p2Path[0];
  if (isAdjacent(p1Last, p2First)) {
    const combined = [...p1Path, ...p2Path];
    return { valid: true, combinedPath: combined };
  }

  // Try P2-end → P1-start
  const p2Last = p2Path[p2Path.length - 1];
  const p1First = p1Path[0];
  if (isAdjacent(p2Last, p1First)) {
    const combined = [...p2Path, ...p1Path];
    return { valid: true, combinedPath: combined };
  }

  // Try reversed orders
  const p1Rev = [...p1Path].reverse() as CellCoord[];
  const p2Rev = [...p2Path].reverse() as CellCoord[];

  if (isAdjacent(p1Rev[p1Rev.length - 1], p2First)) {
    return { valid: true, combinedPath: [...p1Rev, ...p2Path] };
  }
  if (isAdjacent(p1Last, p2Rev[0])) {
    return { valid: true, combinedPath: [...p1Path, ...p2Rev] };
  }
  if (isAdjacent(p2Rev[p2Rev.length - 1], p1First)) {
    return { valid: true, combinedPath: [...p2Rev, ...p1Path] };
  }
  if (isAdjacent(p2Last, p1Rev[0])) {
    return { valid: true, combinedPath: [...p2Path, ...p1Rev] };
  }
  if (isAdjacent(p1Rev[p1Rev.length - 1], p2Rev[0])) {
    return { valid: true, combinedPath: [...p1Rev, ...p2Rev] };
  }
  if (isAdjacent(p2Rev[p2Rev.length - 1], p1Rev[0])) {
    return { valid: true, combinedPath: [...p2Rev, ...p1Rev] };
  }

  return { valid: false, combinedPath: [] };
}

// ── Component ──────────────────────────────────────────────────────

export default function VineTrailCoopGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, puzzleData, practiceMode } = props;

  const p1Name = (puzzleData?.p1Name as string) ?? 'Player 1';
  const p1Clan = (puzzleData?.p1Clan as string) ?? 'ember';
  const p2Name = (puzzleData?.p2Name as string) ?? 'Player 2';
  const p2Clan = (puzzleData?.p2Clan as string) ?? 'tide';

  const p1Color = clanColor(p1Clan);
  const p2Color = clanColor(p2Clan);

  // ── Init ─────────────────────────────────────────────────────────

  const [pack] = useState(() => {
    // All packs are 8-row grids; no filter needed
    return vineTrailPacks[Math.floor(Math.random() * vineTrailPacks.length)];
  });

  const [gameState, setGameState] = useState<VineTrailState>(() => initGame(pack));
  const [p1Path, setP1Path] = useState<CellCoord[]>([]);
  const [p2Path, setP2Path] = useState<CellCoord[]>([]);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const gameOverHandled = useRef(false);
  const winDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs mirroring p1Path/p2Path for access inside callbacks without adding them to dep arrays
  const p1PathRef = useRef<CellCoord[]>([]);
  const p2PathRef = useRef<CellCoord[]>([]);

  // How to Play state + pause refs
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);

  const wordOwnership = useMemo(
    () => classifyWordOwnership(gameState.words),
    // Stable after init — word list doesn't change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState.words.length],
  );

  const wordColorMap = useMemo(() => {
    const map = new Map<number, string>();
    let colorIdx = 1;
    gameState.words.forEach((w, i) => {
      if (w.isSpangram) {
        map.set(i, CONNECTOR_COLORS[0]);
      } else {
        map.set(i, CONNECTOR_COLORS[colorIdx % CONNECTOR_COLORS.length]);
        colorIdx++;
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.words.length]);

  // ── Cell animations ──────────────────────────────────────────────

  const cellAnims = useRef<Animated.Value[][]>(
    Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => new Animated.Value(1)),
    ),
  ).current;

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Keep path refs in sync with state for use inside callbacks
  useEffect(() => { p1PathRef.current = p1Path; }, [p1Path]);
  useEffect(() => { p2PathRef.current = p2Path; }, [p2Path]);

  // Cleanup all timeout refs on unmount
  useEffect(() => {
    return () => {
      if (winDelayRef.current !== null) {
        clearTimeout(winDelayRef.current);
        winDelayRef.current = null;
      }
      if (wrongFlashRef.current !== null) {
        clearTimeout(wrongFlashRef.current);
        wrongFlashRef.current = null;
      }
    };
  }, []);

  // ── Timer ────────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      setGameState(prev => {
        if (prev.gameOver) return prev;
        return tickTimer(prev, timeLimit);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLimit]);

  const timeLeft = Math.max(0, timeLimit - gameState.timeElapsed);

  // ── Finish ───────────────────────────────────────────────────────

  const finishGame = useCallback(
    (outcome: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);
      setOverlayResult(outcome === 'win' ? 'win' : 'lose');
      setShowCompleteOverlay(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, outcome, timeTaken);

      const boundaryCount = gameState.words.filter((w, i) =>
        w.found && wordOwnership[i] === 'boundary',
      ).length;

      pendingResultRef.current = {
        result: outcome,
        timeTaken,
        completionHash,
        solutionData: {
          packId: pack.id,
          wordsFound: gameState.words.filter(w => w.found).map(w => w.word),
          solved: outcome === 'win',
          boundaryWordsFound: boundaryCount,
        },
      };
    },
    [sessionId, gameState.words, wordOwnership],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // ── How to Play ──────────────────────────────────────────────────

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

  // ── Handle game over from logic ──────────────────────────────────

  useEffect(() => {
    if (!gameState.gameOver || gameOverHandled.current) return;
    gameOverHandled.current = true;
    if (gameState.won) {
      winDelayRef.current = setTimeout(() => {
        winDelayRef.current = null;
        finishGame('win');
      }, 1000);
    } else {
      finishGame('timeout');
    }
  }, [gameState.gameOver, gameState.won, finishGame]);

  // ── Tap handlers ─────────────────────────────────────────────────

  const handleTap = useCallback((row: number, col: number, player: 'p1' | 'p2') => {
    if (gameOver || gameState.gameOver) return;
    if (!canPlayerTapRow(player, row)) return;

    const cellKey = `${row},${col}`;
    if (gameState.lockedCells.has(cellKey)) return;

    // Prevent selecting a cell already in the other player's path (read from refs to avoid dep on state arrays)
    const otherPath = player === 'p1' ? p2PathRef.current : p1PathRef.current;
    if (otherPath.some(([r, c]) => r === row && c === col)) return;

    const cell: CellCoord = [row, col];
    const setPath = player === 'p1' ? setP1Path : setP2Path;

    setPath(prev => {
      // Check backtrack
      const existingIdx = prev.findIndex(([r, c]) => r === row && c === col);
      if (existingIdx !== -1) {
        if (existingIdx === prev.length - 1) return prev;
        return prev.slice(0, existingIdx + 1);
      }

      if (prev.length === 0) return [cell];

      const last = prev[prev.length - 1];
      if (!isAdjacent(last, cell)) return prev;

      return [...prev, cell];
    });
  }, [gameOver, gameState.gameOver, gameState.lockedCells]);

  // ── Submit logic ─────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    if (gameOver) return;

    // Snapshot current paths from refs so we can read them inside the setGameState callback
    const currentP1Path = p1PathRef.current;
    const currentP2Path = p2PathRef.current;

    setGameState(prev => {
      if (prev.gameOver) return prev;

      // Determine what we're submitting
      const hasBothPaths = currentP1Path.length > 0 && currentP2Path.length > 0;
      const hasP1Only = currentP1Path.length > 0 && currentP2Path.length === 0;
      const hasP2Only = currentP2Path.length > 0 && currentP1Path.length === 0;

      let pathToSubmit: CellCoord[] | null = null;

      if (hasBothPaths) {
        // Boundary word attempt
        const { valid, combinedPath } = validateBoundaryPaths(currentP1Path, currentP2Path);
        if (!valid || !isValidPath(combinedPath, prev.pack.grid)) {
          // Invalid combined path — flash and clear
          setWrongFlash(true);
          wrongFlashRef.current = setTimeout(() => {
            wrongFlashRef.current = null;
            setWrongFlash(false);
          }, 400);
          setP1Path([]);
          setP2Path([]);
          return prev;
        }
        pathToSubmit = combinedPath;
      } else if (hasP1Only) {
        pathToSubmit = currentP1Path;
      } else if (hasP2Only) {
        pathToSubmit = currentP2Path;
      }

      if (!pathToSubmit || pathToSubmit.length === 0) return prev;

      // Build state with path and run submission logic against prev (not stale closure)
      const stateWithPath: VineTrailState = { ...prev, selectedPath: pathToSubmit };
      const { newState, result, canonicalPath } = submitWord(stateWithPath);

      if (result === 'correct' && canonicalPath) {
        canonicalPath.forEach(([r, c]) => {
          Animated.sequence([
            Animated.timing(cellAnims[r][c], { toValue: 1.15, duration: 150, useNativeDriver: true }),
            Animated.timing(cellAnims[r][c], { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        });
      } else if (result === 'wrong') {
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
      }

      setP1Path([]);
      setP2Path([]);

      return newState;
    });
  }, [gameOver, cellAnims, shakeAnim]);

  const handleClear = useCallback((player: 'p1' | 'p2') => {
    if (player === 'p1') setP1Path([]);
    else setP2Path([]);
  }, []);

  // ── Cell state computation ───────────────────────────────────────

  const p1PathSet = useMemo(() => new Set(p1Path.map(([r, c]) => `${r},${c}`)), [p1Path]);
  const p2PathSet = useMemo(() => new Set(p2Path.map(([r, c]) => `${r},${c}`)), [p2Path]);

  const foundCellMap = useMemo(() => {
    const map = new Map<string, { isSpangram: boolean; color: string }>();
    gameState.words.forEach((w, i) => {
      if (w.found) {
        w.canonicalPath.forEach(([r, c]) => {
          map.set(`${r},${c}`, {
            isSpangram: w.isSpangram,
            color: wordColorMap.get(i) ?? PALETTE.softGreen,
          });
        });
      }
    });
    return map;
  }, [gameState.words, wordColorMap]);

  const getCellStyle = useCallback((row: number, col: number): { bg: string; letterColor: string; border: boolean } => {
    const key = `${row},${col}`;
    const found = foundCellMap.get(key);

    if (found) {
      if (found.isSpangram) {
        return { bg: PALETTE.honeyGold, letterColor: PALETTE.cream, border: true };
      }
      return { bg: found.color, letterColor: PALETTE.cream, border: false };
    }

    if (wrongFlash && (p1PathSet.has(key) || p2PathSet.has(key))) {
      return { bg: PALETTE.mutedRose, letterColor: PALETTE.cream, border: false };
    }

    if (p1PathSet.has(key)) {
      return { bg: blendColorOver(PALETTE.parchmentBg, p1Color, 0.3), letterColor: PALETTE.darkBrown, border: false };
    }

    if (p2PathSet.has(key)) {
      return { bg: blendColorOver(PALETTE.parchmentBg, p2Color, 0.3), letterColor: PALETTE.darkBrown, border: false };
    }

    return { bg: PALETTE.parchmentBg, letterColor: PALETTE.darkBrown, border: false };
  }, [foundCellMap, p1PathSet, p2PathSet, wrongFlash, p1Color, p2Color]);

  // ── SVG helpers ──────────────────────────────────────────────────

  const getCellCenter = useCallback((row: number, col: number, rowOffset: number) => ({
    x: col * (cellSize + GRID_GAP) + cellSize / 2,
    y: (row - rowOffset) * (cellSize + GRID_GAP) + cellSize / 2,
  }), []);

  const halfGridWidth = cellSize * COLS + GRID_GAP * (COLS - 1);

  // ── Submit button state ──────────────────────────────────────────

  const canSubmit = p1Path.length > 0 || p2Path.length > 0;
  const isBoundarySubmit = p1Path.length > 0 && p2Path.length > 0;

  const p1Word = p1Path.length > 0 ? getWordFromPath(p1Path, gameState.pack.grid) : '';
  const p2Word = p2Path.length > 0 ? getWordFromPath(p2Path, gameState.pack.grid) : '';

  const foundCount = gameState.words.filter(w => w.found).length;
  const totalCount = gameState.words.length;

  const p1BgColor = withAlpha(p1Color, 0.1);
  const p2BgColor = withAlpha(p2Color, 0.1);

  // ── Render grid zone ─────────────────────────────────────────────

  const renderZone = (startRow: number, endRow: number, player: 'p1' | 'p2') => {
    const path = player === 'p1' ? p1Path : p2Path;
    const pathColor = player === 'p1' ? p1Color : p2Color;
    const rowOffset = startRow;

    // Filter path cells to this zone for SVG rendering
    const zonePath = path.filter(([r]) => r >= startRow && r < endRow);

    return (
      <Animated.View style={[
        styles.zoneGrid,
        { transform: [{ translateX: shakeAnim }] },
      ]}>
        <View style={styles.gridContainer}>
          {Array.from({ length: endRow - startRow }, (_, ri) => {
            const row = startRow + ri;
            return (
              <View key={row} style={styles.gridRow}>
                {Array.from({ length: COLS }, (_, col) => {
                  const cs = getCellStyle(row, col);
                  const isLocked = gameState.lockedCells.has(`${row},${col}`);
                  const scale = cellAnims[row][col];

                  return (
                    <Animated.View
                      key={col}
                      style={[
                        styles.cellOuter,
                        { transform: [{ scale }] },
                        col < COLS - 1 && { marginRight: GRID_GAP },
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.cell,
                          { backgroundColor: cs.bg },
                          cs.border && styles.cellSpangramBorder,
                        ]}
                        onPress={() => handleTap(row, col, player)}
                        activeOpacity={isLocked ? 1 : 0.7}
                        disabled={gameOver || gameState.gameOver}
                      >
                        <Text style={[styles.cellLetter, { color: cs.letterColor }]}>
                          {gameState.pack.grid[row][col]}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            );
          })}

          {/* SVG path overlay */}
          <View style={[styles.svgOverlay, { height: halfGridHeight }]} pointerEvents="none">
            <Svg width={halfGridWidth} height={halfGridHeight}>
              {zonePath.map((coord, i) => {
                if (i === 0) return null;
                const prev = getCellCenter(zonePath[i - 1][0], zonePath[i - 1][1], rowOffset);
                const curr = getCellCenter(coord[0], coord[1], rowOffset);
                return (
                  <Line
                    key={`line-${i}`}
                    x1={prev.x} y1={prev.y}
                    x2={curr.x} y2={curr.y}
                    stroke={pathColor}
                    strokeWidth={3}
                    opacity={0.7}
                  />
                );
              })}
              {zonePath.map((coord, i) => {
                const center = getCellCenter(coord[0], coord[1], rowOffset);
                return (
                  <Circle
                    key={`dot-${i}`}
                    cx={center.x} cy={center.y}
                    r={5}
                    fill={pathColor}
                    opacity={0.7}
                  />
                );
              })}
            </Svg>
          </View>
        </View>

        {/* Selected word display + clear button */}
        <View style={styles.zoneBottomRow}>
          <Text style={styles.selectedWord} numberOfLines={1}>
            {player === 'p1' ? p1Word : p2Word}
          </Text>
          {(player === 'p1' ? p1Path.length > 0 : p2Path.length > 0) && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => handleClear(player)}
              disabled={gameOver || gameState.gameOver}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Top row: word tracker + help button */}
      <View style={styles.topRow}>
        <View style={styles.wordTracker}>
          {gameState.words.map((w, i) => (
          <View
            key={i}
            style={[
              styles.wordPill,
              w.found && styles.wordPillFound,
              w.isSpangram && styles.wordPillSpangram,
              wordOwnership[i] === 'boundary' && !w.found && styles.wordPillBoundary,
            ]}
          >
            <Text style={[styles.wordPillText, w.found && styles.wordPillTextFound]}>
              {w.found ? w.word : '\u25CF'.repeat(w.word.length)}
            </Text>
          </View>
        ))}
        </View>
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* P1 Zone */}
      <View style={[styles.zone, { backgroundColor: p1BgColor }]}>
        {renderZone(0, HALF_ROWS, 'p1')}
      </View>

      {/* CoopDivider */}
      <CoopDivider
        p1Name={p1Name}
        p1Clan={p1Clan}
        p2Name={p2Name}
        p2Clan={p2Clan}
        timeLeft={timeLeft}
        totalTime={timeLimit}
      >
        <View style={styles.dividerContent}>
          <Text style={styles.countText}>{foundCount} / {totalCount}</Text>
          {!gameOver && (
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.7}
            >
              <Text style={[styles.submitButtonText, !canSubmit && styles.submitButtonTextDisabled]}>
                {isBoundarySubmit ? 'Submit Together' : 'Submit Word'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </CoopDivider>

      {/* P2 Zone */}
      <View style={[styles.zone, { backgroundColor: p2BgColor }]}>
        {renderZone(HALF_ROWS, ROWS, 'p2')}
      </View>

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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Vine Trail Co-op</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} The letter grid is split in half {'\u2014'} Player 1 searches the top half, Player 2 searches the bottom.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Trace words by tapping adjacent letters in your half.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Words that cross the boundary (marked with a dashed border in the word list) need both players to trace their portion and tap Submit Together.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} The word list is shared {'\u2014'} when either player finds a word, it is marked for both.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Find all hidden words before time runs out to win together.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Hints are not available in co-op mode {'\u2014'} work together to find every word!
            </Text>
            <Text style={styles.modalTip}>
              Tip: Start with words entirely in your half, then coordinate with your partner on boundary words.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          onContinue={handleContinue}
          practiceMode={practiceMode}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.background,
  },

  wordTracker: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 4,
  },
  wordPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.warmBrown,
    backgroundColor: 'transparent',
  },
  wordPillFound: {
    backgroundColor: PALETTE.softGreen,
    borderColor: PALETTE.softGreen,
  },
  wordPillSpangram: {
    borderColor: PALETTE.honeyGold,
    borderWidth: 2,
  },
  wordPillBoundary: {
    borderStyle: 'dashed',
  },
  wordPillText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 9,
    color: PALETTE.warmBrown,
    letterSpacing: 1,
  },
  wordPillTextFound: {
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
    fontSize: 10,
    letterSpacing: 0,
  },

  zone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },

  zoneGrid: {
    alignItems: 'center',
  },

  gridContainer: {
    position: 'relative',
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: GRID_GAP,
  },
  cellOuter: {
    width: cellSize,
    height: cellSize,
  },
  cell: {
    width: cellSize,
    height: cellSize,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.warmBrown,
  },
  cellSpangramBorder: {
    borderWidth: 2,
    borderColor: PALETTE.honeyGold,
  },
  cellLetter: {
    fontSize: cellSize * 0.45,
    fontFamily: FONTS.bodyBold,
  },
  svgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: cellSize * COLS + GRID_GAP * (COLS - 1),
  },

  zoneBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 28,
    gap: 8,
  },
  selectedWord: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: PALETTE.darkBrown,
    letterSpacing: 2,
  },
  clearButton: {
    backgroundColor: PALETTE.warmBrown,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearButtonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: PALETTE.cream,
  },

  dividerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.darkBrown,
  },
  submitButton: {
    backgroundColor: PALETTE.softGreen,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.deepGreen,
  },
  submitButtonDisabled: {
    backgroundColor: PALETTE.stoneGrey + '60',
    borderBottomColor: PALETTE.stoneGrey + '40',
  },
  submitButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: PALETTE.cream,
  },
  submitButtonTextDisabled: {
    color: PALETTE.stoneGrey,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  helpBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.parchmentDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  helpBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: PALETTE.darkBrown,
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
