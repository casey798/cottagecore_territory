import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { PALETTE, CLAN_COLORS, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { PlayerSearchResult, ClanId } from '@/types';
import * as playerApi from '@/api/player';

interface Props {
  visible: boolean;
  locationName: string;
  onConfirm: (partner: PlayerSearchResult) => void;
  onCancel: () => void;
}

const DEBOUNCE_MS = 400;

export default function PartnerSearchModal({ visible, locationName, onConfirm, onCancel }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [selected, setSelected] = useState<PlayerSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await playerApi.searchPlayer(q.trim());
      if (res.success && res.data) {
        setResults(res.data.players);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSelected(null);
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setSearched(false);
    }
  }, [visible]);

  const renderRow = ({ item }: { item: PlayerSearchResult }) => {
    const isSelected = selected?.userId === item.userId;
    const clanColor = CLAN_COLORS[item.clan as ClanId] ?? PALETTE.stoneGrey;

    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => setSelected(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.clanDot, { backgroundColor: clanColor }]} />
        <View style={styles.rowText}>
          <Text style={styles.rowName}>{item.displayName}</Text>
          <Text style={styles.rowCode}>{item.playerCode.toUpperCase()}</Text>
        </View>
        {isSelected && <Text style={styles.checkmark}>{'✓'}</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Find a Grove Companion</Text>
          <Text style={styles.locationLabel}>{locationName}</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter name or player code (GRV-XXXX)"
            placeholderTextColor={PALETTE.stoneGrey}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.resultArea}>
            {loading ? (
              <ActivityIndicator size="small" color={PALETTE.honeyGold} style={styles.loader} />
            ) : searched && results.length === 0 ? (
              <Text style={styles.emptyText}>No players found</Text>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.userId}
                renderItem={renderRow}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
              onPress={() => selected && onConfirm(selected)}
              disabled={!selected}
            >
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devSkipBtn}
              onPress={() =>
                onConfirm({
                  userId: 'dev-partner',
                  displayName: 'Dev Partner',
                  playerCode: 'GRV-0000',
                  clan: 'ember',
                })
              }
            >
              <Text style={styles.devSkipBtnText}>DEV: Skip Partner</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: PALETTE.parchmentBg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.headerBold,
    color: PALETTE.warmBrown,
    textAlign: 'center',
    marginBottom: 4,
  },
  locationLabel: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    backgroundColor: PALETTE.cream,
    borderWidth: 1,
    borderColor: PALETTE.warmBrown,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
    marginBottom: 12,
  },
  resultArea: {
    minHeight: 120,
    maxHeight: 220,
    marginBottom: 16,
  },
  loader: {
    marginTop: 32,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginTop: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: PALETTE.cream,
  },
  rowSelected: {
    backgroundColor: PALETTE.honeyGold + '30',
    borderWidth: 1,
    borderColor: PALETTE.honeyGold,
  },
  clanDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  rowCode: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
  },
  checkmark: {
    fontSize: 16,
    color: PALETTE.honeyGold,
    fontFamily: FONTS.bodyBold,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.warmBrown,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: PALETTE.warmBrown,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
  },
  devSkipBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E67E22',
    alignItems: 'center',
  },
  devSkipBtnText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: '#FFFFFF',
  },
});
