import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { CottageButton } from '@/components/common/CottageButton';
import { MapCanvas } from '@/components/map/MapCanvas';
import StonePairsGame from '@/minigames/stone-pairs/StonePairsGame';
import FireflyFlowGame from '@/minigames/firefly-flow/FireflyFlowGame';
import BloomSequenceGame from '@/minigames/bloom-sequence/BloomSequenceGame';
import LeafSortGame from '@/minigames/leaf-sort/LeafSortGame';
import { ALL_MINIGAMES } from '@/constants/minigames';
import { TUTORIAL_IMAGES } from '@/assets/tutorial/tutorialAssets';
import { TUTORIAL_LOCATION_PIXEL } from '@/constants/config';
import { useMapStore } from '@/store/useMapStore';
import type { MinigameResult } from '@/types/minigame';

// ─── Screen dimensions for overlay image sizing ───────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMG_ASPECT = 1920 / 1080;
const imgHeight = SCREEN_WIDTH * IMG_ASPECT;

// ─── Tutorial minigame pool ───────────────────────────────────────────────────

const TUTORIAL_GAME_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'stone-pairs':    StonePairsGame,
  'firefly-flow':   FireflyFlowGame,
  'bloom-sequence': BloomSequenceGame,
  'leaf-sort':      LeafSortGame,
};

const TUTORIAL_GAME_IDS = [
  'stone-pairs',
  'firefly-flow',
  'bloom-sequence',
  'leaf-sort',
] as const;

// ─── Phase types ──────────────────────────────────────────────────────────────

type MapPhase = 'map' | 'gamePreview' | 'minigame' | 'result';

// ─── Main Component ──────────────────────────────────────────────────────────

interface TutorialMapSceneProps {
  onComplete: () => void;
}

export default function TutorialMapScene({ onComplete }: TutorialMapSceneProps) {
  const [phase, setPhase] = useState<MapPhase>('map');
  const [gameResult, setGameResult] = useState<'win' | 'lose' | null>(null);

  const selectedGame = useMemo(() => {
    const id = TUTORIAL_GAME_IDS[Math.floor(Math.random() * TUTORIAL_GAME_IDS.length)];
    const info = ALL_MINIGAMES.find(m => m.minigameId === id)!;
    return {
      id,
      name: info.name,
      description: info.description,
      component: TUTORIAL_GAME_COMPONENTS[id],
    };
  }, []);

  // Pre-load map config so MapCanvas has something to render
  useEffect(() => {
    const { mapConfig, loadMapConfig } = useMapStore.getState();
    if (!mapConfig) {
      loadMapConfig().catch(() => {
        // Non-fatal — MapCanvas shows loading state if config is unavailable
      });
    }
  }, []);

  const handleTutorialPinPress = useCallback(() => {
    setPhase('gamePreview');
  }, []);

  const handleGameComplete = (result: MinigameResult) => {
    setGameResult(result.result === 'win' ? 'win' : 'lose');
    setPhase('result');
  };

  // ── Phase: map ──────────────────────────────────────────────────────────────

  if (phase === 'map') {
    return (
      <View style={styles.container}>
        <MapCanvas
          tutorialGlowPin={{ px: TUTORIAL_LOCATION_PIXEL.x, py: TUTORIAL_LOCATION_PIXEL.y }}
          tutorialPinPress={handleTutorialPinPress}
          playerX={TUTORIAL_LOCATION_PIXEL.x}
          playerY={TUTORIAL_LOCATION_PIXEL.y}
        />

        {/* s7 Moss overlay — transparent PNG, map shows through */}
        <View style={styles.s7Overlay} pointerEvents="none">
          <Image
            source={TUTORIAL_IMAGES.s7}
            style={styles.s7Image}
            resizeMode="contain"
          />
        </View>

        {/* Tutorial instruction label */}
        <View style={styles.mapInstructionRow}>
          <Text style={styles.mapInstructionText}>
            Tap the glowing pin to begin your challenge!
          </Text>
        </View>
      </View>
    );
  }

  // ── Phase: gamePreview ──────────────────────────────────────────────────────

  if (phase === 'gamePreview') {
    return (
      <TouchableWithoutFeedback onPress={() => setPhase('minigame')}>
        <View style={styles.gamePreviewBackdrop}>
          <View style={styles.gamePreviewCard}>
            <Text style={styles.gamePreviewTitle}>{selectedGame.name}</Text>
            <Text style={styles.gamePreviewSubtitle}>{selectedGame.description}</Text>
            <Text style={styles.gamePreviewHint}>Tap anywhere to begin</Text>
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  // ── Phase: minigame ─────────────────────────────────────────────────────────

  if (phase === 'minigame') {
    const MinigameComponent = selectedGame.component;
    return (
      <View style={styles.container}>
        <View style={styles.practiceBar}>
          <Text style={styles.practiceText}>Practice — no XP earned</Text>
        </View>
        <View style={styles.gameArea}>
          <MinigameComponent
            sessionId="tutorial-demo"
            timeLimit={120}
            onComplete={handleGameComplete}
            practiceMode
            isTutorial
          />
        </View>
      </View>
    );
  }

  // ── Phase: result ───────────────────────────────────────────────────────────

  const isWin = gameResult === 'win';

  return (
    <View style={styles.container}>
      <MapCanvas interactive={false} />
      <View style={styles.resultBackdrop}>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{isWin ? 'Well done!' : 'A fine attempt!'}</Text>
          <Text style={styles.resultBody}>
            {isWin
              ? 'Well done, grove walker! The challenge bows to you.'
              : 'The grove will teach you in time. No matter — the paths are open.'}
          </Text>
          <CottageButton
            title="Continue →"
            onPress={onComplete}
            style={styles.resultBtn}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Map phase — s7 overlay (explicit pixel dimensions required for transparent PNG)
  s7Overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: imgHeight,
    zIndex: 10,
  },
  s7Image: {
    width: '100%',
    height: '100%',
  },
  // Map phase — instruction label
  mapInstructionRow: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mapInstructionText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.cream,
    backgroundColor: 'rgba(61, 43, 31, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  // Game preview phase
  gamePreviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  gamePreviewCard: {
    backgroundColor: PALETTE.parchment,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  gamePreviewTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 28,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginBottom: 10,
  },
  gamePreviewSubtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 16,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  gamePreviewHint: {
    fontFamily: FONTS.bodyRegular,
    fontStyle: 'italic',
    fontSize: 14,
    color: PALETTE.warmGreyBrown,
    textAlign: 'center',
  },
  // Minigame phase
  practiceBar: {
    backgroundColor: PALETTE.stoneGrey,
    paddingVertical: 6,
    alignItems: 'center',
  },
  practiceText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: PALETTE.white,
  },
  gameArea: {
    flex: 1,
  },
  // Result phase
  resultBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  resultCard: {
    backgroundColor: PALETTE.parchmentBg,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PALETTE.honeyGold,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  resultTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 26,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginBottom: 12,
  },
  resultBody: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
    color: PALETTE.warmGreyBrown,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  resultBtn: {
    paddingHorizontal: 40,
  },
});
