import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { PlayerAsset, AssetRarity } from '@/types';
import * as playerApi from '@/api/player';
import { getTimeUntilExpiry } from '@/utils/assetExpiry';
import { useAssetStore } from '@/store/useAssetStore';

const RARITY_COLORS: Record<AssetRarity, string> = {
  common: PALETTE.stoneGrey,
  uncommon: PALETTE.softGreen,
  rare: PALETTE.honeyGold,
  legendary: PALETTE.mutedRose,
};

const RARITY_LABELS: Record<AssetRarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

// ── Countdown label component (updates every 60s) ──────────────────

function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => getTimeUntilExpiry(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(getTimeUntilExpiry(expiresAt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remaining.expired) {
    return <Text style={[styles.expiryText, styles.expiryUrgent]}>Expired</Text>;
  }

  const isUrgent = remaining.hours === 0;
  const label =
    remaining.hours > 0
      ? `${remaining.hours}h ${remaining.minutes}m`
      : `${remaining.minutes}m`;

  return (
    <Text style={[styles.expiryText, isUrgent && styles.expiryUrgent]}>
      {label}
    </Text>
  );
}

// ── Asset card ──────────────────────────────────────────────────────

function AssetCard({ asset }: { asset: PlayerAsset }) {
  const rarityColor = RARITY_COLORS[asset.rarity];

  return (
    <View style={styles.card}>
      {/* Image placeholder — swap for <Image source={{ uri: ... }} /> when asset CDN is ready */}
      <View style={[styles.imagePlaceholder, { backgroundColor: rarityColor + '40' }]} />

      <Text style={styles.assetName} numberOfLines={1}>
        {asset.name}
      </Text>

      {/* Rarity badge — bottom-left */}
      <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
        <Text style={styles.rarityText}>{RARITY_LABELS[asset.rarity]}</Text>
      </View>

      {/* Status — bottom-right */}
      {asset.placed ? (
        <Text style={styles.placedLabel}>✓ Placed</Text>
      ) : asset.expiresAt ? (
        <View style={styles.expiryContainer}>
          <ExpiryCountdown expiresAt={asset.expiresAt} />
        </View>
      ) : null}
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────

export default function AssetInventoryScreen() {
  const [assets, setAssets] = useState<PlayerAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const setUnplacedCount = useAssetStore((s) => s.setUnplacedCount);

  const fetchAssets = useCallback(async () => {
    try {
      const result = await playerApi.getAssets();
      if (!mountedRef.current) return;
      if (result.success && result.data) {
        // Filter out expired assets client-side
        const now = Date.now();
        const active = result.data.assets.filter(
          (a) => !a.expiresAt || new Date(a.expiresAt).getTime() > now,
        );
        setAssets(active);
        setUnplacedCount(active.filter((a) => !a.placed).length);
        setError(null);
      } else {
        setError(result.error?.message || 'Failed to load assets');
      }
    } catch {
      if (mountedRef.current) {
        setError('Failed to load assets');
      }
    }
  }, [setUnplacedCount]);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      setLoading(true);
      await fetchAssets();
      if (mountedRef.current) setLoading(false);
    })();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchAssets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAssets();
    setRefreshing(false);
  }, [fetchAssets]);

  const unplacedCount = assets.filter((a) => !a.placed).length;

  const renderItem = useCallback(
    ({ item }: { item: PlayerAsset }) => <AssetCard asset={item} />,
    [],
  );

  const keyExtractor = useCallback((item: PlayerAsset) => item.userAssetId, []);

  // ── Loading state ──
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PALETTE.warmBrown} />
      </View>
    );
  }

  // ── Error state ──
  if (error && assets.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        {assets.length > 0 && (
          <Text style={styles.subtitle}>
            {unplacedCount > 0
              ? `${unplacedCount} item${unplacedCount !== 1 ? 's' : ''} need placing`
              : 'All items placed'}
          </Text>
        )}
      </View>

      {/* Grid or empty state */}
      {assets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🪵</Text>
          <Text style={styles.emptyText}>
            No items yet — win minigames for a chance at chest drops!
          </Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const CARD_MARGIN = 8;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: UI.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    justifyContent: 'flex-start',
    gap: CARD_MARGIN,
    marginBottom: CARD_MARGIN,
  },

  // ── Card ──
  card: {
    flex: 1,
    maxWidth: '31.5%',
    aspectRatio: 0.85,
    backgroundColor: PALETTE.cream,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    width: '65%',
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  assetName: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    width: '100%',
  },

  // ── Rarity badge (bottom-left) ──
  rarityBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rarityText: {
    fontSize: 9,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.cream,
  },

  // ── Placed label (bottom-right) ──
  placedLabel: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    fontSize: 9,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.softGreen,
  },

  // ── Expiry countdown (bottom-right) ──
  expiryContainer: {
    position: 'absolute',
    bottom: 5,
    right: 5,
  },
  expiryText: {
    fontSize: 9,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.warmBrown,
  },
  expiryUrgent: {
    color: PALETTE.mutedRose,
  },

  // ── Empty state ──
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.mutedRose,
    textAlign: 'center',
  },
});
