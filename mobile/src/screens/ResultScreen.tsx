import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, UI, CLAN_COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useCountdown } from '@/hooks/useCountdown';
import { useClanStore } from '@/store/useClanStore';
import { AssetRarity } from '@/types';

type Nav = NativeStackNavigationProp<MainModalParamList>;
type ResultRoute = RouteProp<MainModalParamList, 'Result'>;

const RARITY_COLORS: Record<AssetRarity, string> = {
  common: '#FFFFFF',
  uncommon: '#27AE60',
  rare: '#2980B9',
  legendary: '#F1C40F',
};

export default function ResultScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ResultRoute>();
  const {
    result,
    xpEarned,
    newTodayXp,
    clanTodayXp,
    chestDrop,
    cooldownEndsAt,
    locationLocked,
  } = route.params;

  const clans = useClanStore((s) => s.clans);
  const countdown = useCountdown(cooldownEndsAt || null);
  const isWin = result === 'win';

  // XP bounce animation
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const chestAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isWin) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }).start();

      if (chestDrop?.dropped) {
        Animated.timing(chestAnim, {
          toValue: 1,
          duration: 800,
          delay: 600,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [isWin, scaleAnim, chestAnim, chestDrop]);

  const handleBackToMap = () => {
    navigation.popToTop();
  };

  const canPlayAgain = isWin && countdown.isExpired;

  const handlePlayAgain = () => {
    navigation.popToTop();
  };

  const sortedClans = [...clans].sort((a, b) => b.todayXp - a.todayXp);

  return (
    <View style={[styles.container, isWin ? styles.bgWin : styles.bgLose]}>
      <View style={styles.content}>
        {isWin ? (
          <>
            <Animated.Text
              style={[
                styles.xpGain,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              +{xpEarned} XP
            </Animated.Text>
            <Text style={styles.clanXpText}>
              Your clan now has {clanTodayXp ?? 0} XP today!
            </Text>
            <Text style={styles.playerXpText}>
              Your XP: {newTodayXp ?? 0}/100
            </Text>

            {chestDrop?.dropped && chestDrop.asset ? (
              <Animated.View style={[styles.chestContainer, { opacity: chestAnim }]}>
                <Text style={styles.chestTitle}>Chest Drop!</Text>
                <View style={styles.chestBox}>
                  <Text style={styles.chestEmoji}>🎁</Text>
                  <Text style={styles.assetName}>{chestDrop.asset.name}</Text>
                  <Text
                    style={[
                      styles.assetRarity,
                      { color: RARITY_COLORS[chestDrop.asset.rarity] },
                    ]}
                  >
                    {chestDrop.asset.rarity.toUpperCase()}
                  </Text>
                </View>
              </Animated.View>
            ) : (
              <Text style={styles.noChest}>No chest this time...</Text>
            )}

            {!countdown.isExpired && (
              <Text style={styles.cooldownText}>
                Next game in {countdown.formatted}
              </Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.loseTitle}>Not this time...</Text>
            {locationLocked && (
              <Text style={styles.lockText}>
                This location is locked for today. Try a different spot!
              </Text>
            )}
          </>
        )}

        {/* Mini clan scoreboard */}
        <View style={styles.miniScoreboard}>
          {sortedClans.slice(0, 4).map((clan) => (
            <View key={clan.clanId} style={styles.miniClanRow}>
              <View
                style={[
                  styles.miniClanDot,
                  { backgroundColor: CLAN_COLORS[clan.clanId] },
                ]}
              />
              <Text style={styles.miniClanName}>
                {clan.clanId.charAt(0).toUpperCase() + clan.clanId.slice(1)}
              </Text>
              <Text style={styles.miniClanXp}>{clan.todayXp}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBackToMap}>
          <Text style={styles.backBtnText}>Back to Map</Text>
        </TouchableOpacity>
        {isWin && (
          <TouchableOpacity
            style={[styles.playAgainBtn, !canPlayAgain && styles.playAgainDisabled]}
            onPress={handlePlayAgain}
            disabled={!canPlayAgain}
          >
            <Text style={styles.playAgainBtnText}>
              {canPlayAgain ? 'Play Again' : `Cooldown ${countdown.formatted}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  bgWin: {
    backgroundColor: '#F5EACB',
  },
  bgLose: {
    backgroundColor: '#E8DCC8',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xpGain: {
    fontSize: 48,
    fontFamily: FONTS.headerBold,
    color: PALETTE.softGreen,
    marginBottom: 12,
  },
  clanXpText: {
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginBottom: 4,
  },
  playerXpText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.warmBrown,
    marginBottom: 20,
  },
  chestContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  chestTitle: {
    fontSize: 18,
    fontFamily: FONTS.headerBold,
    color: PALETTE.honeyGold,
    marginBottom: 8,
  },
  chestBox: {
    backgroundColor: PALETTE.cream,
    borderWidth: 2,
    borderColor: PALETTE.honeyGold,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 160,
  },
  chestEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  assetName: {
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginBottom: 4,
  },
  assetRarity: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    letterSpacing: 1,
  },
  noChest: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 16,
  },
  cooldownText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
    marginTop: 8,
  },
  loseTitle: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.warmBrown,
    marginBottom: 12,
  },
  lockText: {
    fontSize: 15,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginBottom: 20,
  },
  miniScoreboard: {
    marginTop: 20,
    backgroundColor: PALETTE.cream,
    borderRadius: 10,
    padding: 12,
    width: 200,
  },
  miniClanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  miniClanDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  miniClanName: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  miniClanXp: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.stoneGrey,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  backBtn: {
    backgroundColor: PALETTE.warmBrown,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backBtnText: {
    color: PALETTE.cream,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  playAgainBtn: {
    backgroundColor: PALETTE.softGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  playAgainDisabled: {
    backgroundColor: PALETTE.stoneGrey,
    opacity: 0.7,
  },
  playAgainBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
});
