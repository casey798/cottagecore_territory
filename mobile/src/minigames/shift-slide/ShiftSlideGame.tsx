import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Canvas,
  Group,
  Image as SkiaImage,
  Rect,
  RoundedRect,
  useImage,
  rect,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { generateClientCompletionHash } from '@/utils/hmac';
import { GameCompleteOverlay } from '@/components/minigames/GameCompleteOverlay';
import type { MinigamePlayProps, MinigameResult } from '@/types/minigame';
import {
  createSolvedBoard,
  scrambleBoard,
  getValidMoves,
  applyMove,
  isSolved,
  tileSrcRect,
  tileDestRect,
  type Board,
} from './ShiftSlideLogic';
import { getImageById } from './imageList';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOARD_PADDING = 16;
const CELL_SIZE = (SCREEN_WIDTH - BOARD_PADDING * 2) / 3;
const BOARD_SIZE = CELL_SIZE * 3;

// Cottagecore fallback palette for placeholder tiles (8 tiles)
const PLACEHOLDER_COLORS = [
  PALETTE.softGreen,
  PALETTE.honeyGold,
  PALETTE.mutedRose,
  PALETTE.softBlue,
  PALETTE.warmBrown,
  PALETTE.deepGreen,
  PALETTE.amberLight,
  PALETTE.stoneGrey,
];

const EMPTY_SLOT_COLOR = 'rgba(61, 43, 31, 0.4)';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ShiftSlideGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, puzzleData } = props;

  const imageId = (puzzleData?.imageId as string) || 'fox-face';
  const scrambleSeed = (puzzleData?.scrambleSeed as number) || 42;

  const imageEntry = getImageById(imageId);
  const skiaImage = useImage(imageEntry ? imageEntry.source : null);

  const [board, setBoard] = useState<Board>(() => {
    const solved = createSolvedBoard();
    return scrambleBoard(solved, 150, scrambleSeed);
  });
  const [moveCount, setMoveCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [gameOver, setGameOver] = useState(false);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [overlayResult, setOverlayResult] = useState<'win' | 'lose'>('lose');
  const [showInstruction, setShowInstruction] = useState(true);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);

  // Hide instruction after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowInstruction(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Timer
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
        finalBoard: board,
        moveCount,
        imageId,
        solved: result === 'win',
      };

      pendingResultRef.current = { result, timeTaken, completionHash, solutionData };
      setOverlayResult(result);
      setShowCompleteOverlay(true);
    },
    [sessionId, board, moveCount, imageId],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onComplete(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, [onComplete]);

  const handleTap = useCallback(
    (boardIndex: number) => {
      if (gameOver) return;

      const validMoves = getValidMoves(board);
      if (!validMoves.includes(boardIndex)) return;

      const newBoard = applyMove(board, boardIndex);
      const newMoveCount = moveCount + 1;
      setBoard(newBoard);
      setMoveCount(newMoveCount);

      if (isSolved(newBoard)) {
        // Small delay so the player sees the completed image
        setTimeout(() => finishGame('win'), 300);
      }
    },
    [gameOver, board, moveCount, finishGame],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((e) => {
        'worklet';
        const col = Math.floor(e.x / CELL_SIZE);
        const row = Math.floor(e.y / CELL_SIZE);
        if (col < 0 || col >= 3 || row < 0 || row >= 3) return;
        const idx = row * 3 + col;
        runOnJS(handleTap)(idx);
      }),
    [handleTap],
  );

  const isTimeLow = timeLeft < 10;

  const imageWidth = skiaImage?.width() ?? 0;
  const imageHeight = skiaImage?.height() ?? 0;

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={[styles.timerText, isTimeLow && styles.textDanger]}>
          {'\u23F1'} {formatTime(timeLeft)}
        </Text>
        <Text style={styles.movesText}>Moves: {moveCount}</Text>
      </View>

      {/* Board */}
      <View style={styles.boardWrapper}>
        <GestureDetector gesture={tapGesture}>
          <Canvas style={styles.canvas}>
            {board.map((tileValue, boardIndex) => {
              const dest = tileDestRect(boardIndex, CELL_SIZE);

              if (tileValue === 8) {
                // Empty slot
                return (
                  <RoundedRect
                    key={boardIndex}
                    x={dest.x}
                    y={dest.y}
                    width={dest.width}
                    height={dest.height}
                    r={4}
                    color={EMPTY_SLOT_COLOR}
                  />
                );
              }

              if (skiaImage && imageWidth > 0 && imageHeight > 0) {
                // Render image tile using Group clip + offset image
                const src = tileSrcRect(tileValue, imageWidth, imageHeight);
                // Scale factor from source image to board
                const scaleX = BOARD_SIZE / imageWidth;
                const scaleY = BOARD_SIZE / imageHeight;
                // Offset so the correct tile region aligns with the clip rect
                const imgX = dest.x - src.x * scaleX;
                const imgY = dest.y - src.y * scaleY;
                return (
                  <React.Fragment key={boardIndex}>
                    <Group
                      clip={rect(dest.x, dest.y, dest.width, dest.height)}
                    >
                      <SkiaImage
                        image={skiaImage}
                        x={imgX}
                        y={imgY}
                        width={imageWidth * scaleX}
                        height={imageHeight * scaleY}
                        fit="fill"
                      />
                    </Group>
                    <Rect
                      x={dest.x}
                      y={dest.y}
                      width={dest.width}
                      height={dest.height}
                      color={PALETTE.darkBrown}
                      style="stroke"
                      strokeWidth={1}
                    />
                  </React.Fragment>
                );
              }

              // Placeholder tile (no image loaded)
              const bgColor = PLACEHOLDER_COLORS[tileValue % PLACEHOLDER_COLORS.length];
              return (
                <React.Fragment key={boardIndex}>
                  <RoundedRect
                    x={dest.x}
                    y={dest.y}
                    width={dest.width}
                    height={dest.height}
                    r={4}
                    color={bgColor}
                  />
                  <Rect
                    x={dest.x}
                    y={dest.y}
                    width={dest.width}
                    height={dest.height}
                    color={PALETTE.darkBrown}
                    style="stroke"
                    strokeWidth={1}
                  />
                </React.Fragment>
              );
            })}
          </Canvas>
        </GestureDetector>
      </View>

      {/* Instruction */}
      {showInstruction && (
        <Text style={styles.instruction}>Slide tiles to restore the image</Text>
      )}

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
    marginBottom: 16,
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
    color: PALETTE.errorRed,
  },
  boardWrapper: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
  },
  canvas: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
  },
  instruction: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.stoneGrey,
    marginTop: 24,
  },
});
