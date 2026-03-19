// GameCompleteOverlay — shared win/lose overlay for all GroveWars minigames.
// Usage pattern for every minigame:
//   1. When game ends (win or lose), set showCompleteOverlay = true and freeze game state.
//   2. Render <GameCompleteOverlay result={...} xpEarned={...} onContinue={navigateToResult} />
//   3. onContinue calls the existing exit/result callback.
// Do NOT navigate away immediately on game end — always go through this overlay first.

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FONTS } from '@/constants/fonts';

interface GameCompleteOverlayProps {
  result: 'win' | 'lose';
  onContinue: () => void;
  xpEarned?: number;
  correctWord?: string;
}

export function GameCompleteOverlay({ result, onContinue, xpEarned, correctWord }: GameCompleteOverlayProps) {
  const isWin = result === 'win';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.backdrop,
          isWin ? styles.backdropWin : styles.backdropLose,
          { opacity: fadeAnim },
        ]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }] },
          ]}
          pointerEvents="auto"
        >
          <Text style={styles.icon}>{isWin ? '🌿' : '🍂'}</Text>
          <Text style={styles.title}>{isWin ? 'Well done!' : "Time's up!"}</Text>
          <Text style={styles.subtitle}>
            {isWin && xpEarned && xpEarned > 0
              ? `+${xpEarned} XP for your clan`
              : isWin
                ? ''
                : 'Better luck next time'}
          </Text>

          {correctWord ? (
            <View style={styles.correctWordContainer}>
              <Text style={styles.correctWordLabel}>The word was</Text>
              <Text style={[styles.correctWordText, isWin ? styles.correctWordWin : styles.correctWordLose]}>
                {correctWord.toUpperCase()}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.continueBtn}
            onPress={onContinue}
            activeOpacity={0.7}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropWin: {
    backgroundColor: 'rgba(212, 168, 67, 0.20)',
  },
  backdropLose: {
    backgroundColor: 'rgba(136, 136, 136, 0.20)',
  },
  card: {
    backgroundColor: '#F5EACB',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#A0784C',
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    minWidth: 260,
    maxWidth: '85%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  icon: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.headerBold,
    fontSize: 32,
    color: '#3D2B1F',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: '#7A6652',
    textAlign: 'center',
    marginBottom: 20,
    minHeight: 20,
  },
  correctWordContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  correctWordLabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: '#7A6652',
    marginBottom: 2,
  },
  correctWordText: {
    fontFamily: FONTS.headerBold,
    fontSize: 24,
    letterSpacing: 3,
  },
  correctWordWin: {
    color: '#D4A843',
  },
  correctWordLose: {
    color: '#A0937D',
  },
  continueBtn: {
    backgroundColor: '#D4A843',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#A0784C',
    alignItems: 'center',
    minWidth: 160,
    zIndex: 999,
  },
  continueBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: '#3D2B1F',
  },
});
