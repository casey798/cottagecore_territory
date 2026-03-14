import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, CLAN_COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import { useMapStore } from '@/store/useMapStore';
import { useGameStore } from '@/store/useGameStore';
import { ClanId } from '@/types';

type Nav = NativeStackNavigationProp<MainModalParamList>;
type Route = RouteProp<MainModalParamList, 'CaptureCelebration'>;

const AUTO_DISMISS_MS = 5000;
const PARTICLE_COUNT = 20;

interface Particle {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  size: number;
  color: string;
}

function generateParticles(clanColor: string): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const startX = 150 + Math.random() * 100;
    const startY = 120 + Math.random() * 40;
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 120;
    particles.push({
      startX,
      startY,
      endX: startX + Math.cos(angle) * dist,
      endY: startY + Math.sin(angle) * dist,
      size: 3 + Math.random() * 5,
      color: i % 2 === 0 ? clanColor : '#FFD700',
    });
  }
  return particles;
}

export default function CaptureCelebrationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { clan: winnerClan, spaceName } = route.params;
  const playerClan = useAuthStore((s) => s.clan);
  const loadCapturedSpaces = useMapStore((s) => s.loadCapturedSpaces);
  const setCaptureResult = useGameStore((s) => s.setCaptureResult);
  const clearCelebration = useGameStore((s) => s.clearCelebration);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOwnClan = playerClan === winnerClan;
  const clanColor = CLAN_COLORS[winnerClan as ClanId] ?? '#D4A843';
  const clanDisplayName = winnerClan.charAt(0).toUpperCase() + winnerClan.slice(1);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [progress]);

  const particles = useRef(generateParticles(clanColor)).current;

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCaptureResult(null);
    clearCelebration();
    loadCapturedSpaces();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, setCaptureResult, clearCelebration, loadCapturedSpaces]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss]);

  return (
    <Pressable style={styles.container} onPress={dismiss}>
      <Canvas style={styles.sparkleCanvas}>
        <Group>
          {particles.map((p, i) => {
            const t = ((Date.now() / 1000 + i * 0.2) % 2) / 2;
            const x = p.startX + (p.endX - p.startX) * t;
            const y = p.startY + (p.endY - p.startY) * t;
            const opacity = 1 - t;
            return (
              <Circle
                key={i}
                cx={x}
                cy={y}
                r={p.size * opacity}
                color={p.color}
                opacity={opacity}
              />
            );
          })}
        </Group>
      </Canvas>

      <View style={styles.content}>
        <View style={[styles.bannerCircle, { backgroundColor: clanColor + '30', borderColor: clanColor }]}>
          <Text style={[styles.bannerEmoji]}>
            {winnerClan === 'ember' ? '🔥' : winnerClan === 'tide' ? '🌊' : winnerClan === 'bloom' ? '🌻' : winnerClan === 'hearth' ? '🏠' : '🍃'}
          </Text>
        </View>

        <Text style={[styles.clanName, { color: clanColor }]}>
          {clanDisplayName}
        </Text>

        <Text style={styles.capturedText}>has captured</Text>

        <Text style={styles.spaceName}>{spaceName}</Text>

        {isOwnClan ? (
          <Text style={[styles.heroText, { color: clanColor }]}>
            YOUR CLAN WINS!
          </Text>
        ) : (
          <Text style={styles.mutedText}>Better luck tomorrow!</Text>
        )}

        <Text style={styles.tapHint}>Tap anywhere to continue</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(30, 20, 10, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleCanvas: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  bannerCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  bannerEmoji: {
    fontSize: 40,
  },
  clanName: {
    fontSize: 36,
    fontFamily: FONTS.headerBold,
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
  capturedText: {
    fontSize: 16,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.cream,
    marginVertical: 4,
  },
  spaceName: {
    fontSize: 24,
    fontFamily: FONTS.headerBold,
    color: PALETTE.honeyGold,
    textAlign: 'center',
    marginBottom: 16,
  },
  heroText: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 24,
  },
  mutedText: {
    fontSize: 18,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
    marginBottom: 24,
  },
  tapHint: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey + '80',
    marginTop: 16,
  },
});
