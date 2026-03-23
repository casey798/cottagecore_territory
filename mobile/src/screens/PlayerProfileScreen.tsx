import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  ImageSourcePropType,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PALETTE, CLAN_COLORS, UI, CLAN_LABELS } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { DAILY_XP_CAP } from '@/constants/config';
import { useAuthStore } from '@/store/useAuthStore';
import * as playerApi from '@/api/player';
import { PlayerProfile } from '@/types';
import { MainModalParamList } from '@/navigation/MainStack';
import { getPresetById } from '@/utils/characterPresets';

const dialogueFrame = require('@/assets/ui/frames/dialogue_frame.png');

const CLAN_CRESTS: Record<string, ImageSourcePropType> = {
  ember: require('../assets/sprites/crests/crest_seekers.png'),
  tide: require('../assets/sprites/crests/crest_guardians.png'),
  bloom: require('../assets/sprites/crests/crest_wardens.png'),
  gale: require('../assets/sprites/crests/crest_keepers.png'),
  hearth: require('../assets/sprites/crests/crest_chroniclers.png'),
};

type Nav = NativeStackNavigationProp<MainModalParamList>;

interface StreakMilestone {
  icon: ImageSourcePropType;
  label: string;
  days: number;
}

const MILESTONES: StreakMilestone[] = [
  { icon: require('../assets/sprites/badges/seedling.png'), label: 'Seedling', days: 3 },
  { icon: require('../assets/sprites/badges/sapling.png'), label: 'Sapling', days: 7 },
  { icon: require('../assets/sprites/badges/oak.png'), label: 'Ancient Oak', days: 14 },
];

export default function PlayerProfileScreen() {
  const navigation = useNavigation<Nav>();
  const selectedPresetId = useAuthStore((s) => s.selectedPresetId);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [assetCount, setAssetCount] = useState<number | null>(null);
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
      } else {
        setAssetCount(null);
      }
    } catch {
      setErrorMsg('Network error — please try again');
    } finally {
      setLoading(false);
    }
  // deps: [] is intentional — only references module-level playerApi and stable state setters
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
  const clanLabel = CLAN_LABELS[profile.clan] ?? profile.clan;
  const streak = profile.currentStreak ?? 0;
  const bestStreak = profile.bestStreak ?? 0;

  const handleAssetsTap = () => {
    navigation.navigate('AssetInventory');
  };

  return (
    <ImageBackground
      source={require('../assets/ui/backgrounds/bg_plain.png')}
      style={styles.container}
      resizeMode="cover"
    >
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View style={styles.headerSection}>
        <Text style={styles.displayName}>{profile.displayName}</Text>
        {profile.playerCode && (
          <View style={styles.playerCodeSection}>
            <View style={styles.playerCodeRow}>
              <Text style={styles.playerCodeText}>{profile.playerCode.toUpperCase()}</Text>
              <Pressable
                style={styles.copyBtn}
                onPress={() => {
                  Share.share({ message: profile.playerCode!.toUpperCase() });
                }}
              >
                <Text style={styles.copyBtnText}>{'📋'}</Text>
              </Pressable>
            </View>
            <Text style={styles.playerCodeHint}>Share this code to play co-op</Text>
          </View>
        )}
        {CLAN_CRESTS[profile.clan] && (
          <Image
            source={CLAN_CRESTS[profile.clan]}
            style={styles.clanCrest}
            resizeMode="contain"
          />
        )}
        {(() => {
          const preset = selectedPresetId
            ? getPresetById(selectedPresetId)
            : undefined;
          if (preset) {
            return (
              <>
                <ImageBackground
                  source={dialogueFrame}
                  resizeMode="stretch"
                  style={styles.avatarFrame}
                  imageStyle={styles.avatarFrameImage}
                >
                  <Image
                    source={preset.fullBody}
                    style={styles.avatarFullBody}
                    resizeMode="contain"
                  />
                </ImageBackground>
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
          <Text style={styles.statValue}>{assetCount ?? '—'}</Text>
        </Pressable>
      </View>

      {/* STREAK SECTION */}
      <View style={styles.section}>
        <Text style={styles.streakTitle}>Streak</Text>
        <View style={styles.streakCurrentRow}>
          <Image source={require('../assets/ui/icons/pin_streak.png')} style={styles.streakFlameIcon} resizeMode="contain" />
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
                <Image source={m.icon} style={styles.milestoneBadgeIcon} resizeMode="contain" />
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 4,
  },
  displayName: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 6,
  },
  clanCrest: {
    width: 125,
    height: 125,
    alignSelf: 'center',
    marginVertical: 8,
  },
  playerCodeSection: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: -20,
  },
  playerCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerCodeText: {
    fontSize: 16,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.warmBrown,
    letterSpacing: 1,
  },
  copyBtn: {
    padding: 4,
  },
  copyBtnText: {
    fontSize: 16,
  },
  playerCodeHint: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginTop: 2,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    marginTop: -20,
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
    color: PALETTE.cream,
  },
  avatarFrame: {
    width: 220,
    height: 325,
    marginTop: -20,
    marginLeft: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  avatarFrameImage: {
    width: '100%',
    height: '100%',
  },
  avatarFullBody: {
    width: 148,
    height: 188,
    marginRight: 20,
  },
  changeCharBtn: {
    marginTop: -37,
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
  streakFlameIcon: {
    width: 28,
    height: 28,
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
  milestoneBadgeIcon: {
    width: 48,
    height: 48,
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
