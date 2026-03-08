import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useCountdown } from '@/hooks/useCountdown';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { generateCompletionHash } from '@/utils/hmac';
import * as gameApi from '@/api/game';
import { GameResult } from '@/types';

type Nav = NativeStackNavigationProp<MainModalParamList>;
type PlayRoute = RouteProp<MainModalParamList, 'MinigamePlay'>;

const MINIGAME_NAMES: Record<string, string> = {
  'grove-words': 'Grove Words',
  'kindred': 'Kindred',
  'pips': 'Pips',
  'vine-trail': 'Vine Trail',
  'mosaic': 'Mosaic',
  'crossvine': 'Crossvine',
  'number-grove': 'Number Grove',
  'stone-pairs': 'Stone Pairs',
  'potion-logic': 'Potion Logic',
  'leaf-sort': 'Leaf Sort',
  'cipher-stones': 'Cipher Stones',
  'path-weaver': 'Path Weaver',
};

interface MinigameCompleteData {
  result: 'win' | 'lose';
  solutionData: Record<string, unknown>;
}

function MinigamePlaceholder({
  minigameId,
  onComplete,
}: {
  minigameId: string;
  onComplete: (data: MinigameCompleteData) => void;
}) {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.name}>
        {MINIGAME_NAMES[minigameId] || minigameId}
      </Text>
      <Text style={placeholderStyles.coming}>Coming soon</Text>
      <View style={placeholderStyles.buttons}>
        <TouchableOpacity
          style={[placeholderStyles.btn, placeholderStyles.btnWin]}
          onPress={() => onComplete({ result: 'win', solutionData: {} })}
        >
          <Text style={placeholderStyles.btnText}>Simulate Win</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[placeholderStyles.btn, placeholderStyles.btnLose]}
          onPress={() => onComplete({ result: 'lose', solutionData: {} })}
        >
          <Text style={placeholderStyles.btnText}>Simulate Lose</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const placeholderStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 8,
  },
  coming: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 32,
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
  },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnWin: {
    backgroundColor: PALETTE.softGreen,
  },
  btnLose: {
    backgroundColor: PALETTE.mutedRose,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
});

export default function MinigamePlayScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<PlayRoute>();
  const { sessionId, minigameId, timeLimit } = route.params;
  const userId = useAuthStore((s) => s.userId) || '';
  const todayXp = useGameStore((s) => s.todayXp);
  const recordWin = useGameStore((s) => s.recordWin);
  const setCooldown = useGameStore((s) => s.setCooldown);
  const [submitting, setSubmitting] = useState(false);
  const hasCompletedRef = useRef(false);

  const timerEnd = useRef(new Date(Date.now() + timeLimit * 1000)).current;
  const countdown = useCountdown(timerEnd);

  const handleComplete = useCallback(
    async (data: MinigameCompleteData) => {
      if (hasCompletedRef.current || submitting) return;
      hasCompletedRef.current = true;
      setSubmitting(true);

      // If timer expired, force lose
      const finalResult: GameResult = countdown.isExpired ? 'lose' : data.result;

      const completionHash = generateCompletionHash(
        sessionId,
        userId,
        finalResult,
        sessionId, // salt — server stores _salt on session
      );

      try {
        const result = await gameApi.completeMinigame(
          sessionId,
          finalResult,
          completionHash,
          data.solutionData,
        );

        if (result.success && result.data) {
          if (result.data.result === 'win') {
            recordWin();
            if (result.data.cooldownEndsAt) {
              setCooldown(result.data.cooldownEndsAt);
            }
          }
          navigation.replace('Result', {
            result: result.data.result === 'win' ? 'win' : 'lose',
            xpEarned: result.data.xpEarned,
            newTodayXp: result.data.newTodayXp,
            clanTodayXp: result.data.clanTodayXp,
            chestDrop: result.data.chestDrop,
            cooldownEndsAt: result.data.cooldownEndsAt,
            locationLocked: result.data.locationLocked,
          });
        } else {
          Alert.alert('Error', result.error?.message || 'Failed to submit result.');
          hasCompletedRef.current = false;
          setSubmitting(false);
        }
      } catch {
        Alert.alert('Error', 'Network error. Please try again.');
        hasCompletedRef.current = false;
        setSubmitting(false);
      }
    },
    [sessionId, userId, countdown.isExpired, submitting, navigation, recordWin, setCooldown],
  );

  // Auto-lose on timer expiry
  React.useEffect(() => {
    if (countdown.isExpired && !hasCompletedRef.current) {
      handleComplete({ result: 'lose', solutionData: {} });
    }
  }, [countdown.isExpired, handleComplete]);

  const gameName = MINIGAME_NAMES[minigameId] || minigameId;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.gameName}>{gameName}</Text>
        <View style={[styles.timerBadge, countdown.isExpired && styles.timerExpired]}>
          <Text style={[styles.timerText, countdown.isExpired && styles.timerTextExpired]}>
            {countdown.isExpired ? "Time's up!" : countdown.formatted}
          </Text>
        </View>
        <Text style={styles.xpText}>{todayXp} XP</Text>
      </View>
      <View style={styles.gameArea}>
        {/* TODO: render actual minigame components here based on minigameId */}
        <MinigamePlaceholder
          minigameId={minigameId}
          onComplete={handleComplete}
        />
      </View>
      {submitting && (
        <View style={styles.submittingOverlay}>
          <Text style={styles.submittingText}>Submitting...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: PALETTE.warmBrown,
  },
  gameName: {
    fontSize: 18,
    fontFamily: FONTS.headerBold,
    color: PALETTE.cream,
  },
  timerBadge: {
    backgroundColor: PALETTE.cream,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timerExpired: {
    backgroundColor: '#C0392B',
  },
  timerText: {
    fontSize: 20,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.darkBrown,
  },
  timerTextExpired: {
    color: '#FFFFFF',
  },
  xpText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.honeyGold,
  },
  gameArea: {
    flex: 1,
  },
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submittingText: {
    color: PALETTE.cream,
    fontSize: 18,
    fontFamily: FONTS.bodySemiBold,
  },
});
