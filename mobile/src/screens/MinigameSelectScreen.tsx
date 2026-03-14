import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { DAILY_XP_CAP } from '@/constants/config';
import { useGameStore } from '@/store/useGameStore';
import * as gameApi from '@/api/game';
import { MinigameInfo } from '@/types';


type Nav = NativeStackNavigationProp<MainModalParamList>;
type SelectRoute = RouteProp<MainModalParamList, 'MinigameSelect'>;

const MINIGAME_ICONS: Record<string, string> = {
  'grove-words': '📝',
  'kindred': '🔗',
  'pips': '🧩',
  'vine-trail': '🌿',
  'mosaic': '🪟',
  'crossvine': '✏️',
  'number-grove': '🌱',
  'stone-pairs': '🪨',
  'potion-logic': '⚗️',
  'leaf-sort': '🍂',
  'cipher-stones': '🔮',
  'path-weaver': '🎨',
};

export default function MinigameSelectScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<SelectRoute>();
  const { locationId, locationName } = route.params;
  const lastScanResult = useGameStore((s) => s.lastScanResult);
  const setSessionId = useGameStore((s) => s.setSessionId);
  const todayXp = useGameStore((s) => s.todayXp);
  const [coopEnabled, setCoopEnabled] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [loading, setLoading] = useState(false);

  // If no scan result (e.g. cleared by daily reset), go back to map
  useEffect(() => {
    if (!lastScanResult) {
      navigation.popToTop();
    }
  }, [lastScanResult, navigation]);

  // Server is sole source of truth for XP availability
  const xpAvailable = lastScanResult?.xpAvailable ?? true;
  const minigames = lastScanResult?.availableMinigames || [];
  const allExhausted = minigames.length > 0 && minigames.every((m) => m.completed);

  const handleSelect = async (minigame: MinigameInfo) => {
    if (loading) return;
    setLoading(true);
    try {
      const coopPartnerId = coopEnabled && partnerId.trim() ? partnerId.trim() : null;
      const result = await gameApi.startMinigame(
        locationId,
        minigame.minigameId,
        coopPartnerId,
      );
      if (result.success && result.data) {
        setSessionId(result.data.sessionId);
        navigation.replace('MinigamePlay', {
          sessionId: result.data.sessionId,
          minigameId: minigame.minigameId,
          timeLimit: result.data.timeLimit,
          salt: result.data.salt,
          locationId,
          locationName,
          puzzleData: result.data.puzzleData,
          xpAvailable,
        });
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to start minigame.');
      }
    } catch {
      Alert.alert('Error', 'Failed to start minigame. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{locationName}</Text>
        <Text style={[styles.xpBadge, !xpAvailable && styles.xpBadgeMuted]}>
          {todayXp}/{DAILY_XP_CAP} XP
        </Text>
      </View>
      {!xpAvailable && !allExhausted ? (
        <View style={styles.practiceHeader}>
          <View style={styles.practiceBadge}>
            <Text style={styles.practiceBadgeText}>PRACTICE MODE</Text>
          </View>
          <Text style={styles.practiceSubtitle}>
            No XP will be earned — you've already harvested this grove today
          </Text>
        </View>
      ) : (
        <Text style={styles.subtitle}>Choose a minigame</Text>
      )}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {minigames.map((item) => (
            <TouchableOpacity
              key={item.minigameId}
              style={[styles.card, item.completed && styles.cardDone, !xpAvailable && !item.completed && styles.cardNoXp]}
              onPress={() => handleSelect(item)}
              disabled={loading || item.completed}
              activeOpacity={item.completed ? 1 : 0.7}
            >
              <Text style={[styles.cardEmoji, !xpAvailable && !item.completed && styles.cardEmojiMuted]}>
                {MINIGAME_ICONS[item.minigameId] || '🎮'}
              </Text>
              <Text style={[styles.cardName, item.completed && styles.cardTextDone, !xpAvailable && !item.completed && styles.cardTextMuted]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text
                style={[styles.cardDesc, item.completed && styles.cardTextDone, !xpAvailable && !item.completed && styles.cardTextMuted]}
                numberOfLines={2}
              >
                {item.description}
              </Text>
              {item.completed ? (
                <Text style={styles.cardCompleted}>✓ Done</Text>
              ) : !xpAvailable ? (
                <Text style={styles.cardNoXpBadge}>0 XP</Text>
              ) : (
                <Text style={styles.cardTime}>⏱ {item.timeLimit}s</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        {allExhausted && (
          <View style={styles.exhaustedBanner}>
            <Text style={styles.exhaustedText}>
              "You've proven yourself here today. Seek new grounds!"
            </Text>
            <Text style={styles.exhaustedAttrib}>— Elder Moss</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.bottomBar}>
        {!allExhausted && (
          <>
            <View style={styles.coopRow}>
              <Text style={styles.coopLabel}>Co-op Mode</Text>
              <Switch
                value={coopEnabled}
                onValueChange={setCoopEnabled}
                trackColor={{ false: PALETTE.stoneGrey, true: PALETTE.softGreen }}
                thumbColor={coopEnabled ? PALETTE.honeyGold : PALETTE.cream}
              />
            </View>
            {coopEnabled && (
              <TextInput
                style={styles.partnerInput}
                placeholder="Partner's player ID"
                placeholderTextColor={PALETTE.stoneGrey}
                value={partnerId}
                onChangeText={setPartnerId}
                autoCapitalize="none"
              />
            )}
          </>
        )}
        <TouchableOpacity
          style={allExhausted ? styles.backBtnFull : styles.backBtn}
          onPress={() => allExhausted ? navigation.popToTop() : navigation.goBack()}
        >
          <Text style={allExhausted ? styles.backBtnFullText : styles.backBtnText}>
            {allExhausted ? 'Back to Map' : '← Back'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
  xpBadge: {
    fontSize: 13,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.warmBrown,
    backgroundColor: PALETTE.cream,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  xpBadgeMuted: {
    opacity: 0.4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 12,
  },
  practiceHeader: {
    marginBottom: 12,
    alignItems: 'center',
  },
  practiceBadge: {
    backgroundColor: PALETTE.stoneGrey,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 6,
  },
  practiceBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  practiceSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  card: {
    backgroundColor: PALETTE.cream,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    width: '48%',
  },
  cardEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  cardName: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginBottom: 2,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginBottom: 4,
  },
  cardDone: {
    opacity: 0.4,
    borderColor: PALETTE.stoneGrey,
  },
  cardNoXp: {
    opacity: 0.5,
    borderColor: PALETTE.stoneGrey,
    backgroundColor: '#E8E0D4',
  },
  cardEmojiMuted: {
    opacity: 0.4,
  },
  cardTextMuted: {
    color: PALETTE.stoneGrey,
  },
  cardNoXpBadge: {
    fontSize: 11,
    color: PALETTE.stoneGrey,
    fontFamily: FONTS.bodyBold,
  },
  cardTextDone: {
    color: PALETTE.stoneGrey,
  },
  cardCompleted: {
    fontSize: 11,
    color: PALETTE.softGreen,
    fontFamily: FONTS.bodyBold,
  },
  cardTime: {
    fontSize: 12,
    color: PALETTE.warmBrown,
    fontFamily: FONTS.bodyBold,
  },
  exhaustedBanner: {
    backgroundColor: PALETTE.cream,
    borderWidth: 1,
    borderColor: PALETTE.warmBrown + '40',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  exhaustedText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  exhaustedAttrib: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginTop: 4,
  },
  bottomBar: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: PALETTE.warmBrown + '30',
  },
  coopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coopLabel: {
    color: PALETTE.darkBrown,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  partnerInput: {
    backgroundColor: PALETTE.cream,
    borderWidth: 1,
    borderColor: PALETTE.warmBrown,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
  },
  backBtn: {
    marginTop: 12,
    alignSelf: 'center',
  },
  backBtnText: {
    color: PALETTE.warmBrown,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  backBtnFull: {
    marginTop: 12,
    backgroundColor: PALETTE.warmBrown,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  backBtnFullText: {
    color: PALETTE.cream,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
});
