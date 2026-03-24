import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Modal,
  Dimensions,
  Image,
  ImageBackground,
  TextStyle,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { PlayerAsset, AssetCategory, AssetRarity } from '@/types';
import { MainModalParamList } from '@/navigation/MainStack';
import * as playerApi from '@/api/player';
import { useAuthStore } from '@/store/useAuthStore';
import { getTimeUntilExpiry } from '@/utils/assetExpiry';
import { useAssetStore } from '@/store/useAssetStore';
import { ASSET_MAP } from '@/constants/assets';

const chestImage = require('@/assets/ui/icons/pin_chest.png');
const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');

// ── Constants ────────────────────────────────────────────────────────

const NUM_COLUMNS = 3;
const CARD_GAP = 8;
const CONTAINER_PADDING = 16;
const CARD_WIDTH =
  (Dimensions.get('window').width - CONTAINER_PADDING * 2 - CARD_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;

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

const RARITY_ORDER: Record<string, number> = {
  legendary: 0,
  rare: 1,
  uncommon: 2,
  common: 3,
};

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  banner: 'Banner',
  statue: 'Statue',
  furniture: 'Furniture',
  mural: 'Mural',
  pet: 'Pet',
  special: 'Special',
};

const SOURCE_LABELS: Record<string, string> = {
  chest: 'Chest',
  reward: 'Reward',
  event: 'Event',
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// FIX 1 — Timestamp-aware expiry check (expired flag may lag until next backend sync)
function isActuallyExpired(asset: PlayerAsset): boolean {
  if (asset.permanent) return false;
  if (asset.expired) return true;
  if (asset.expiresAt) return new Date(asset.expiresAt).getTime() <= Date.now();
  return false;
}

// ISSUE 8 — Filter predicate for non-expired assets
function isAssetActive(asset: PlayerAsset): boolean {
  return !isActuallyExpired(asset);
}

// ── Countdown label component (updates every 60s) ──────────────────

function ExpiryCountdown({
  expiresAt,
  textStyle,
}: {
  expiresAt: string;
  textStyle?: TextStyle;
}) {
  const [remaining, setRemaining] = useState(() => getTimeUntilExpiry(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(getTimeUntilExpiry(expiresAt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remaining.expired) {
    return (
      <Text style={[styles.expiryText, styles.expiryUrgent, textStyle]}>
        Expired
      </Text>
    );
  }

  const isUrgent = remaining.hours === 0;
  const label =
    remaining.hours > 0
      ? `${remaining.hours}h ${remaining.minutes}m`
      : `${remaining.minutes}m`;

  return (
    <Text style={[styles.expiryText, isUrgent && styles.expiryUrgent, textStyle]}>
      {label}
    </Text>
  );
}

// ── Asset card (memoized) ───────────────────────────────────────────

interface AssetCardProps {
  asset: PlayerAsset;
  onPress: (item: PlayerAsset) => void;
}

const AssetCard = React.memo(function AssetCard({ asset, onPress }: AssetCardProps) {
  const rarityColor = RARITY_COLORS[asset.rarity] ?? RARITY_COLORS['common'];
  const def = ASSET_MAP[asset.assetId];

  return (
    <Pressable onPress={() => onPress(asset)} style={styles.card}>
      {def ? (
        <Image
          source={def.image}
          style={styles.assetImage}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: hexToRgba(rarityColor, 0.25) }]} />
      )}

      <Text style={styles.assetName} numberOfLines={1}>
        {asset.name || 'Unnamed Item'}
      </Text>

      {/* Rarity badge — bottom-left */}
      <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
        <Text style={styles.rarityText}>{RARITY_LABELS[asset.rarity] ?? asset.rarity}</Text>
      </View>

      {/* Status — bottom-right */}
      {asset.placed ? (
        <Text style={styles.placedLabel}>{'\u2713'} Placed</Text>
      ) : asset.permanent ? (
        // ISSUE 9 — Permanent asset badge
        <Text style={styles.permanentLabel}>{'\u2726'} Permanent</Text>
      ) : asset.expiresAt ? (
        <View style={styles.expiryContainer}>
          <ExpiryCountdown expiresAt={asset.expiresAt} />
        </View>
      ) : null}
    </Pressable>
  );
});

// ── Route type ──────────────────────────────────────────────────────

type AssetInventoryRoute = RouteProp<MainModalParamList, 'AssetInventory'>;

// ── Main screen ─────────────────────────────────────────────────────

export default function AssetInventoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainModalParamList>>();
  const route = useRoute<AssetInventoryRoute>();
  const fromSpaceId = route.params?.fromSpaceId;
  const fromSpaceName = route.params?.fromSpaceName;
  const fromSpaceClan = route.params?.fromSpaceClan;
  const fromSpaceGridCells = route.params?.fromSpaceGridCells;
  const fromSpacePolygonPoints = route.params?.fromSpacePolygonPoints;
  const playerClan = useAuthStore((s) => s.clan);

  const [assets, setAssets] = useState<PlayerAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PlayerAsset | null>(null);
  const mountedRef = useRef(false);
  const setUnplacedCount = useAssetStore((s) => s.setUnplacedCount);

  // Auto-dismiss refresh error after 4s
  useEffect(() => {
    if (!refreshError) return;
    const timer = setTimeout(() => {
      if (mountedRef.current) setRefreshError(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [refreshError]);

  const fetchAssets = useCallback(async () => {
    try {
      const result = await playerApi.getAssets();
      if (!mountedRef.current) return;
      if (result.success && result.data) {
        // ISSUE 8 — Filter out expired assets
        const active = result.data.assets.filter(isAssetActive);
        setAssets(active);
        setUnplacedCount(active.filter((a) => !a.placed).length);
        setError(null);
        setRefreshError(null);
      } else {
        const msg = result.error?.message || 'Failed to load assets';
        if (!mountedRef.current) return;
        setAssets((prev) => {
          if (prev.length > 0) {
            setRefreshError(msg);
          } else {
            setError(msg);
          }
          return prev;
        });
      }
    } catch {
      if (!mountedRef.current) return;
      setAssets((prev) => {
        if (prev.length > 0) {
          setRefreshError('Failed to load assets');
        } else {
          setError('Failed to load assets');
        }
        return prev;
      });
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
    if (!mountedRef.current) return;
    setRefreshing(false);
  }, [fetchAssets]);

  const unplacedCount = useMemo(
    () => assets.filter((a) => !a.placed).length,
    [assets],
  );

  const sortedAssets = useMemo(
    () => [...assets].sort((a, b) =>
      (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99)
    ),
    [assets],
  );

  const handleItemPress = useCallback((item: PlayerAsset) => {
    setSelectedItem(item);
  }, []);

  const handlePlaceItem = useCallback(() => {
    if (!selectedItem) return;
    const assetId = selectedItem.userAssetId;
    setSelectedItem(null);

    if (fromSpaceId && fromSpaceName && fromSpaceClan && fromSpaceGridCells) {
      // Came from SpaceDecorationScreen via "Browse All" — navigate directly back with asset selected
      navigation.navigate('SpaceDecoration', {
        spaceId: fromSpaceId,
        spaceName: fromSpaceName,
        clan: fromSpaceClan,
        gridCells: fromSpaceGridCells,
        polygonPoints: fromSpacePolygonPoints,
        userAssetId: assetId,
      });
    } else {
      // No space context — go to map in selectSpace mode
      navigation.navigate('Map', {
        mode: 'selectSpace',
        userAssetId: assetId,
      });
    }
  }, [selectedItem, navigation, fromSpaceId, fromSpaceName, fromSpaceClan, fromSpaceGridCells, fromSpacePolygonPoints]);

  const renderItem = useCallback(
    ({ item }: { item: PlayerAsset }) => (
      <AssetCard asset={item} onPress={handleItemPress} />
    ),
    [handleItemPress],
  );

  const keyExtractor = useCallback((item: PlayerAsset) => item.userAssetId, []);

  const emptyMessage = 'No items yet \u2014 win minigames for a chance at chest drops!';

  return (
    <ImageBackground source={plainBg} style={styles.container} resizeMode="cover">
      {/* ── Loading state ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.warmBrown} />
        </View>
      ) : error && assets.length === 0 ? (
        /* ── Error state (initial load only) ── */
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchAssets}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <>
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
            <Pressable
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
              hitSlop={12}
            >
              <Text style={styles.closeButtonText}>{'\u2715'}</Text>
            </Pressable>
          </View>

          {/* Refresh error banner */}
          {refreshError && (
            <View style={styles.refreshErrorBanner}>
              <Text style={styles.refreshErrorText}>{refreshError}</Text>
              <Pressable
                onPress={() => setRefreshError(null)}
                hitSlop={8}
                style={styles.refreshErrorDismiss}
              >
                <Text style={styles.refreshErrorDismissText}>{'\u2715'}</Text>
              </Pressable>
            </View>
          )}

          {/* Grid or empty state */}
          {sortedAssets.length === 0 ? (
            <ScrollView
              contentContainerStyle={styles.emptyScrollContent}
              style={styles.emptyScroll}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              <View style={styles.emptyContainer}>
                <Image source={chestImage} style={styles.emptyIcon} resizeMode="contain" />
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              </View>
            </ScrollView>
          ) : (
            <FlatList
              data={sortedAssets}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              numColumns={NUM_COLUMNS}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )}
        </>
      )}

      {/* Item detail modal */}
      <Modal
        visible={selectedItem !== null}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedItem(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {/* Close button */}
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setSelectedItem(null)}
              hitSlop={12}
            >
              <Text style={styles.modalCloseText}>{'\u2715'}</Text>
            </Pressable>

            {selectedItem && (
              <>
                {/* Item name */}
                <Text
                  style={styles.modalName}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {selectedItem.name || 'Unnamed Item'}
                </Text>

                {/* Rarity badge */}
                <View
                  style={[
                    styles.modalRarityBadge,
                    { backgroundColor: RARITY_COLORS[selectedItem.rarity] ?? RARITY_COLORS['common'] },
                  ]}
                >
                  <Text style={styles.modalRarityText}>
                    {RARITY_LABELS[selectedItem.rarity] ?? selectedItem.rarity}
                  </Text>
                </View>

                {/* Category */}
                <Text style={styles.modalDetail}>
                  Category: {CATEGORY_LABELS[selectedItem.category] ?? selectedItem.category}
                </Text>

                {/* Source */}
                {selectedItem.obtainedFrom && (
                  <Text style={styles.modalDetail}>
                    Source: {SOURCE_LABELS[selectedItem.obtainedFrom] ?? selectedItem.obtainedFrom}
                  </Text>
                )}

                {/* ISSUE 9 — Permanent badge or Expiry countdown in modal */}
                {selectedItem.permanent ? (
                  <Text style={styles.modalPermanentText}>
                    {'\u2726'} Permanent
                  </Text>
                ) : selectedItem.expiresAt ? (
                  <View style={styles.modalExpiryRow}>
                    <Text style={styles.modalDetail}>Expires: </Text>
                    <ExpiryCountdown
                      expiresAt={selectedItem.expiresAt}
                      textStyle={styles.modalExpiryText}
                    />
                  </View>
                ) : null}

                {/* Placed status / Place button */}
                {selectedItem.placed ? (
                  <Text style={styles.modalPlacedText}>
                    {'\u2713'} Already placed
                  </Text>
                ) : isActuallyExpired(selectedItem) ? (
                  <Text style={styles.modalExpiredText}>
                    {'\u2715'} Expired
                  </Text>
                ) : (
                  <Pressable style={styles.placeButton} onPress={handlePlaceItem}>
                    <Text style={styles.placeButtonText}>Place Item</Text>
                  </Pressable>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: CONTAINER_PADDING,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    flex: 1,
    textAlign: 'right',
    marginRight: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PALETTE.darkBrown,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.cream,
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    justifyContent: 'flex-start',
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },

  // ── Refresh error banner ──
  refreshErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PALETTE.errorRed + 'CC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: PALETTE.errorRed,
  },
  refreshErrorText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
    flex: 1,
  },
  refreshErrorDismiss: {
    marginLeft: 8,
  },
  refreshErrorDismissText: {
    fontSize: 14,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.cream,
  },

  // ── Card ──
  card: {
    width: CARD_WIDTH,
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
  assetImage: {
    width: '65%',
    aspectRatio: 1,
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

  // ── Permanent label (bottom-right) ──
  permanentLabel: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    fontSize: 9,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.honeyGold,
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
  emptyScroll: {
    flex: 1,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Error state ──
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.mutedRose,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PALETTE.warmBrown,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
  },

  // ── Item detail modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: UI.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    backgroundColor: PALETTE.cream,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PALETTE.stoneGreyLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.stoneGrey,
  },
  modalName: {
    fontSize: 22,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  modalRarityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalRarityText: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.cream,
  },
  modalDetail: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 6,
  },
  modalExpiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalExpiryText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
  },
  modalPermanentText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.honeyGold,
    marginBottom: 6,
  },
  modalPlacedText: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.softGreen,
    marginTop: 16,
  },
  modalExpiredText: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
    marginTop: 16,
  },
  placeButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: PALETTE.warmBrown,
  },
  placeButtonText: {
    fontSize: 15,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.cream,
  },
});
