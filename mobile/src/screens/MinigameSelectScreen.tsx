import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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

  const minigames = lastScanResult?.availableMinigames || [];

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
          timeLimit: minigame.timeLimit,
          puzzleData: result.data.puzzleData,
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

  const renderMinigameCard = ({ item }: { item: MinigameInfo }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleSelect(item)}
      disabled={loading}
    >
      <Text style={styles.cardEmoji}>
        {MINIGAME_ICONS[item.minigameId] || '🎮'}
      </Text>
      <Text style={styles.cardName}>{item.name}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>
        {item.description}
      </Text>
      <Text style={styles.cardTime}>⏱ {item.timeLimit}s</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{locationName}</Text>
        <Text style={styles.xpBadge}>
          {todayXp}/{DAILY_XP_CAP} XP
        </Text>
      </View>
      <Text style={styles.subtitle}>Choose a minigame</Text>
      <FlatList
        data={minigames}
        renderItem={renderMinigameCard}
        keyExtractor={(item) => item.minigameId}
        horizontal
        contentContainerStyle={styles.list}
        showsHorizontalScrollIndicator={false}
      />
      <View style={styles.bottomBar}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backText: {
    color: PALETTE.warmBrown,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
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
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 16,
    textAlign: 'center',
  },
  list: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: PALETTE.cream,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 12,
    padding: 16,
    width: 160,
    alignItems: 'center',
  },
  cardEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  cardName: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginBottom: 4,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginBottom: 8,
    minHeight: 28,
  },
  cardTime: {
    fontSize: 12,
    color: PALETTE.warmBrown,
    fontFamily: FONTS.bodyBold,
  },
  bottomBar: {
    paddingVertical: 8,
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
});
