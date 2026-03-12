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
import { useClanStore } from '@/store/useClanStore';
import { useGameStore } from '@/store/useGameStore';
import { useMapStore } from '@/store/useMapStore';
import { AssetRarity } from '@/types';
import { useLockPortrait } from '@/hooks/useScreenOrientation';

type Nav = NativeStackNavigationProp<MainModalParamList>;
type ResultRoute = RouteProp<MainModalParamList, 'Result'>;

const RARITY_COLORS: Record<AssetRarity, string> = {
  common: '#FFFFFF',
  uncommon: '#27AE60',
  rare: '#2980B9',
  legendary: '#F1C40F',
};

export default function ResultScreen() {
  useLockPortrait();
  const navigation = useNavigation<Nav>();
  const route = useRoute<ResultRoute>();
  const {
    result,
    xpEarned,
    newTodayXp,
    clanTodayXp,
    chestDrop,
    locationLocked,
    locationId,
    locationName,
    minigameId,
    xpAwarded,
  } = route.params;

  const clans = useClanStore((s) => s.clans);
  const lockLocation = useMapStore((s) => s.lockLocation);
  const markXpEarnedAtLocation = useGameStore((s) => s.markXpEarnedAtLocation);
  const isWin = result === 'win';
  const didEarnXp = xpAwarded !== false;

  // Mark XP earned or lock location on lose
  useEffect(() => {
    if (isWin && didEarnXp && locationId) {
      markXpEarnedAtLocation(locationId);
    }
    if (!isWin && locationLocked && locationId) {
      lockLocation(locationId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handlePlayAgainHere = () => {
    if (locationId && locationName) {
      navigation.replace('MinigameSelect', { locationId, locationName });
    } else {
      navigation.popToTop();
    }
  };

  const sortedClans = [...clans].sort((a, b) => b.todayXp - a.todayXp);

  return (
    <View style={[styles.container, isWin ? styles.bgWin : styles.bgLose]}>
      <View style={styles.content}>
        {isWin ? (
          <>
            {didEarnXp ? (
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
              </>
            ) : (
              <>
                <Text style={styles.practiceWinTitle}>Challenge Complete!</Text>
                <Text style={styles.practiceWinSubtitle}>
                  No XP earned — you've already harvested this grove today.
                </Text>
              </>
            )}

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
        {isWin && didEarnXp ? (
          <>
            <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgainHere}>
              <Text style={styles.playAgainBtnText}>Play Again Here</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={handleBackToMap}>
              <Text style={styles.backBtnText}>Back to Map</Text>
            </TouchableOpacity>
          </>
        ) : isWin && !didEarnXp ? (
          <>
            <TouchableOpacity style={styles.backBtn} onPress={handleBackToMap}>
              <Text style={styles.backBtnText}>Find Another Location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handlePlayAgainHere}>
              <Text style={styles.secondaryBtnText}>Play Again Here</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.backBtn} onPress={handleBackToMap}>
            <Text style={styles.backBtnText}>Find Another Location</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
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
  practiceWinTitle: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.warmBrown,
    marginBottom: 8,
  },
  practiceWinSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginBottom: 20,
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
    marginTop: 24,
    backgroundColor: PALETTE.cream,
    borderRadius: 10,
    padding: 14,
    alignSelf: 'stretch',
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
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
  },
  backBtn: {
    backgroundColor: PALETTE.warmBrown,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  backBtnText: {
    color: PALETTE.cream,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  playAgainBtn: {
    backgroundColor: PALETTE.softGreen,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  playAgainBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  secondaryBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.warmBrown,
  },
  secondaryBtnText: {
    color: PALETTE.warmBrown,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
});
