import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  TouchableOpacity,
  ImageSourcePropType,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, CLAN_COLORS, CLAN_LABELS } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import { useMapStore } from '@/store/useMapStore';
import { useGameStore } from '@/store/useGameStore';
import { ClanId } from '@/types';

type Nav = NativeStackNavigationProp<MainModalParamList>;
type Route = RouteProp<MainModalParamList, 'CaptureCelebration'>;

const SPRITE_FRAME_COUNT = 9;
const SPRITE_FRAME_WIDTH = 222;
const SPRITE_FRAME_HEIGHT = 333;
const SPRITE_FRAME_DURATION = 100;

const CLAN_CRESTS: Record<ClanId, ImageSourcePropType> = {
  ember: require('../assets/sprites/crests/crest_wardens.png'),
  tide: require('../assets/sprites/crests/crest_chroniclers.png'),
  bloom: require('../assets/sprites/crests/crest_keepers.png'),
  gale: require('../assets/sprites/crests/crest_seekers.png'),
  hearth: require('../assets/sprites/crests/crest_guardians.png'),
};

const CREST_FALLBACK = CLAN_CRESTS.ember;

export default function CaptureCelebrationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { clan: winnerClan, spaceName } = route.params;
  const playerClan = useAuthStore((s) => s.clan);
  const loadCapturedSpaces = useMapStore((s) => s.loadCapturedSpaces);
  const setCaptureResult = useGameStore((s) => s.setCaptureResult);
  const clearCelebration = useGameStore((s) => s.clearCelebration);

  const isOwnClan = !!playerClan && playerClan === winnerClan;
  const clanColor = CLAN_COLORS[winnerClan as ClanId] ?? '#D4A843';
  const clanDisplayName = CLAN_LABELS[winnerClan] ?? winnerClan;
  const crestSource = CLAN_CRESTS[winnerClan as ClanId] ?? CREST_FALLBACK;

  // Spritesheet animation (only used when isOwnClan)
  const currentFrame = useRef<number>(0);
  const [displayFrame, setDisplayFrame] = useState<number>(0);

  useEffect(() => {
    if (!isOwnClan) return;

    const interval = setInterval(() => {
      currentFrame.current = (currentFrame.current + 1) % SPRITE_FRAME_COUNT;
      setDisplayFrame(currentFrame.current);
    }, SPRITE_FRAME_DURATION);


    return () => {
      clearInterval(interval);
    };
  }, [isOwnClan]);

  const dismiss = useCallback(() => {
    setCaptureResult(null);
    clearCelebration();
    loadCapturedSpaces();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, setCaptureResult, clearCelebration, loadCapturedSpaces]);

  return (
    <ImageBackground
      source={require('../assets/ui/backgrounds/bg_plain.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.content}>
        {isOwnClan && (
          <View style={styles.spriteScaleWrapper}>
            <View style={styles.spriteContainer}>
              <Image
                source={require('../assets/sprites/anim_capture.png')}
                style={[
                  styles.spriteSheet,
                  { transform: [{ translateX: -(displayFrame * SPRITE_FRAME_WIDTH) }] },
                ]}
                resizeMode="cover"
              />
            </View>
          </View>
        )}

        <Image
          source={crestSource}
          style={styles.crestImage}
          resizeMode="contain"
        />

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

        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: clanColor }]}
          onPress={dismiss}
        >
          <Text style={styles.continueButtonText}>
            {isOwnClan ? 'Continue' : 'Close'}
          </Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -80,
  },
  spriteScaleWrapper: {
    transform: [{ scale: 1.0 }],
    marginBottom: 12,
  },
  spriteContainer: {
    width: SPRITE_FRAME_WIDTH,
    height: SPRITE_FRAME_HEIGHT,
    overflow: 'hidden',
  },
  spriteSheet: {
    width: SPRITE_FRAME_WIDTH * SPRITE_FRAME_COUNT,
    height: SPRITE_FRAME_HEIGHT,
  },
  crestImage: {
    width: 84,
    height: 84,
    marginTop: 10,
    marginBottom: 20,
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
    color: PALETTE.darkBrown,
    letterSpacing: 1,
    marginVertical: 4,
  },
  spaceName: {
    fontSize: 24,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.honeyGold,
    textAlign: 'center',
    marginBottom: 16,
  },
  heroText: {
    fontSize: 28,
    fontFamily: FONTS.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 24,
  },
  mutedText: {
    fontSize: 18,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 24,
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 8,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
  },
});
