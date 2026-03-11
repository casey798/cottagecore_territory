import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, BackHandler, Modal, Pressable } from 'react-native';
import { useNavigation, useRoute, RouteProp, EventArg } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useCountdown } from '@/hooks/useCountdown';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { generateCompletionHash, generateClientCompletionHash } from '@/utils/hmac';
import * as gameApi from '@/api/game';
import { GameResult } from '@/types';
import { MinigameResult, MinigamePlayProps } from '@/types/minigame';
import { useLockPortrait } from '@/hooks/useScreenOrientation';
import GroveWordsGame from '@/minigames/grove-words/GroveWordsGame';
import KindredGame from '@/minigames/kindred/KindredGame';
import StonePairsGame from '@/minigames/stone-pairs/StonePairsGame';

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

const IMPLEMENTED_MINIGAMES: Record<string, React.ComponentType<MinigamePlayProps>> = {
  'grove-words': GroveWordsGame,
  'kindred': KindredGame,
  'stone-pairs': StonePairsGame,
};

interface MinigameCompleteData {
  result: 'win' | 'lose' | 'timeout';
  completionHash: string;
  timeTaken: number;
  solutionData: Record<string, unknown>;
}

function MinigamePlaceholder({
  minigameId,
  onComplete,
}: {
  minigameId: string;
  onComplete: (data: MinigameCompleteData) => void;
}) {
  useLockPortrait();
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.name}>
        {MINIGAME_NAMES[minigameId] || minigameId}
      </Text>
      <Text style={placeholderStyles.coming}>Coming soon</Text>
      <View style={placeholderStyles.buttons}>
        <TouchableOpacity
          style={[placeholderStyles.btn, placeholderStyles.btnWin]}
          onPress={() => onComplete({ result: 'win', completionHash: '', timeTaken: 0, solutionData: {} })}
        >
          <Text style={placeholderStyles.btnText}>Simulate Win</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[placeholderStyles.btn, placeholderStyles.btnLose]}
          onPress={() => onComplete({ result: 'lose', completionHash: '', timeTaken: 0, solutionData: {} })}
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
  const { sessionId, minigameId, timeLimit, salt, locationId, locationName, xpAvailable } = route.params;
  const userId = useAuthStore((s) => s.userId) || '';
  const todayXp = useGameStore((s) => s.todayXp);
  const recordWin = useGameStore((s) => s.recordWin);
  const [submitting, setSubmitting] = useState(false);
  const hasCompletedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const timerEnd = useRef(new Date(Date.now() + timeLimit * 1000)).current;
  const countdown = useCountdown(timerEnd);

  const handleComplete = useCallback(
    async (data: MinigameCompleteData) => {
      if (hasCompletedRef.current || submitting) return;
      hasCompletedRef.current = true;
      setSubmitting(true);

      // Send original result (win/lose/timeout) — backend accepts all three
      const finalResult: GameResult = data.result;

      // Use the hash from the minigame component if provided, otherwise compute for placeholders
      let completionHash = data.completionHash;
      let timeTaken = data.timeTaken;
      if (!completionHash) {
        // Placeholder fallback: use old server-salt-based hash
        timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
        completionHash = generateCompletionHash(sessionId, userId, finalResult, salt);
      }

      try {
        const result = await gameApi.completeMinigame(
          sessionId,
          finalResult,
          completionHash,
          timeTaken,
          data.solutionData,
        );

        if (result.success && result.data) {
          if (result.data.result === 'win') {
            recordWin();
          }
          navigation.replace('Result', {
            result: result.data.result === 'win' ? 'win' : 'lose',
            xpEarned: result.data.xpEarned,
            xpAwarded: result.data.xpAwarded,
            newTodayXp: result.data.newTodayXp,
            clanTodayXp: result.data.clanTodayXp,
            chestDrop: result.data.chestDrop,
            locationLocked: result.data.locationLocked,
            locationId,
            locationName,
            minigameId,
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
    [sessionId, userId, submitting, navigation, recordWin, salt],
  );

  const handleMinigameComplete = useCallback(
    (minigameResult: MinigameResult) => {
      handleComplete({
        result: minigameResult.result,
        completionHash: minigameResult.completionHash,
        timeTaken: minigameResult.timeTaken,
        solutionData: minigameResult.solutionData,
      });
    },
    [handleComplete],
  );

  // ---- Back-navigation intercept (location lock on abandon) ----------------
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const pendingNavActionRef = useRef<EventArg<'beforeRemove', true, any> | null>(null);

  // Intercept React Navigation's beforeRemove event
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Allow navigation if game is already finished or submitting
      if (hasCompletedRef.current || submitting) return;

      // Prevent default navigation and show confirmation modal
      e.preventDefault();
      pendingNavActionRef.current = e;
      setShowLeaveModal(true);
    });
    return unsubscribe;
  }, [navigation, submitting]);

  // Intercept Android hardware back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (hasCompletedRef.current || submitting) return false;
      setShowLeaveModal(true);
      return true; // consume the event
    });
    return () => handler.remove();
  }, [submitting]);

  const handleLeaveConfirm = useCallback(() => {
    setShowLeaveModal(false);
    // Fire a lose through the same path as any other loss
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    const hash = generateClientCompletionHash(sessionId, 'lose', elapsed);
    handleComplete({ result: 'lose', completionHash: hash, timeTaken: elapsed, solutionData: { abandoned: true } });
  }, [handleComplete, sessionId]);

  const handleLeaveCancel = useCallback(() => {
    setShowLeaveModal(false);
    pendingNavActionRef.current = null;
  }, []);

  // Auto-lose on timer expiry
  React.useEffect(() => {
    if (countdown.isExpired && !hasCompletedRef.current) {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      const hash = generateClientCompletionHash(sessionId, 'timeout', elapsed);
      handleComplete({ result: 'timeout', completionHash: hash, timeTaken: elapsed, solutionData: {} });
    }
  }, [countdown.isExpired, handleComplete, sessionId]);

  const gameName = MINIGAME_NAMES[minigameId] || minigameId;
  const MinigameComponent = IMPLEMENTED_MINIGAMES[minigameId];

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
      {xpAvailable === false && (
        <View style={styles.practiceBar}>
          <Text style={styles.practiceText}>Practice mode — no XP</Text>
        </View>
      )}
      <View style={styles.gameArea}>
        {MinigameComponent ? (
          <MinigameComponent
            sessionId={sessionId}
            timeLimit={timeLimit}
            onComplete={handleMinigameComplete}
          />
        ) : (
          <MinigamePlaceholder
            minigameId={minigameId}
            onComplete={handleComplete}
          />
        )}
      </View>
      {submitting && (
        <View style={styles.submittingOverlay}>
          <Text style={styles.submittingText}>Submitting...</Text>
        </View>
      )}
      {/* Leave-game confirmation modal */}
      <Modal
        visible={showLeaveModal}
        transparent
        animationType="fade"
        onRequestClose={handleLeaveCancel}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave game?</Text>
            <Text style={styles.modalBody}>
              Leaving now will lock this location for the rest of the day — just like a loss. Are you sure?
            </Text>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalBtn, styles.modalBtnStay]} onPress={handleLeaveCancel}>
                <Text style={styles.modalBtnStayText}>Stay</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnLeave]} onPress={handleLeaveConfirm}>
                <Text style={styles.modalBtnLeaveText}>Leave anyway</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  practiceBar: {
    backgroundColor: PALETTE.stoneGrey,
    paddingVertical: 6,
    alignItems: 'center',
  },
  practiceText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: '#FFFFFF',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '80%',
    backgroundColor: PALETTE.cream,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 110,
    alignItems: 'center',
  },
  modalBtnStay: {
    backgroundColor: PALETTE.deepGreen,
  },
  modalBtnStayText: {
    color: PALETTE.cream,
    fontSize: 15,
    fontFamily: FONTS.bodyBold,
  },
  modalBtnLeave: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: PALETTE.mutedRose,
  },
  modalBtnLeaveText: {
    color: PALETTE.mutedRose,
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
  },
});
