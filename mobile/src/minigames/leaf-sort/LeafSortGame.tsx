import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Canvas,
  Circle,
  DashPathEffect,
  RoundedRect,
} from '@shopify/react-native-skia';
import Orientation from 'react-native-orientation-locker';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import {
  generatePuzzle,
  checkWin,
  canMove,
  applyMove,
  BEAD_HEX,
  BEAD_HIGHLIGHT,
  NUM_JARS,
  type Jars,
  type BeadColor,
} from './LeafSortLogic';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOP_ROW_COUNT = 3;
const BOTTOM_ROW_COUNT = 2;
const ROWS = 2;
const JAR_CAPACITY = 4;

const JAR_SPACING = 16;
const SIDE_PAD = 24;
const AVAILABLE_WIDTH = SCREEN_WIDTH - SIDE_PAD * 2;
const JAR_WIDTH = (AVAILABLE_WIDTH - JAR_SPACING * (TOP_ROW_COUNT - 1)) / TOP_ROW_COUNT;
const BEAD_RADIUS = Math.min(JAR_WIDTH * 0.28, 18);
const BEAD_SPACING = BEAD_RADIUS * 2 + 6;
const JAR_HEIGHT = BEAD_SPACING * JAR_CAPACITY + 16;
const JAR_ROW_GAP = 24;
const LIFTED_OFFSET = BEAD_RADIUS * 2 + 12;

const CANVAS_HEIGHT = ROWS * JAR_HEIGHT + JAR_ROW_GAP + LIFTED_OFFSET + 8;
const CANVAS_WIDTH = AVAILABLE_WIDTH;

const JAR_FILL_TARGET = '#FFF5DC';
const JAR_FILL_BUFFER = '#EDE6D6';
const JAR_STROKE_TARGET = '#8B6914';
const JAR_STROKE_BUFFER = '#A0937D';

interface MoveRecord {
  fromIndex: number;
  toIndex: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getJarPosition(index: number): { x: number; y: number } {
  const isTopRow = index < TOP_ROW_COUNT;
  const row = isTopRow ? 0 : 1;
  const col = isTopRow ? index : index - TOP_ROW_COUNT;
  const colCount = isTopRow ? TOP_ROW_COUNT : BOTTOM_ROW_COUNT;
  const rowWidth = colCount * JAR_WIDTH + (colCount - 1) * JAR_SPACING;
  const xOffset = (AVAILABLE_WIDTH - rowWidth) / 2;
  const x = xOffset + col * (JAR_WIDTH + JAR_SPACING);
  const y = LIFTED_OFFSET + row * (JAR_HEIGHT + JAR_ROW_GAP);
  return { x, y };
}

export default function LeafSortGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete } = props;

  const [jars, setJars] = useState<Jars>(() => generatePuzzle());
  const [selectedJar, setSelectedJar] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);

  useEffect(() => {
    Orientation.lockToPortrait();
    return () => {
      Orientation.unlockAllOrientations();
    };
  }, []);

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        finishGame('lose');
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, timeLimit]);

  const finishGame = useCallback(
    (result: 'win' | 'lose') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, result, timeTaken);

      const solutionData: Record<string, unknown> = {
        moves: moveHistory.length,
        solved: result === 'win',
      };

      pendingResultRef.current = { result, timeTaken, completionHash, solutionData };
      setOverlayResult(result);
      setShowCompleteOverlay(true);
    },
    [sessionId, moveHistory.length],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  const handleJarTap = useCallback(
    (index: number) => {
      if (gameOver) return;

      if (selectedJar === null) {
        if (jars[index].beads.length > 0) {
          setSelectedJar(index);
        }
        return;
      }

      if (selectedJar === index) {
        setSelectedJar(null);
        return;
      }

      if (canMove(jars, selectedJar, index)) {
        const newJars = applyMove(jars, selectedJar, index);
        const newHistory = [...moveHistory, { fromIndex: selectedJar, toIndex: index }];
        setJars(newJars);
        setMoveHistory(newHistory);
        setSelectedJar(null);

        if (checkWin(newJars)) {
          finishGame('win');
        }
      } else {
        setSelectedJar(null);
      }
    },
    [gameOver, selectedJar, jars, moveHistory, finishGame],
  );

  const handleUndo = useCallback(() => {
    if (gameOver || moveHistory.length === 0) return;
    const lastMove = moveHistory[moveHistory.length - 1];
    const newJars = applyMove(jars, lastMove.toIndex, lastMove.fromIndex);
    setJars(newJars);
    setMoveHistory(moveHistory.slice(0, -1));
    setSelectedJar(null);
  }, [gameOver, moveHistory, jars]);

  const timerFraction = timeLeft / timeLimit;
  const isTimeLow = timeLeft < 15;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={[styles.timerText, isTimeLow && styles.textDanger]}>
          {'\u23F1'} {formatTime(timeLeft)}
        </Text>
        <Text style={styles.movesText}>Moves: {moveHistory.length}</Text>
      </View>

      <View style={styles.timerBarBg}>
        <View
          style={[
            styles.timerBarFill,
            {
              width: `${timerFraction * 100}%`,
              backgroundColor:
                timerFraction > 0.25 ? PALETTE.softGreen : PALETTE.mutedRose,
            },
          ]}
        />
      </View>

      <View style={styles.canvasContainer}>
        <Canvas style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
          {Array.from({ length: NUM_JARS }).map((_, jarIndex) => {
            const jar = jars[jarIndex];
            const pos = getJarPosition(jarIndex);
            const isSelected = selectedJar === jarIndex;
            const isBuffer = jar.isBuffer;

            const fillColor = isBuffer ? JAR_FILL_BUFFER : JAR_FILL_TARGET;
            const strokeColor = isSelected
              ? PALETTE.honeyGold
              : isBuffer
                ? JAR_STROKE_BUFFER
                : JAR_STROKE_TARGET;

            return (
              <React.Fragment key={jarIndex}>
                <RoundedRect
                  x={pos.x + 2}
                  y={pos.y + 2}
                  width={JAR_WIDTH - 4}
                  height={JAR_HEIGHT - 4}
                  r={10}
                  color={fillColor}
                  opacity={isBuffer ? 0.55 : 0.85}
                />
                <RoundedRect
                  x={pos.x + 2}
                  y={pos.y + 2}
                  width={JAR_WIDTH - 4}
                  height={JAR_HEIGHT - 4}
                  r={10}
                  color={strokeColor}
                  style="stroke"
                  strokeWidth={isSelected ? 3 : 2}
                >
                  {isBuffer && !isSelected && (
                    <DashPathEffect intervals={[8, 6]} />
                  )}
                </RoundedRect>

                {jar.beads.map((beadColor, beadIndex) => {
                  const isTopBead = beadIndex === jar.beads.length - 1;
                  const isLifted = isSelected && isTopBead;

                  const beadX = pos.x + JAR_WIDTH / 2;
                  const beadBaseY =
                    pos.y + JAR_HEIGHT - 12 - beadIndex * BEAD_SPACING - BEAD_RADIUS;
                  const beadY = isLifted ? pos.y - LIFTED_OFFSET + BEAD_RADIUS : beadBaseY;

                  return (
                    <React.Fragment key={beadIndex}>
                      <Circle
                        cx={beadX}
                        cy={beadY}
                        r={BEAD_RADIUS}
                        color={BEAD_HEX[beadColor]}
                      />
                      <Circle
                        cx={beadX - BEAD_RADIUS * 0.3}
                        cy={beadY - BEAD_RADIUS * 0.3}
                        r={BEAD_RADIUS * 0.35}
                        color={BEAD_HIGHLIGHT[beadColor]}
                        opacity={0.6}
                      />
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </Canvas>

        {Array.from({ length: NUM_JARS }).map((_, jarIndex) => {
          const pos = getJarPosition(jarIndex);
          return (
            <TouchableOpacity
              key={jarIndex}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y - LIFTED_OFFSET,
                width: JAR_WIDTH,
                height: JAR_HEIGHT + LIFTED_OFFSET,
              }}
              onPress={() => handleJarTap(jarIndex)}
              disabled={gameOver}
              activeOpacity={0.7}
            />
          );
        })}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.undoBtn, (gameOver || moveHistory.length === 0) && styles.undoBtnDisabled]}
          onPress={handleUndo}
          disabled={gameOver || moveHistory.length === 0}
          activeOpacity={0.7}
        >
          <Text style={[styles.undoBtnText, (gameOver || moveHistory.length === 0) && styles.undoBtnTextDisabled]}>
            Undo
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.instruction}>Tap a jar to pick up, then tap another to place</Text>

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
  root: {
    flex: 1,
    backgroundColor: UI.background,
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
  },
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: UI.text,
  },
  movesText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: UI.text,
  },
  textDanger: {
    color: '#C0392B',
  },

  timerBarBg: {
    width: '90%',
    height: 6,
    backgroundColor: '#D5C9B1',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  canvasContainer: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },

  bottomBar: {
    marginTop: 12,
    alignItems: 'center',
  },
  undoBtn: {
    backgroundColor: PALETTE.warmBrown,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
    borderBottomWidth: 3,
    borderBottomColor: PALETTE.darkBrown,
  },
  undoBtnDisabled: {
    opacity: 0.4,
  },
  undoBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.cream,
  },
  undoBtnTextDisabled: {
    color: PALETTE.cream,
  },

  instruction: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.stoneGrey,
    marginTop: 16,
    textAlign: 'center',
  },
});
