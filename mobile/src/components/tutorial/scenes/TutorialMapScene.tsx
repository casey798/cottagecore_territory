import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  Text,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { CottageButton } from '@/components/common/CottageButton';
import { MapCanvas } from '@/components/map/MapCanvas';
import { MapPin } from '@/components/map/MapPin';
import GroveWordsGame from '@/minigames/grove-words/GroveWordsGame';
import { TUTORIAL_IMAGES } from '@/assets/tutorial/tutorialAssets';
import { useMapStore } from '@/store/useMapStore';
import type { Location } from '@/types';
import type { MinigameResult } from '@/types/minigame';

// ─── Tutorial pin fake location ───────────────────────────────────────────────

const TUTORIAL_FAKE_LOCATION: Location = {
  locationId: 'tutorial-location',
  name: 'The Grove',
  gpsLat: 0,
  gpsLng: 0,
  geofenceRadius: 0,
  category: 'other',
  locked: false,
};

// ─── Phase types ──────────────────────────────────────────────────────────────

type MapPhase = 'intro' | 'map' | 'minigame' | 'result';

// ─── PulsePin ─────────────────────────────────────────────────────────────────

function PulseRing({ scale, opacity }: { scale: Animated.Value; opacity: Animated.Value }) {
  return (
    <Animated.View
      style={[
        styles.pulseRing,
        { transform: [{ scale }], opacity },
      ]}
    />
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface TutorialMapSceneProps {
  onComplete: () => void;
}

export default function TutorialMapScene({ onComplete }: TutorialMapSceneProps) {
  const [phase, setPhase] = useState<MapPhase>('intro');
  const [gameResult, setGameResult] = useState<'win' | 'lose' | null>(null);

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Pin position: horizontal center, upper-center of screen
  const pinX = screenWidth / 2;
  const pinY = screenHeight * 0.38;

  // Pulse animation for the map pin
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (phase !== 'map') return;

    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.7,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.7,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulseScale, pulseOpacity]);

  // Pre-load map config so MapCanvas has something to render
  useEffect(() => {
    const { mapConfig, loadMapConfig } = useMapStore.getState();
    if (!mapConfig) {
      loadMapConfig().catch(() => {
        // Non-fatal — MapCanvas shows loading state if config is unavailable
      });
    }
  }, []);

  const handleGameComplete = (result: MinigameResult) => {
    setGameResult(result.result === 'win' ? 'win' : 'lose');
    setPhase('result');
  };

  // ── Phase: intro ────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <MapCanvas />
        <Image
          source={TUTORIAL_IMAGES.s7}
          style={styles.overlayImageBottom}
          resizeMode="contain"
          pointerEvents="none"
        />
        <View style={styles.introButtonRow}>
          <CottageButton
            title="Next →"
            onPress={() => setPhase('map')}
            style={styles.overlayBtn}
          />
        </View>
      </View>
    );
  }

  // ── Phase: map ──────────────────────────────────────────────────────────────

  if (phase === 'map') {
    return (
      <View style={styles.container}>
        <MapCanvas />

        {/* Tutorial instruction label */}
        <View style={styles.mapInstructionRow}>
          <Text style={styles.mapInstructionText}>
            Tap the glowing pin to begin your challenge!
          </Text>
        </View>

        {/* Pulsing ring behind the pin */}
        <View
          pointerEvents="none"
          style={[
            styles.pulseContainer,
            { left: pinX - 24, top: pinY - 24 },
          ]}
        >
          <PulseRing scale={pulseScale} opacity={pulseOpacity} />
        </View>

        {/* The actual MapPin */}
        <MapPin
          location={TUTORIAL_FAKE_LOCATION}
          pixelX={pinX}
          pixelY={pinY}
          onPress={() => setPhase('minigame')}
          inRange
        />
      </View>
    );
  }

  // ── Phase: minigame ─────────────────────────────────────────────────────────

  if (phase === 'minigame') {
    return (
      <View style={styles.container}>
        <View style={styles.practiceBar}>
          <Text style={styles.practiceText}>Practice — no XP earned</Text>
        </View>
        <View style={styles.gameArea}>
          <GroveWordsGame
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
      <MapCanvas />
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

const { height: SCREEN_H } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Intro phase
  overlayImageBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: SCREEN_H * 0.5,
  },
  introButtonRow: {
    position: 'absolute',
    bottom: SCREEN_H * 0.5 + 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  overlayBtn: {
    paddingHorizontal: 40,
  },
  // Map phase
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
  pulseContainer: {
    position: 'absolute',
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: PALETTE.honeyGold,
    backgroundColor: 'transparent',
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
