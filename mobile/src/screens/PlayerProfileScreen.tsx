import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PALETTE, CLAN_COLORS, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { DAILY_XP_CAP } from '@/constants/config';
import { useAuthStore } from '@/store/useAuthStore';
import * as playerApi from '@/api/player';
import { PlayerProfile, ClanId } from '@/types';
import { MainTabParamList, MainModalParamList } from '@/navigation/MainStack';
import { getPresetByIndex } from '@/utils/characterPresets';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<MainModalParamList>
>;

interface StreakMilestone {
  emoji: string;
  label: string;
  days: number;
}

const MILESTONES: StreakMilestone[] = [
  { emoji: '\u{1F331}', label: 'Seedling', days: 3 },
  { emoji: '\u{1F33F}', label: 'Sapling', days: 7 },
  { emoji: '\u{1F333}', label: 'Ancient Oak', days: 14 },
];

export default function PlayerProfileScreen() {
  const navigation = useNavigation<Nav>();
  const token = useAuthStore((s) => s.token);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [assetCount, setAssetCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [profileRes, assetsRes] = await Promise.all([
        playerApi.getProfile(),
        playerApi.getAssets(),
      ]);
      if (profileRes.success && profileRes.data) {
        setProfile(profileRes.data);
      } else {
        setErrorMsg('Failed to load profile');
      }
      if (assetsRes.success && assetsRes.data) {
        setAssetCount(assetsRes.data.assets.length);
      }
    } catch {
      setErrorMsg('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PALETTE.honeyGold} />
      </View>
    );
  }

  if (errorMsg || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMsg ?? 'Something went wrong'}</Text>
        <Pressable style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const clanColor = CLAN_COLORS[profile.clan] ?? PALETTE.honeyGold;
  const xpFraction = Math.min(profile.todayXp / DAILY_XP_CAP, 1);
  const clanLabel = profile.clan.charAt(0).toUpperCase() + profile.clan.slice(1);
  const streak = profile.currentStreak ?? 0;
  const bestStreak = profile.bestStreak ?? 0;

  const handleAssetsTap = () => {
    try {
      navigation.navigate('Inventory');
    } catch {
      // AssetInventoryScreen not in navigator — no-op
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View style={styles.headerSection}>
        <Text style={styles.displayName}>{profile.displayName}</Text>
        <View style={[styles.clanBadge, { backgroundColor: clanColor }]}>
          <Text style={styles.clanBadgeText}>{clanLabel}</Text>
        </View>
        {(() => {
          const preset = profile.avatarConfig?.characterPreset
            ? getPresetByIndex(profile.avatarConfig.characterPreset)
            : undefined;
          if (preset) {
            return (
              <>
                <View style={[styles.avatarRing, { borderColor: clanColor }]}>
                  <View style={[styles.presetCard, { backgroundColor: preset.color }]}>
                    <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                  </View>
                </View>
                <Pressable
                  style={styles.changeCharBtn}
                  onPress={() => navigation.navigate('CharacterCreation')}
                >
                  <Text style={styles.changeCharText}>Change Character</Text>
                </Pressable>
              </>
            );
          }
          return (
            <>
              <View style={[styles.avatarRing, { borderColor: clanColor }]}>
                <View style={[styles.avatarCircle, { backgroundColor: clanColor }]}>
                  <Text style={styles.avatarSilhouette}>{'\u{1F464}'}</Text>
                </View>
              </View>
              <Text style={styles.avatarHint}>Avatar coming soon</Text>
            </>
          );
        })()}
      </View>

      {/* TODAY'S XP */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Today's XP</Text>
        <View style={styles.xpRow}>
          <View style={styles.xpBarTrack}>
            <View
              style={[
                styles.xpBarFill,
                { width: `${xpFraction * 100}%`, backgroundColor: clanColor },
              ]}
            />
          </View>
          <Text style={styles.xpLabel}>
            {profile.todayXp} / {DAILY_XP_CAP} XP
          </Text>
        </View>
      </View>

      {/* STATS ROW */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Season XP</Text>
          <Text style={styles.statValue}>{profile.seasonXp}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Minigames Won</Text>
          <Text style={styles.statValue}>{profile.totalWins}</Text>
        </View>
        <Pressable style={styles.statCard} onPress={handleAssetsTap}>
          <Text style={styles.statLabel}>Assets Collected</Text>
          <Text style={styles.statValue}>{assetCount}</Text>
        </Pressable>
      </View>

      {/* STREAK SECTION */}
      <View style={styles.section}>
        <Text style={styles.streakTitle}>Streak</Text>
        <View style={styles.streakCurrentRow}>
          <Text style={styles.streakFireEmoji}>{'\u{1F525}'}</Text>
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.streakDayText}>day streak</Text>
        </View>

        <View style={styles.milestoneRow}>
          {MILESTONES.map((m) => {
            const reached = streak >= m.days;
            return (
              <View
                key={m.days}
                style={[
                  styles.milestoneBadge,
                  { backgroundColor: reached ? clanColor : PALETTE.stoneGrey },
                ]}
              >
                <Text style={styles.milestoneEmoji}>{m.emoji}</Text>
                <Text style={styles.milestoneLabel}>{m.label}</Text>
                <Text style={styles.milestoneDays}>{m.days}d</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.bestStreakText}>
          Best this season: {bestStreak} days
        </Text>
      </View>

      {/* FOOTER */}
      <Text style={styles.footerText}>
        Playing for {clanLabel} {'\u2022'} Season in progress
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: UI.background,
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.errorRed,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: PALETTE.honeyGold,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },

  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  displayName: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 6,
  },
  clanBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  clanBadgeText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: '#FFFFFF',
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSilhouette: {
    fontSize: 40,
    color: '#FFFFFF',
  },
  presetCard: {
    width: 80,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetEmoji: {
    fontSize: 36,
  },
  changeCharBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey,
  },
  changeCharText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
  },
  avatarHint: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginTop: 6,
  },

  // XP
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginBottom: 8,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xpBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: PALETTE.stoneGrey + '40',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 10,
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  xpLabel: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    minWidth: 70,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: PALETTE.parchmentBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '30',
  },
  statLabel: {
    fontSize: 10,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.darkBrown,
  },

  // Streak
  streakTitle: {
    fontSize: 22,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 8,
  },
  streakCurrentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  streakFireEmoji: {
    fontSize: 28,
    marginRight: 6,
  },
  streakNumber: {
    fontSize: 36,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.darkBrown,
    marginRight: 6,
  },
  streakDayText: {
    fontSize: 16,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
  },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  milestoneBadge: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    minWidth: 80,
  },
  milestoneEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  milestoneLabel: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: '#FFFFFF',
  },
  milestoneDays: {
    fontSize: 10,
    fontFamily: FONTS.bodyRegular,
    color: '#FFFFFFCC',
  },
  bestStreakText: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
  },

  // Footer
  footerText: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginTop: 8,
  },
});
