import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  ImageBackground,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
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

const SCREEN_WIDTH = Dimensions.get('window').width;
const BOARD_SIZE = Math.floor(SCREEN_WIDTH * 0.8);
const CELL_SIZE = BOARD_SIZE / 3;

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

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

export default function ShiftSlideGame(props: MinigamePlayProps) {
  const { sessionId, timeLimit, onComplete, puzzleData, practiceMode } = props;

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
  const [isHowToPlayVisible, setIsHowToPlayVisible] = useState(false);

  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const pendingResultRef = useRef<MinigameResult | null>(null);
  const isPausedRef = useRef(false);
  const pauseStartRef = useRef(0);

  // Store onComplete in a ref so callbacks always use the latest version
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Hide instruction after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowInstruction(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const gameDuration = timeLimit > 0 ? timeLimit : 120;

  // Timer — elapsed from startTimeRef, respects isPausedRef
  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, gameDuration - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        finishGame('timeout');
      }
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, gameDuration]);

  const finishGame = useCallback(
    (outcome: 'win' | 'lose' | 'timeout') => {
      if (completedRef.current) return;
      completedRef.current = true;
      setGameOver(true);

      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const completionHash = generateClientCompletionHash(sessionId, outcome, timeTaken);

      const solutionData: Record<string, unknown> = {
        finalBoard: board,
        moveCount,
        imageId,
        solved: outcome === 'win',
      };

      pendingResultRef.current = { result: outcome, timeTaken, completionHash, solutionData };
      // Timeout shows as 'lose' in the overlay (same as NumberGroveGame)
      setOverlayResult(outcome === 'win' ? 'win' : 'lose');
      setShowCompleteOverlay(true);
    },
    [sessionId, board, moveCount, imageId],
  );

  const handleContinue = useCallback(() => {
    if (pendingResultRef.current) {
      onCompleteRef.current(pendingResultRef.current);
      pendingResultRef.current = null;
    }
  }, []);

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

  // ── How to Play ──────────────────────────────────────────────────────

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

  const timerFraction = timeLeft / gameDuration;

  const imageWidth = skiaImage?.width() ?? 0;
  const imageHeight = skiaImage?.height() ?? 0;

  return (
    <ImageBackground source={plainBg} style={styles.root} resizeMode="cover">
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.movesText}>Moves: {moveCount}</Text>
        <TouchableOpacity style={styles.helpBtn} onPress={openHowToPlay}>
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
          xpEarned={overlayResult === 'win' ? 25 : 0}
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
            <Text style={styles.modalTitle}>How to Play {'\u2014'} Tile Slide</Text>
            <Text style={styles.modalRule}>
              {'\u2022'} A picture has been scrambled into tiles on a 3{'\u00D7'}3 grid, with one tile missing.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Tap any tile next to the empty space to slide it in.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Keep sliding tiles until the picture is restored.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} The empty space is always the bottom-right corner in the solved position.
            </Text>
            <Text style={styles.modalRule}>
              {'\u2022'} Plan your moves {'\u2014'} you have limited time!
            </Text>
            <Text style={styles.modalTip}>
              Tip: Work on one row at a time. Get the top row right first, then the middle.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
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
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  movesText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: UI.text,
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
  timerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: UI.text,
    marginBottom: 16,
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
