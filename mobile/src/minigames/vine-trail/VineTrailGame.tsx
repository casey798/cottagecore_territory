import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { vineTrailPacks } from './vineTrailPacks';
import {
  initGame,
  tapCell,
  submitWord,
  getHint,
  clearHint,
  tickTimer,
  getWordFromPath,
  type CellCoord,
  type VineTrailState,
} from './VineTrailLogic';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import { generateClientCompletionHash } from '@/utils/hmac';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';

const ROWS = 8;
const COLS = 6;
const GRID_GAP = 3;
const GRID_PADDING = 8;
const screenWidth = Dimensions.get('window').width;
const cellSize = Math.floor((screenWidth - GRID_PADDING * 2 - GRID_GAP * (COLS - 1)) / COLS);
const gridWidth = cellSize * COLS + GRID_GAP * (COLS - 1);
const gridHeight = cellSize * ROWS + GRID_GAP * (ROWS - 1);

const COLORS = {
  parchment: '#F5EACB',
  darkBrown: '#3D2B1F',
  honeyGold: '#D4A843',
  softGreen: '#7CAA5E',
  mutedRose: '#C48B8B',
  warmBrown: '#8B6914',
  cream: '#FFF5DC',
  altFlash: '#A0D080',
  neutralConnector: '#A0937D',
};

const CONNECTOR_COLORS = [
  '#E07A5F', // terracotta
  '#3D9970', // emerald
  '#7B6CF6', // lavender
  '#F4A261', // sandy orange
  '#2196F3', // sky blue
  '#E91E8C', // rose
  '#81B29A', // sage
];

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

function formatTime(seconds: number, limit: number): string {
  const remaining = Math.max(0, limit - seconds);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function VineTrailGame({ sessionId, timeLimit, onComplete }: MinigamePlayProps) {
  const [pack] = useState(() => {
    const idx = Math.floor(Math.random() * vineTrailPacks.length);
    return vineTrailPacks[idx];
  });
  const [state, setState] = useState<VineTrailState>(() => initGame(pack));
  const [gridOffset, setGridOffset] = useState({ x: 0, y: 0 });

  // Assign each word a connector color: spangram always gets index 0
  const wordColorMap = useMemo(() => {
    const map = new Map<number, string>();
    let colorIdx = 1; // start at 1 since 0 is reserved for spangram
    state.words.forEach((w, i) => {
      if (w.isSpangram) {
        map.set(i, CONNECTOR_COLORS[0]);
      } else {
        map.set(i, CONNECTOR_COLORS[colorIdx % CONNECTOR_COLORS.length]);
        colorIdx++;
      }
    });
    return map;
  }, [state.words.length]); // stable after init

  // Animation refs
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const cellAnims = useRef<Animated.Value[][]>(
    Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => new Animated.Value(1)),
    ),
  ).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const [flashCells, setFlashCells] = useState<Set<string>>(new Set());
  const [flashColor, setFlashColor] = useState<string>(COLORS.softGreen);
  const [fadingPath, setFadingPath] = useState<CellCoord[] | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const gameOverHandled = useRef(false);
  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

  const finishGame = useCallback(
    (outcome: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setOverlayResult(outcome === 'win' ? 'win' : 'lose');
      setShowCompleteOverlay(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, outcome, timeTaken);

      pendingResultRef.current = {
        result: outcome,
        timeTaken,
        completionHash,
        solutionData: {
          packId: pack.id,
          wordsFound: state.words.filter(w => w.found).map(w => w.word),
          solved: outcome === 'win',
        },
      };
    },
    [sessionId, pack.id, state.words],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        if (prev.gameOver) return prev;
        return tickTimer(prev, timeLimit);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLimit]);

  // Handle game over
  useEffect(() => {
    if (!state.gameOver || gameOverHandled.current) return;
    gameOverHandled.current = true;
    if (state.won) {
      setTimeout(() => finishGame('win'), 1000);
    } else {
      finishGame('timeout');
    }
  }, [state.gameOver, state.won, finishGame]);

  // Hint timer - clear after 3 seconds
  useEffect(() => {
    if (!state.hintActive) {
      hintOpacity.setValue(0);
      return;
    }
    // Pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(hintOpacity, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(hintOpacity, { toValue: 0.3, duration: 600, useNativeDriver: false }),
      ]),
    );
    pulse.start();
    const timer = setTimeout(() => {
      pulse.stop();
      hintOpacity.setValue(0);
      setState(prev => clearHint(prev));
    }, 3000);
    return () => {
      clearTimeout(timer);
      pulse.stop();
    };
  }, [state.hintActive, hintOpacity]);

  const handleTap = useCallback((row: number, col: number) => {
    setState(prev => tapCell(prev, [row, col]));
  }, []);

  const handleSubmit = useCallback(() => {
    setState(prev => {
      if (prev.selectedPath.length === 0) return prev;
      const { newState, result, canonicalPath, usedAlternatePath } = submitWord(prev);

      if (result === 'correct' && canonicalPath) {
        if (usedAlternatePath) {
          // Show fading user path
          setFadingPath([...prev.selectedPath]);
          fadeAnim.setValue(1);
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }).start(() => setFadingPath(null));

          // Flash canonical path with alt color
          const flashSet = new Set<string>();
          canonicalPath.forEach(([r, c]) => flashSet.add(`${r},${c}`));
          setFlashColor(COLORS.altFlash);
          setFlashCells(flashSet);
          setTimeout(() => {
            setFlashCells(new Set());
            setFlashColor(COLORS.softGreen);
          }, 800);
        }

        // Bounce animation on canonical path cells
        canonicalPath.forEach(([r, c]) => {
          const anim = cellAnims[r][c];
          Animated.sequence([
            Animated.timing(anim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        });
      } else if (result === 'wrong') {
        // Shake animation
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
      } else if (result === 'already_found' && canonicalPath) {
        // Flash already found cells
        const flashSet = new Set<string>();
        canonicalPath.forEach(([r, c]) => flashSet.add(`${r},${c}`));
        setFlashColor(COLORS.honeyGold);
        setFlashCells(flashSet);
        setTimeout(() => setFlashCells(new Set()), 400);
      }

      return newState;
    });
  }, [shakeAnim, cellAnims, fadeAnim]);

  const handleClear = useCallback(() => {
    setState(prev => ({ ...prev, selectedPath: [] }));
  }, []);

  const handleHint = useCallback(() => {
    setState(prev => getHint(prev));
  }, []);

  const onGridLayout = useCallback((e: LayoutChangeEvent) => {
    e.target.measureInWindow((x: number, y: number) => {
      setGridOffset({ x, y });
    });
  }, []);

  // Determine connector color based on which word the current path might be building
  const activeConnectorColor = useMemo(() => {
    if (state.selectedPath.length === 0) return COLORS.neutralConnector;
    // Check if selectedPath is a prefix of any unfound word's canonical path
    for (let wi = 0; wi < state.words.length; wi++) {
      const w = state.words[wi];
      if (w.found) continue;
      const cp = w.canonicalPath;
      if (cp.length < state.selectedPath.length) continue;
      let match = true;
      for (let j = 0; j < state.selectedPath.length; j++) {
        if (state.selectedPath[j][0] !== cp[j][0] || state.selectedPath[j][1] !== cp[j][1]) {
          match = false;
          break;
        }
      }
      if (match) return wordColorMap.get(wi) ?? COLORS.neutralConnector;
    }
    return COLORS.neutralConnector;
  }, [state.selectedPath, state.words, wordColorMap]);

  // Build cell state lookup
  const cellStates = useMemo(() => {
    const map = new Map<string, { bg: string; letterColor: string; border: boolean }>();

    // Selected path
    const selectedSet = new Set<string>();
    state.selectedPath.forEach(([r, c]) => selectedSet.add(`${r},${c}`));

    // Hint path
    const hintSet = new Set<string>();
    if (state.hintActive && state.hintPath) {
      state.hintPath.forEach(([r, c]) => hintSet.add(`${r},${c}`));
    }

    // Found words - figure out which cells are spangram
    const spangramCells = new Set<string>();
    const foundCells = new Set<string>();
    state.words.forEach(w => {
      if (w.found) {
        w.canonicalPath.forEach(([r, c]) => {
          foundCells.add(`${r},${c}`);
          if (w.isSpangram) spangramCells.add(`${r},${c}`);
        });
      }
    });

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key = `${r},${c}`;
        let bg = COLORS.parchment;
        let letterColor = COLORS.darkBrown;
        let border = false;

        if (flashCells.has(key)) {
          bg = flashColor;
          letterColor = COLORS.cream;
        } else if (foundCells.has(key)) {
          if (spangramCells.has(key)) {
            bg = COLORS.honeyGold;
            letterColor = COLORS.cream;
            border = true;
          } else {
            bg = COLORS.softGreen;
            letterColor = COLORS.cream;
          }
        } else if (selectedSet.has(key)) {
          bg = blendColorOver(COLORS.parchment, activeConnectorColor, 0.3);
          letterColor = COLORS.darkBrown;
        } else if (hintSet.has(key)) {
          bg = COLORS.mutedRose;
          letterColor = COLORS.cream;
        }

        map.set(key, { bg, letterColor, border });
      }
    }
    return map;
  }, [state.words, state.selectedPath, state.hintActive, state.hintPath, flashCells, flashColor, activeConnectorColor]);

  const currentWord = state.selectedPath.length > 0
    ? getWordFromPath(state.selectedPath, state.pack.grid)
    : '';

  const foundCount = state.words.filter(w => w.found).length;
  const totalCount = state.words.length;

  const initialCooldownRemaining = Math.max(0, 30 - state.timeElapsed);
  const betweenCooldownRemaining = state.lastHintTime >= 0
    ? Math.max(0, 20 - (state.timeElapsed - state.lastHintTime))
    : 0;
  const hintCooldownRemaining = Math.max(initialCooldownRemaining, betweenCooldownRemaining);
  const hintOnCooldown = hintCooldownRemaining > 0;
  const hintDisabled = state.hintActive || state.hintsRemaining <= 0 || hintOnCooldown || state.gameOver;

  const getCellCenter = (row: number, col: number) => ({
    x: col * (cellSize + GRID_GAP) + cellSize / 2,
    y: row * (cellSize + GRID_GAP) + cellSize / 2,
  });

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.timerText}>{formatTime(state.timeElapsed, timeLimit)}</Text>
        <Text style={styles.themeText}>{state.pack.theme}</Text>
        <Text style={styles.countText}>{foundCount} / {totalCount}</Text>
      </View>

      {/* Word tracker pills */}
      <View style={styles.wordTracker}>
        {state.words.map((w, i) => (
          <View
            key={i}
            style={[
              styles.wordPill,
              w.found && styles.wordPillFound,
              w.isSpangram && styles.wordPillSpangram,
            ]}
          >
            <Text style={[styles.wordPillText, w.found && styles.wordPillTextFound]}>
              {w.found ? w.word : '\u25CF'.repeat(w.word.length)}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.gridContainer} onLayout={onGridLayout}>
        {Array.from({ length: ROWS }, (_, row) => (
          <View key={row} style={styles.gridRow}>
            {Array.from({ length: COLS }, (_, col) => {
              const key = `${row},${col}`;
              const cs = cellStates.get(key)!;
              const isLocked = state.lockedCells.has(key);
              const scale = cellAnims[row][col];

              return (
                <Animated.View
                  key={key}
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
                    onPress={() => handleTap(row, col)}
                    activeOpacity={isLocked ? 1 : 0.7}
                    disabled={state.gameOver}
                  >
                    <Text style={[styles.cellLetter, { color: cs.letterColor }]}>
                      {state.pack.grid[row][col]}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        ))}

        {/* SVG connector line overlay */}
        <View style={styles.svgOverlay} pointerEvents="none">
          <Svg width={gridWidth} height={gridHeight}>
            {/* Selected path lines */}
            {state.selectedPath.map((coord, i) => {
              if (i === 0) return null;
              const prev = getCellCenter(state.selectedPath[i - 1][0], state.selectedPath[i - 1][1]);
              const curr = getCellCenter(coord[0], coord[1]);
              return (
                <Line
                  key={`line-${i}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={curr.x}
                  y2={curr.y}
                  stroke={activeConnectorColor}
                  strokeWidth={3}
                  opacity={0.7}
                />
              );
            })}
            {/* Selected path node circles */}
            {state.selectedPath.map((coord, i) => {
              const center = getCellCenter(coord[0], coord[1]);
              return (
                <Circle
                  key={`dot-${i}`}
                  cx={center.x}
                  cy={center.y}
                  r={5}
                  fill={activeConnectorColor}
                  opacity={0.7}
                />
              );
            })}
          </Svg>
        </View>

        {/* Fading path overlay for alternate path */}
        {fadingPath && (
          <Animated.View style={[styles.svgOverlay, { opacity: fadeAnim }]} pointerEvents="none">
            <Svg width={gridWidth} height={gridHeight}>
              {fadingPath.map((coord, i) => {
                if (i === 0) return null;
                const prev = getCellCenter(fadingPath[i - 1][0], fadingPath[i - 1][1]);
                const curr = getCellCenter(coord[0], coord[1]);
                return (
                  <Line
                    key={`fade-line-${i}`}
                    x1={prev.x}
                    y1={prev.y}
                    x2={curr.x}
                    y2={curr.y}
                    stroke={COLORS.honeyGold}
                    strokeWidth={3}
                    opacity={0.7}
                  />
                );
              })}
            </Svg>
          </Animated.View>
        )}
      </View>

      {/* Bottom area: selected word + buttons */}
      <Animated.View style={[styles.bottomArea, { transform: [{ translateX: shakeAnim }] }]}>
        <Text style={styles.selectedWord}>
          {currentWord || ' '}
        </Text>
      </Animated.View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={handleClear}
          disabled={state.selectedPath.length === 0 || state.gameOver}
        >
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.submitButton]}
          onPress={handleSubmit}
          disabled={state.selectedPath.length === 0 || state.gameOver}
        >
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.hintButton, hintDisabled && styles.hintButtonDisabled]}
          onPress={handleHint}
          disabled={hintDisabled}
        >
          <Text style={[styles.buttonText, hintDisabled && styles.hintButtonTextDisabled]}>
            {hintOnCooldown
              ? `Hint (${hintCooldownRemaining}s)`
              : `Hint (${state.hintsRemaining})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Spangram hint */}
      <Text style={styles.spangramHint}>{state.pack.spangramHint}</Text>

      {/* Game complete overlay */}
      {showCompleteOverlay && (
        <GameCompleteOverlay
          result={overlayResult}
          onContinue={handleContinue}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.parchment,
    alignItems: 'center',
    paddingTop: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: gridWidth,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  timerText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.darkBrown,
    fontVariant: ['tabular-nums'],
  },
  themeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warmBrown,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  countText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkBrown,
  },
  wordTracker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: gridWidth,
    marginBottom: 8,
    gap: 4,
  },
  wordPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.warmBrown,
    backgroundColor: 'transparent',
  },
  wordPillFound: {
    backgroundColor: COLORS.softGreen,
    borderColor: COLORS.softGreen,
  },
  wordPillSpangram: {
    borderColor: COLORS.honeyGold,
    borderWidth: 2,
  },
  wordPillText: {
    fontSize: 9,
    color: COLORS.warmBrown,
    letterSpacing: 1,
  },
  wordPillTextFound: {
    color: COLORS.cream,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0,
  },
  gridContainer: {
    width: gridWidth,
    height: gridHeight,
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
    borderColor: COLORS.warmBrown,
  },
  cellSpangramBorder: {
    borderWidth: 2,
    borderColor: COLORS.honeyGold,
  },
  cellLetter: {
    fontSize: cellSize * 0.45,
    fontWeight: '700',
  },
  svgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: gridWidth,
    height: gridHeight,
  },
  bottomArea: {
    marginTop: 10,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedWord: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.darkBrown,
    letterSpacing: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: COLORS.warmBrown,
  },
  submitButton: {
    backgroundColor: COLORS.softGreen,
  },
  hintButton: {
    backgroundColor: COLORS.mutedRose,
  },
  hintButtonDisabled: {
    backgroundColor: '#C4C4C4',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.cream,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.cream,
  },
  hintButtonTextDisabled: {
    color: '#999',
  },
  spangramHint: {
    marginTop: 10,
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.warmBrown,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
