import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, CLAN_COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import { submitSpaceSentiment, submitLeave } from '@/api/game';
import { useGameStore } from '@/store/useGameStore';
import type { SpaceSentiment } from '@/types';

type Nav = NativeStackNavigationProp<MainModalParamList>;
type SentimentRoute = RouteProp<MainModalParamList, 'SpaceSentiment'>;

interface SentimentOption {
  value: SpaceSentiment;
  emoji: string;
  label: string;
}

const OPTIONS: SentimentOption[] = [
  { value: 'yes', emoji: '\u2705', label: 'Yes, definitely' },
  { value: 'maybe', emoji: '\uD83E\uDD14', label: 'Maybe' },
  { value: 'no', emoji: '\u274C', label: 'Probably not' },
];

export default function SpaceSentimentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<SentimentRoute>();
  const { sessionId, locationName } = route.params;
  const clan = useAuthStore((s) => s.clan);
  const clanColor = clan ? CLAN_COLORS[clan] : PALETTE.honeyGold;

  const [selected, setSelected] = useState<SpaceSentiment | null>(null);

  const fireLeave = useCallback(() => {
    const activeId = useGameStore.getState().activeLocationSessionId;
    if (activeId) {
      submitLeave(activeId, 'navigated_away');
      useGameStore.getState().clearActiveLocationSession();
    }
  }, []);

  const handleSelect = useCallback(
    (sentiment: SpaceSentiment) => {
      if (selected) return; // prevent double-tap
      setSelected(sentiment);
      submitSpaceSentiment(sessionId, sentiment); // fire-and-forget
      fireLeave();
      navigation.popToTop();
    },
    [selected, sessionId, navigation, fireLeave],
  );

  const handleSkip = useCallback(() => {
    if (selected) return;
    setSelected('no'); // lock to prevent double-tap
    fireLeave();
    navigation.popToTop();
  }, [selected, navigation, fireLeave]);

  return (
    <View style={styles.container}>
      {/* Question area */}
      <View style={styles.questionArea}>
        <Text style={styles.leafIcon}>{'\uD83C\uDF3F'}</Text>
        <Text style={styles.questionLine}>Would you come back to</Text>
        <Text style={[styles.locationName, { color: clanColor }]}>
          {locationName}
        </Text>
        <Text style={styles.questionLine}>without the game?</Text>
      </View>

      {/* Answer buttons */}
      <View style={styles.answersArea}>
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={({ pressed }) => [
              styles.answerBtn,
              { borderColor: clanColor },
              pressed && { backgroundColor: clanColor + '20' },
              selected === opt.value && { backgroundColor: clanColor },
            ]}
            onPress={() => handleSelect(opt.value)}
            disabled={selected !== null}
          >
            <Text style={styles.answerEmoji}>{opt.emoji}</Text>
            <Text
              style={[
                styles.answerLabel,
                selected === opt.value && styles.answerLabelSelected,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}

        <Pressable style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.parchmentBg,
    paddingHorizontal: 32,
  },
  questionArea: {
    flex: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leafIcon: {
    fontSize: 48,
    marginBottom: 20,
  },
  questionLine: {
    fontSize: 26,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    lineHeight: 34,
  },
  locationName: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    textAlign: 'center',
    lineHeight: 36,
  },
  answersArea: {
    flex: 5,
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 14,
    paddingBottom: 32,
  },
  answerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: PALETTE.cream,
    gap: 14,
    minHeight: 56,
  },
  answerEmoji: {
    fontSize: 22,
  },
  answerLabel: {
    fontSize: 17,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  answerLabelSelected: {
    color: '#FFFFFF',
  },
  skipBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  skipText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
  },
});
