import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Text,
  Image,
  ImageBackground,
  StyleSheet,
  Animated,
  BackHandler,
  Vibration,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, CLAN_COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import { submitSpaceSentiment, submitLeave } from '@/api/game';
import { useGameStore } from '@/store/useGameStore';
import { CottageButton } from '@/components/common/CottageButton';
import type { SpaceSentiment } from '@/types';

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');
const leafSprite = require('@/assets/ui/icons/spinner_leaf.png');

type Nav = NativeStackNavigationProp<MainModalParamList>;
type SentimentRoute = RouteProp<MainModalParamList, 'SpaceSentiment'>;

interface SentimentOption {
  value: SpaceSentiment;
  label: string;
}

const OPTIONS: SentimentOption[] = [
  { value: 'yes', label: 'Yes, definitely' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'Probably not' },
];

export default function SpaceSentimentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<SentimentRoute>();
  const { sessionId, locationId: _locationId, locationName } = route.params;
  const clan = useAuthStore((s) => s.clan);
  const clanColor = clan ? CLAN_COLORS[clan] : PALETTE.honeyGold;

  const [selected, setSelected] = useState<SpaceSentiment | null>(null);
  const skipGuard = useRef(false);
  const leaveFiredRef = useRef(false);

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Per-button scale animations
  const scaleAnims = useRef(
    OPTIONS.map(() => new Animated.Value(1)),
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fireLeave = useCallback(() => {
    if (leaveFiredRef.current) return;
    leaveFiredRef.current = true;
    const activeId = useGameStore.getState().activeLocationSessionId;
    if (activeId) {
      submitLeave(activeId, 'navigated_away');
      useGameStore.getState().clearActiveLocationSession();
    }
  }, []);

  // Android hardware back button guard
  useEffect(() => {
    const handler = () => {
      fireLeave();
      navigation.popToTop();
      return true;
    };
    BackHandler.addEventListener('hardwareBackPress', handler);
    return () => BackHandler.removeEventListener('hardwareBackPress', handler);
  }, [fireLeave, navigation]);

  // beforeRemove guard — fires on any navigation away
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (selected === null) {
        fireLeave();
      }
    });
    return unsubscribe;
  }, [navigation, selected, fireLeave]);

  const handleSelect = useCallback(
    (sentiment: SpaceSentiment, index: number) => {
      if (selected || skipGuard.current) return;
      setSelected(sentiment);
      submitSpaceSentiment(sessionId, sentiment); // fire-and-forget

      // Selection feedback
      Vibration.vibrate(40);
      Animated.sequence([
        Animated.spring(scaleAnims[index], {
          toValue: 1.06,
          friction: 3,
          tension: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnims[index], {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start(() => {
        fireLeave();
        navigation.popToTop();
      });
    },
    [selected, sessionId, navigation, fireLeave, scaleAnims],
  );

  const handleSkip = useCallback(() => {
    if (skipGuard.current || selected) return;
    skipGuard.current = true;
    fireLeave();
    navigation.popToTop();
  }, [selected, navigation, fireLeave]);

  return (
    <ImageBackground source={plainBg} style={styles.container} resizeMode="cover">
      {/* Question area */}
      <Animated.View
        style={[
          styles.questionArea,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Image source={leafSprite} style={styles.leafIcon} resizeMode="contain" />
        <Text style={styles.questionText}>
          Would you come back to{' '}
          <Text style={[styles.locationNameInline, { color: clanColor }]}>
            {locationName}
          </Text>
          {' '}without the game?
        </Text>
      </Animated.View>

      {/* Answer buttons */}
      <Animated.View
        style={[
          styles.answersArea,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {OPTIONS.map((opt, index) => (
          <Animated.View
            key={opt.value}
            style={{ transform: [{ scale: scaleAnims[index] }] }}
          >
            <CottageButton
              variant="choice"
              title={opt.label}
              onPress={() => handleSelect(opt.value, index)}
              disabled={selected !== null}
              selected={selected === opt.value}
              accentColor={clanColor}
            />
          </Animated.View>
        ))}

        <CottageButton
          variant="secondary"
          title="Skip"
          onPress={handleSkip}
          style={styles.skipBtn}
        />
      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
  },
  questionArea: {
    flex: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leafIcon: {
    width: 48,
    height: 48,
    marginBottom: 20,
  },
  questionText: {
    fontSize: 26,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    lineHeight: 34,
  },
  locationNameInline: {
    fontFamily: FONTS.headerBold,
  },
  answersArea: {
    flex: 5,
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 14,
    paddingBottom: 32,
  },
  skipBtn: {
    alignSelf: 'center',
    marginTop: 4,
    borderWidth: 0,
  },
});
