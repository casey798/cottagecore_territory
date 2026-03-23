import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  ImageBackground,
  Modal,
  Pressable,
} from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
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

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

// Per-word connector colors mapped to nearest PALETTE constants
const WORD_COLORS = [
  PALETTE.mutedRose,   // closest PALETTE match to #E07A5F (terracotta)
  PALETTE.softGreen,   // closest PALETTE match to #3D9970 (emerald)
  PALETTE.softBlue,    // closest PALETTE match to #7B6CF6 (lavender — no purple in PALETTE)
  PALETTE.amberLight,  // closest PALETTE match to #F4A261 (sandy orange)
  PALETTE.playerBlue,  // closest PALETTE match to #2196F3 (sky blue)
  PALETTE.errorRed,    // closest PALETTE match to #E91E8C (rose)
  PALETTE.deepGreen,   // closest PALETTE match to #81B29A (sage)
];

const ALT_FLASH_COLOR = PALETTE.softGreen; // closest PALETTE match to #A0D080

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

export default function VineTrailGame({ sessionId, timeLimit, onComplete, practiceMode }: MinigamePlayProps) {
  const [pack] = useState(() => {
    const idx = Math.floor(Math.random() * vineTrailPacks.length);
    return vineTrailPacks[idx];
  });
  const [state, setState] = useState<VineTrailState>(() => initGame(pack));

  // Assign each word a connector color: spangram always gets index 0
  const wordColorMap = useMemo(() => {
    const map = new Map<number, string>();
    let colorIdx = 1; // start at 1 since 0 is reserved for spangram
    state.words.forEach((w, i) => {
      if (w.isSpangram) {
        map.set(i, WORD_COLORS[0]);
      } else {
        map.set(i, WORD_COLORS[colorIdx % WORD_COLORS.length]);
        colorIdx++;
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [flashColor, setFlashColor] = useState<string>(PALETTE.softGreen);
  const [fadingPath, setFadingPath] = useState<CellCoord[] | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const gameOverHandled = useRef(false);
  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');

  // How to Play state + pause refs
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);

  // setTimeout refs for cleanup
  const winDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alreadyFoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (isPausedRef.current) return;
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
      winDelayRef.current = setTimeout(() => {
        winDelayRef.current = null;
        finishGame('win');
      }, 1000);
    } else {
      finishGame('timeout');
    }
  }, [state.gameOver, state.won, finishGame]);

  // Cleanup all setTimeout refs on unmount
  useEffect(() => {
    return () => {
      if (winDelayRef.current !== null) {
        clearTimeout(winDelayRef.current);
        winDelayRef.current = null;
      }
      if (flashTimerRef.current !== null) {
        clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
      if (alreadyFoundTimerRef.current !== null) {
        clearTimeout(alreadyFoundTimerRef.current);
        alreadyFoundTimerRef.current = null;
      }
    };
  }, []);

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

  // How to Play callbacks
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
          setFlashColor(ALT_FLASH_COLOR);
          setFlashCells(flashSet);
          flashTimerRef.current = setTimeout(() => {
            flashTimerRef.current = null;
            setFlashCells(new Set());
            setFlashColor(PALETTE.softGreen);
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
        setFlashColor(PALETTE.honeyGold);
        setFlashCells(flashSet);
        alreadyFoundTimerRef.current = setTimeout(() => {
          alreadyFoundTimerRef.current = null;
          setFlashCells(new Set());
        }, 400);
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

  // Determine connector color based on which word the current path might be building
  const activeConnectorColor = useMemo(() => {
    if (state.selectedPath.length === 0) return PALETTE.stoneGrey;
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
      if (match) return wordColorMap.get(wi) ?? PALETTE.stoneGrey;
    }
    return PALETTE.stoneGrey;
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
        let bg: string = PALETTE.parchmentBg;
        let letterColor: string = PALETTE.darkBrown;
        let border = false;

        if (flashCells.has(key)) {
          bg = flashColor;
          letterColor = PALETTE.cream;
        } else if (foundCells.has(key)) {
          if (spangramCells.has(key)) {
            bg = PALETTE.honeyGold;
            letterColor = PALETTE.cream;
            border = true;
          } else {
            bg = PALETTE.softGreen;
            letterColor = PALETTE.cream;
          }
        } else if (selectedSet.has(key)) {
          bg = blendColorOver(PALETTE.parchmentBg, activeConnectorColor, 0.3);
          letterColor = PALETTE.darkBrown;
        } else if (hintSet.has(key)) {
          bg = PALETTE.mutedRose;
          letterColor = PALETTE.cream;
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
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.timerText}>{formatTime(state.timeElapsed, timeLimit)}</Text>
        <Text style={styles.themeText}>{state.pack.theme}</Text>
        <Text style={styles.countText}>{foundCount} / {totalCount}</Text>
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
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
      <View style={styles.gridContainer}>
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
                    stroke={PALETTE.honeyGold}
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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Word Hunt</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} You are given a grid of letters and a list of hidden words to find.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap letters one at a time to build a path spelling out a hidden word.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Each letter must be adjacent to the previous one {'\u2014'} including diagonals.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap Submit when you have spelled a word, or Clear to start over.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Every letter in the grid belongs to exactly one word {'\u2014'} no letter is wasted.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} One special word (the theme word) is highlighted in gold when found.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Find all the words before time runs out to win.
            </Text>
            <Text style={styles.modalTip}>
              Tip: The theme word usually connects two edges of the grid. Start by looking for the longest path.
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    fontFamily: FONTS.bodySemiBold,
    fontSize: 20,
    color: PALETTE.darkBrown,
    fontVariant: ['tabular-nums'],
  },
  themeText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.warmBrown,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  countText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: PALETTE.darkBrown,
  },
  helpBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.parchmentDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  helpBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: PALETTE.darkBrown,
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
    borderColor: PALETTE.warmBrown,
  },
  cellSpangramBorder: {
    borderWidth: 2,
    borderColor: PALETTE.honeyGold,
  },
  cellLetter: {
    fontSize: cellSize * 0.45,
    fontFamily: FONTS.bodyBold,
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
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    color: PALETTE.darkBrown,
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
    backgroundColor: PALETTE.warmBrown,
  },
  submitButton: {
    backgroundColor: PALETTE.softGreen,
  },
  hintButton: {
    backgroundColor: PALETTE.mutedRose,
  },
  hintButtonDisabled: {
    backgroundColor: PALETTE.parchmentLight,
  },
  buttonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: PALETTE.cream,
  },
  submitButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: PALETTE.cream,
  },
  hintButtonTextDisabled: {
    color: PALETTE.stoneGrey,
  },
  spangramHint: {
    fontFamily: FONTS.bodyRegular,
    marginTop: 10,
    fontSize: 13,
    fontStyle: 'italic',
    color: PALETTE.warmBrown,
    textAlign: 'center',
    paddingHorizontal: 20,
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
