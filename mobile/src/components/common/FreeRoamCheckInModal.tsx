import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { PALETTE, CLAN_COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import { submitCheckIn } from '@/api/checkinApi';
import type {
  ActivityCategory,
  Satisfaction,
  Sentiment,
  Floor,
} from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentGpsLat: number | null;
  currentGpsLng: number | null;
  currentPixelX: number | null;
  currentPixelY: number | null;
}

type ModalState = 'questions' | 'submitting' | 'success' | 'error';

interface ActivityOption {
  value: ActivityCategory;
  label: string;
  sublabel: string;
  description: string;
  icon: string;
}

const ACTIVITY_OPTIONS: ActivityOption[] = [
  { value: 'high_effort_personal', label: 'High Effort', sublabel: 'Personal', description: 'Studying, assignments, lab work', icon: '\u{1F4D6}' },
  { value: 'low_effort_personal', label: 'Low Effort', sublabel: 'Personal', description: 'Resting, eating, scrolling phone', icon: '\u{2615}' },
  { value: 'high_effort_social', label: 'High Effort', sublabel: 'Social', description: 'Group project, club activity, sports', icon: '\u{1F465}' },
  { value: 'low_effort_social', label: 'Low Effort', sublabel: 'Social', description: 'Hanging out, chatting, waiting', icon: '\u{1F4AC}' },
];

interface SatisfactionOption {
  value: Satisfaction;
  emoji: string;
  label: string;
}

const SATISFACTION_OPTIONS: SatisfactionOption[] = [
  { value: 0, emoji: '\u{1F61E}', label: 'Bad' },
  { value: 0.25, emoji: '\u{1F615}', label: 'Poor' },
  { value: 0.5, emoji: '\u{1F610}', label: 'Okay' },
  { value: 0.75, emoji: '\u{1F642}', label: 'Good' },
  { value: 1, emoji: '\u{1F60A}', label: 'Great' },
];

interface SentimentOption {
  value: Sentiment;
  label: string;
}

const SENTIMENT_OPTIONS: SentimentOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];

interface FloorOption {
  value: Floor;
  label: string;
}

const FLOOR_OPTIONS: FloorOption[] = [
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'ground', label: 'G' },
  { value: 'first', label: '1' },
  { value: 'second', label: '2' },
  { value: 'third', label: '3' },
];

export function FreeRoamCheckInModal({
  visible,
  onClose,
  currentGpsLat,
  currentGpsLng,
  currentPixelX,
  currentPixelY,
}: Props) {
  const clan = useAuthStore((s) => s.clan);
  const clanColor = clan ? CLAN_COLORS[clan] : PALETTE.honeyGold;

  const [modalState, setModalState] = useState<ModalState>('questions');
  const [activity, setActivity] = useState<ActivityCategory | null>(null);
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [floor, setFloor] = useState<Floor | null>(null);

  const allAnswered =
    activity !== null &&
    satisfaction !== null &&
    sentiment !== null &&
    floor !== null;

  const gpsReady = currentGpsLat !== null && currentGpsLng !== null;
  const canSubmit = allAnswered && gpsReady && modalState === 'questions';

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setModalState('questions');
      setActivity(null);
      setSatisfaction(null);
      setSentiment(null);
      setFloor(null);
    }
  }, [visible]);

  // Auto-close on success
  useEffect(() => {
    if (modalState === 'success') {
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [modalState, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setModalState('submitting');

    const result = await submitCheckIn({
      gpsLat: currentGpsLat!,
      gpsLng: currentGpsLng!,
      pixelX: currentPixelX ?? 0,
      pixelY: currentPixelY ?? 0,
      activityCategory: activity!,
      satisfaction: satisfaction!,
      sentiment: sentiment!,
      floor: floor!,
    });

    setModalState(result.success ? 'success' : 'error');
  }, [
    canSubmit,
    currentGpsLat,
    currentGpsLng,
    currentPixelX,
    currentPixelY,
    activity,
    satisfaction,
    sentiment,
    floor,
  ]);

  const handleRetry = useCallback(() => {
    setModalState('questions');
  }, []);

  if (modalState === 'success') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.successContainer}>
              <Text style={styles.successText}>Logged! Thanks 🌿</Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (modalState === 'error') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                Couldn't save — tap to retry.
              </Text>
              <Pressable
                style={[styles.submitBtn, { backgroundColor: clanColor }]}
                onPress={handleRetry}
              >
                <Text style={styles.submitBtnText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Free Roam Check-In</Text>
              <Text style={styles.subtitle}>No XP. Just research.</Text>
            </View>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              testID="close-button"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* GPS warning */}
            {!gpsReady && (
              <View style={styles.gpsBanner}>
                <Text style={styles.gpsBannerText}>
                  Waiting for GPS signal...
                </Text>
              </View>
            )}

            {/* Section 1: Activity */}
            <Text style={styles.sectionLabel}>What are you doing here?</Text>
            <View style={styles.activityGrid}>
              {ACTIVITY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.activityCard,
                    activity === opt.value && {
                      borderColor: clanColor,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => setActivity(opt.value)}
                  testID={`activity-${opt.value}`}
                >
                  <Text style={styles.activityIcon}>{opt.icon}</Text>
                  <Text style={styles.activityLabel}>{opt.label}</Text>
                  <Text style={styles.activitySublabel}>{opt.sublabel}</Text>
                  <Text style={styles.activityDesc}>{opt.description}</Text>
                </Pressable>
              ))}
            </View>

            {/* Section 2: Satisfaction */}
            <Text style={styles.sectionLabel}>
              How's this space right now?
            </Text>
            <View style={styles.satisfactionRow}>
              {SATISFACTION_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.satisfactionBtn,
                    satisfaction === opt.value && {
                      backgroundColor: clanColor + '30',
                      borderColor: clanColor,
                    },
                  ]}
                  onPress={() => setSatisfaction(opt.value)}
                  testID={`satisfaction-${opt.value}`}
                >
                  <Text style={styles.satisfactionEmoji}>{opt.emoji}</Text>
                  <Text
                    style={[
                      styles.satisfactionLabel,
                      satisfaction === opt.value && { color: clanColor },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Section 3: Sentiment */}
            <Text style={styles.sectionLabel}>
              Would you come here without the game?
            </Text>
            <View style={styles.sentimentRow}>
              {SENTIMENT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.sentimentBtn,
                    sentiment === opt.value && {
                      backgroundColor: clanColor,
                    },
                  ]}
                  onPress={() => setSentiment(opt.value)}
                  testID={`sentiment-${opt.value}`}
                >
                  <Text
                    style={[
                      styles.sentimentText,
                      sentiment === opt.value && styles.sentimentTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Section 4: Floor */}
            <Text style={styles.sectionLabel}>Which floor?</Text>
            <View style={styles.floorRow}>
              {FLOOR_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.floorChip,
                    floor === opt.value && {
                      backgroundColor: clanColor,
                    },
                  ]}
                  onPress={() => setFloor(opt.value)}
                  testID={`floor-${opt.value}`}
                >
                  <Text
                    style={[
                      styles.floorChipText,
                      floor === opt.value && styles.floorChipTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Submit */}
            <Pressable
              style={[
                styles.submitBtn,
                canSubmit
                  ? { backgroundColor: clanColor }
                  : styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              testID="submit-button"
            >
              {modalState === 'submitting' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text
                  style={[
                    styles.submitBtnText,
                    !canSubmit && styles.submitBtnTextDisabled,
                  ]}
                >
                  Log It
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: PALETTE.parchmentBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.stoneGrey + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: PALETTE.darkBrown,
    fontFamily: FONTS.bodyBold,
  },
  scrollContent: {
    flexGrow: 0,
  },
  gpsBanner: {
    backgroundColor: PALETTE.honeyGold + '30',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  gpsBannerText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginBottom: 8,
    marginTop: 4,
  },
  // Activity grid
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  activityCard: {
    width: '48%',
    backgroundColor: PALETTE.cream,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '40',
  },
  activityIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  activityLabel: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  activitySublabel: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
  },
  activityDesc: {
    fontSize: 10,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginTop: 2,
  },
  // Satisfaction
  satisfactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  satisfactionBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    flex: 1,
    marginHorizontal: 2,
  },
  satisfactionEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  satisfactionLabel: {
    fontSize: 10,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
  },
  // Sentiment
  sentimentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  sentimentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: PALETTE.cream,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '40',
  },
  sentimentText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  sentimentTextSelected: {
    color: '#FFFFFF',
  },
  // Floor
  floorRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  floorChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: PALETTE.cream,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '40',
  },
  floorChipText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  floorChipTextSelected: {
    color: '#FFFFFF',
  },
  // Submit
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  submitBtnDisabled: {
    backgroundColor: PALETTE.stoneGrey,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    color: '#FFFFFF',
  },
  submitBtnTextDisabled: {
    color: '#FFFFFF80',
  },
  // Success / Error
  successContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  successText: {
    fontSize: 20,
    fontFamily: FONTS.headerBold,
    color: PALETTE.deepGreen,
  },
  errorContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.errorRed,
    textAlign: 'center',
  },
});
