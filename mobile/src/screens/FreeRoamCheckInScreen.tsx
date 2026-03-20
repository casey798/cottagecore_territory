import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  ImageBackground,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE, CLAN_COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import { useMapStore } from '@/store/useMapStore';
import { MapCanvas } from '@/components/map/MapCanvas';
import { pixelToGps } from '@/utils/affineTransform';
import { getNowIST, getTodayISTString, isWithinGameHours } from '@/utils/time';
import { GAME_START_HOUR, GAME_END_HOUR } from '@/constants/config';
import { submitCheckIn } from '@/api/checkinApi';
import type {
  ActivityCategory,
  Satisfaction,
  Sentiment,
  Floor,
} from '@/types';

const BG_PLAIN = require('@/assets/ui/backgrounds/bg_plain.png');

type Nav = NativeStackNavigationProp<MainModalParamList>;

type ScreenState = 'form' | 'submitting' | 'success' | 'error' | 'duration_cap';

// ── Option data ──────────────────────────────────────────────────────

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
  { value: 'ground', label: 'Ground' },
  { value: 'first', label: 'First' },
];

// ── Helpers ──────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_SHORT[date.getDay()]}, ${MONTH_SHORT[m - 1]} ${d}`;
}

function formatHour12(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12} ${ampm}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

// ── Screen Component ────────────────────────────────────────────────

export default function FreeRoamCheckInScreen() {
  const navigation = useNavigation<Nav>();
  const clan = useAuthStore((s) => s.clan);
  const clanColor = clan ? CLAN_COLORS[clan] : PALETTE.honeyGold;
  const mapConfig = useMapStore((s) => s.mapConfig);

  const [withinGameHours, setWithinGameHours] = useState(() => isWithinGameHours());

  useEffect(() => {
    const interval = setInterval(() => {
      setWithinGameHours(isWithinGameHours());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Map pin state
  const [pinnedPixelX, setPinnedPixelX] = useState<number | null>(null);
  const [pinnedPixelY, setPinnedPixelY] = useState<number | null>(null);
  const [pinnedGpsLat, setPinnedGpsLat] = useState<number | null>(null);
  const [pinnedGpsLng, setPinnedGpsLng] = useState<number | null>(null);

  // Form state
  const [activity, setActivity] = useState<ActivityCategory | null>(null);
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [floor, setFloor] = useState<Floor | null>(null);

  // Duration (hours + minutes)
  const [durationHours, setDurationHours] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);

  // Activity time (date + hour + minute)
  const todayStr = getTodayISTString();
  const minDateStr = (() => {
    const d = new Date(getNowIST());
    d.setDate(d.getDate() - 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  })();
  const [activityDate, setActivityDate] = useState<string>(() => getTodayISTString());
  const [activityHour, setActivityHour] = useState<number>(() => {
    const rawHour = getNowIST().getHours();
    return Math.min(Math.max(rawHour, GAME_START_HOUR), GAME_END_HOUR - 1);
  });
  const [activityMinute, setActivityMinute] = useState<number>(() => Math.floor(getNowIST().getMinutes() / 5) * 5);

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [isAuthError, setIsAuthError] = useState(false);
  const [isRateLimit, setIsRateLimit] = useState(false);
  const [capMessage, setCapMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const totalDurationMinutes = durationHours * 60 + durationMinutes;

  const isActivityTimeValid = activityHour >= GAME_START_HOUR && activityHour < GAME_END_HOUR;

  const canSubmit =
    pinnedPixelX !== null &&
    activity !== null &&
    satisfaction !== null &&
    sentiment !== null &&
    floor !== null &&
    totalDurationMinutes >= 1 &&
    isActivityTimeValid;

  // Clamp activityHour when switching back to today
  useEffect(() => {
    if (activityDate === todayStr) {
      const currentMaxHour = Math.min(getNowIST().getHours(), GAME_END_HOUR - 1);
      setActivityHour((h) => {
        if (h > currentMaxHour) {
          const currentMinutes = Math.floor(getNowIST().getMinutes() / 5) * 5;
          setActivityMinute((m) => Math.min(m, currentMinutes));
          return currentMaxHour;
        }
        return h;
      });
    }
  }, [activityDate, todayStr]);

  // Auto-close on success
  useEffect(() => {
    if (screenState === 'success') {
      const timer = setTimeout(() => {
        navigation.goBack();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [screenState, navigation]);

  const handleMapTap = useCallback((pixelX: number, pixelY: number) => {
    setPinnedPixelX(pixelX);
    setPinnedPixelY(pixelY);
    if (mapConfig?.transformMatrix) {
      const gps = pixelToGps(pixelX, pixelY, mapConfig.transformMatrix);
      setPinnedGpsLat(gps.lat);
      setPinnedGpsLng(gps.lng);
    } else {
      setPinnedGpsLat(null);
      setPinnedGpsLng(null);
    }
  }, [mapConfig]);

  // Time clamping helpers
  const nowIST = getNowIST();
  const isTodaySelected = activityDate === todayStr;
  const gameMaxHour = GAME_END_HOUR - 1; // 17 = 5 PM (latest valid start hour)
  const maxHour = isTodaySelected ? Math.min(nowIST.getHours(), gameMaxHour) : gameMaxHour;
  const maxMinuteForHour = (h: number) => {
    if (isTodaySelected && h === nowIST.getHours()) {
      return Math.floor(nowIST.getMinutes() / 5) * 5;
    }
    return 55;
  };

  const canDecrementDate = activityDate > minDateStr;
  const canIncrementDate = activityDate < todayStr;

  const canIncrementHour = activityHour < maxHour;
  const canDecrementHour = activityHour > GAME_START_HOUR;
  const canIncrementMinute = (() => {
    const nextMin = activityMinute + 5;
    if (nextMin > 55) return false;
    if (isTodaySelected && activityHour === nowIST.getHours() && nextMin > maxMinuteForHour(activityHour)) return false;
    return true;
  })();
  const canDecrementMinute = activityMinute > 0;

  const decrementDate = useCallback(() => {
    const d = new Date(activityDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    const newDate = d.toISOString().slice(0, 10);
    if (newDate >= minDateStr) setActivityDate(newDate);
  }, [activityDate, minDateStr]);

  const incrementDate = useCallback(() => {
    const d = new Date(activityDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    const newDate = d.toISOString().slice(0, 10);
    if (newDate <= todayStr) setActivityDate(newDate);
  }, [activityDate, todayStr]);

  const handleIncrementHour = useCallback(() => {
    setActivityHour((h) => {
      const next = h + 1;
      if (next > maxHour) return h;
      // Clamp minutes if moving to current hour
      if (isTodaySelected && next === nowIST.getHours()) {
        const maxMin = Math.floor(nowIST.getMinutes() / 5) * 5;
        setActivityMinute((m) => Math.min(m, maxMin));
      }
      return next;
    });
  }, [maxHour, isTodaySelected, nowIST]);

  const handleDecrementHour = useCallback(() => {
    setActivityHour((h) => Math.max(GAME_START_HOUR, h - 1));
  }, []);

  const handleIncrementMinute = useCallback(() => {
    setActivityMinute((m) => {
      const next = m + 5;
      if (next > 55) return m;
      if (isTodaySelected && activityHour === nowIST.getHours() && next > maxMinuteForHour(activityHour)) return m;
      return next;
    });
  }, [isTodaySelected, activityHour, nowIST, maxMinuteForHour]);

  const handleDecrementMinute = useCallback(() => {
    setActivityMinute((m) => Math.max(0, m - 5));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || screenState === 'submitting') return;

    setScreenState('submitting');

    const activityTimeISO = `${activityDate}T${pad2(activityHour)}:${pad2(activityMinute)}:00+05:30`;

    const result = await submitCheckIn({
      gpsLat: pinnedGpsLat ?? 0,
      gpsLng: pinnedGpsLng ?? 0,
      pixelX: pinnedPixelX ?? 0,
      pixelY: pinnedPixelY ?? 0,
      pixelAvailable: pinnedPixelX !== null,
      activityCategory: activity!,
      satisfaction: satisfaction!,
      sentiment: sentiment!,
      floor: floor!,
      durationMinutes: totalDurationMinutes,
      activityTime: activityTimeISO,
    });

    if (result.success) {
      setScreenState('success');
    } else if (result.errorCode === 'DURATION_CAP_EXCEEDED') {
      setCapMessage(result.error ?? 'Daily activity limit reached.');
      setScreenState('duration_cap');
    } else if (result.errorCode === 'RATE_LIMITED') {
      setErrorMessage(result.error ?? 'Please wait before checking in again.');
      setIsRateLimit(true);
      setScreenState('error');
    } else if (result.errorCode === 'AUTH_ERROR') {
      setIsAuthError(true);
      setErrorMessage('');
      setScreenState('error');
    } else {
      setIsAuthError(false);
      const msg = result.error ?? '';
      // Detect time-window validation error from backend
      if (msg.includes('8 AM') || msg.includes('6 PM')) {
        setErrorMessage(msg);
      } else {
        setErrorMessage('');
      }
      setScreenState('error');
    }
  }, [
    canSubmit, screenState, activityDate, activityHour, activityMinute,
    pinnedGpsLat, pinnedGpsLng, pinnedPixelX, pinnedPixelY,
    activity, satisfaction, sentiment, floor, totalDurationMinutes,
  ]);

  const handleRetry = useCallback(() => {
    setIsAuthError(false);
    setIsRateLimit(false);
    setErrorMessage('');
    setScreenState('form');
  }, []);

  // ── Time window guard ─────────────────────────────────────────────
  if (!withinGameHours) {
    return (
      <ImageBackground source={BG_PLAIN} style={styles.rootBg} resizeMode="cover">
        <SafeAreaView style={styles.root}>
          <View style={styles.blockedContainer}>
            <Text style={styles.blockedIcon}>{'\u{1F557}'}</Text>
            <Text style={styles.blockedHeading}>
              Check-ins are open {GAME_START_HOUR} AM {'\u2013'} {GAME_END_HOUR > 12 ? GAME_END_HOUR - 12 : GAME_END_HOUR} PM
            </Text>
            <Text style={styles.blockedBody}>
              Come back during game hours to log your visit.
            </Text>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: PALETTE.honeyGold }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.actionBtnText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  // ── Success state ─────────────────────────────────────────────────
  if (screenState === 'success') {
    return (
      <ImageBackground source={BG_PLAIN} style={styles.rootBg} resizeMode="cover">
        <SafeAreaView style={styles.root}>
          <View style={styles.fullCenterContainer}>
            <Text style={styles.fullCenterIcon}>{'\u{1F33F}'}</Text>
            <Text style={styles.successHeading}>Logged! Thanks</Text>
            <Text style={styles.fullCenterBody}>Your visit has been recorded.</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  // ── Duration cap state ────────────────────────────────────────────
  if (screenState === 'duration_cap') {
    return (
      <ImageBackground source={BG_PLAIN} style={styles.rootBg} resizeMode="cover">
        <SafeAreaView style={styles.root}>
          <View style={styles.fullCenterContainer}>
            <Text style={styles.fullCenterIcon}>{'\u{23F3}'}</Text>
            <Text style={styles.capHeading}>Daily limit reached</Text>
            <Text style={styles.fullCenterBody}>{capMessage}</Text>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: PALETTE.honeyGold }]}
              onPress={() => setScreenState('form')}
            >
              <Text style={styles.actionBtnText}>Adjust Duration</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.secondaryBtnText}>Close</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────
  return (
    <ImageBackground source={BG_PLAIN} style={styles.rootBg} resizeMode="cover">
    <SafeAreaView style={styles.root}>
      <View style={styles.mainContainer}>
        {/* ── Map zone ── */}
        <View style={styles.mapZone}>
          <MapCanvas
            onMapTap={handleMapTap}
            playerX={pinnedPixelX}
            playerY={pinnedPixelY}
            pinColor={PALETTE.honeyGold}
            pinRingColor={PALETTE.honeyGold}
            followPlayer={false}
            locations={[]}
            clan={null}
          />

          {/* Overlaid header */}
          <View style={styles.headerOverlay} pointerEvents="box-none">
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>{'\u2190'}</Text>
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Free Roam Check-In</Text>
              <Text style={styles.headerSubtitle}>Tap the map to mark your spot</Text>
            </View>
          </View>

          {/* Tap hint */}
          {pinnedPixelX === null && (
            <View style={styles.tapHint} pointerEvents="none">
              <Text style={styles.tapHintText}>Tap anywhere on the map to mark your location</Text>
            </View>
          )}
        </View>

        {/* ── Form zone ── */}
        <ScrollView
          style={styles.formZone}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Error banner */}
          {screenState === 'error' && (
            <View style={[styles.errorBanner, isRateLimit && styles.rateLimitBanner]}>
              <Text style={[styles.errorBannerText, isRateLimit && styles.rateLimitText]}>
                {isAuthError
                  ? 'Session expired. Please restart the app.'
                  : isRateLimit
                    ? errorMessage
                    : errorMessage || "Couldn't save \u2014 tap to retry."}
              </Text>
              <Pressable
                style={[styles.errorBannerBtn, {
                  backgroundColor: isAuthError
                    ? PALETTE.stoneGrey
                    : isRateLimit
                      ? PALETTE.warmBrown
                      : clanColor,
                }]}
                onPress={(isAuthError || isRateLimit) ? () => navigation.goBack() : handleRetry}
              >
                <Text style={styles.errorBannerBtnText}>
                  {(isAuthError || isRateLimit) ? 'Close' : errorMessage ? 'Fix it' : 'Retry'}
                </Text>
              </Pressable>
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
              >
                <Text style={styles.activityIcon}>{opt.icon}</Text>
                <Text style={styles.activityLabel}>{opt.label}</Text>
                <Text style={styles.activitySublabel}>{opt.sublabel}</Text>
                <Text style={styles.activityDesc}>{opt.description}</Text>
              </Pressable>
            ))}
          </View>

          {/* Section 2: Satisfaction */}
          <Text style={styles.sectionLabel}>{"How's the spot?"}</Text>
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
          <Text style={styles.sectionLabel}>Would you visit here again?</Text>
          <View style={styles.chipRow}>
            {SENTIMENT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.chip,
                  sentiment === opt.value && { backgroundColor: clanColor },
                ]}
                onPress={() => setSentiment(opt.value)}
              >
                <Text
                  style={[
                    styles.sentimentChipText,
                    sentiment === opt.value && styles.chipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Section 4: Floor */}
          <Text style={styles.sectionLabel}>Which floor?</Text>
          <View style={styles.chipRow}>
            {FLOOR_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.chip,
                  floor === opt.value && { backgroundColor: clanColor },
                ]}
                onPress={() => setFloor(opt.value)}
              >
                <Text
                  style={[
                    styles.floorChipText,
                    floor === opt.value && styles.chipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Section 5: Duration (custom +/- input) */}
          <Text style={styles.sectionLabel}>How long have you been here?</Text>
          <View style={styles.stepperRow}>
            <View style={styles.stepperGroup}>
              <Pressable
                style={[styles.stepperBtn, durationHours <= 0 && styles.stepperBtnDisabled]}
                onPress={() => setDurationHours((h) => Math.max(0, h - 1))}
                disabled={durationHours <= 0}
              >
                <Text style={styles.stepperBtnText}>{'\u2212'}</Text>
              </Pressable>
              <View style={styles.stepperValueBox}>
                <Text style={styles.stepperValue}>{durationHours}</Text>
              </View>
              <Pressable
                style={[styles.stepperBtn, durationHours >= 9 && styles.stepperBtnDisabled]}
                onPress={() => setDurationHours((h) => Math.min(9, h + 1))}
                disabled={durationHours >= 9}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
              <Text style={styles.stepperUnit}>hrs</Text>
            </View>

            <View style={styles.stepperGroup}>
              <Pressable
                style={[styles.stepperBtn, durationMinutes <= 0 && styles.stepperBtnDisabled]}
                onPress={() => setDurationMinutes((m) => Math.max(0, m - 5))}
                disabled={durationMinutes <= 0}
              >
                <Text style={styles.stepperBtnText}>{'\u2212'}</Text>
              </Pressable>
              <View style={styles.stepperValueBox}>
                <Text style={styles.stepperValue}>{pad2(durationMinutes)}</Text>
              </View>
              <Pressable
                style={[styles.stepperBtn, durationMinutes >= 55 && styles.stepperBtnDisabled]}
                onPress={() => setDurationMinutes((m) => Math.min(55, m + 5))}
                disabled={durationMinutes >= 55}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
              <Text style={styles.stepperUnit}>min</Text>
            </View>
          </View>

          {/* Section 6: Activity time (custom date + time input) */}
          <Text style={styles.sectionLabel}>When did this start?</Text>

          {/* Date row */}
          <View style={styles.dateRow}>
            <Pressable
              style={[styles.stepperBtn, !canDecrementDate && styles.stepperBtnDisabled]}
              onPress={decrementDate}
              disabled={!canDecrementDate}
            >
              <Text style={styles.stepperBtnText}>{'\u2039'}</Text>
            </Pressable>
            <View style={styles.dateDisplay}>
              <Text style={styles.dateDisplayText}>{formatDisplayDate(activityDate)}</Text>
            </View>
            <Pressable
              style={[styles.stepperBtn, !canIncrementDate && styles.stepperBtnDisabled]}
              onPress={incrementDate}
              disabled={!canIncrementDate}
            >
              <Text style={styles.stepperBtnText}>{'\u203A'}</Text>
            </Pressable>
          </View>

          {/* Time row */}
          <View style={styles.stepperRow}>
            <View style={styles.stepperGroup}>
              <Pressable
                style={[styles.stepperBtn, !canDecrementHour && styles.stepperBtnDisabled]}
                onPress={handleDecrementHour}
                disabled={!canDecrementHour}
              >
                <Text style={styles.stepperBtnText}>{'\u2212'}</Text>
              </Pressable>
              <View style={styles.stepperValueBoxWide}>
                <Text style={styles.stepperValue}>{formatHour12(activityHour)}</Text>
              </View>
              <Pressable
                style={[styles.stepperBtn, !canIncrementHour && styles.stepperBtnDisabled]}
                onPress={handleIncrementHour}
                disabled={!canIncrementHour}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>

            <Text style={styles.timeSeparator}>:</Text>

            <View style={styles.stepperGroup}>
              <Pressable
                style={[styles.stepperBtn, !canDecrementMinute && styles.stepperBtnDisabled]}
                onPress={handleDecrementMinute}
                disabled={!canDecrementMinute}
              >
                <Text style={styles.stepperBtnText}>{'\u2212'}</Text>
              </Pressable>
              <View style={styles.stepperValueBox}>
                <Text style={styles.stepperValue}>{pad2(activityMinute)}</Text>
              </View>
              <Pressable
                style={[styles.stepperBtn, !canIncrementMinute && styles.stepperBtnDisabled]}
                onPress={handleIncrementMinute}
                disabled={!canIncrementMinute}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
          {!isActivityTimeValid && (
            <Text style={styles.timeWarning}>Activity must start between 8 AM and 6 PM</Text>
          )}

          {/* Submit button */}
          <Pressable
            style={[
              styles.submitBtn,
              canSubmit ? { backgroundColor: clanColor } : styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit || screenState === 'submitting'}
          >
            {screenState === 'submitting' ? (
              <ActivityIndicator color={PALETTE.cream} size="small" />
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
    </SafeAreaView>
    </ImageBackground>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  rootBg: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
  },

  // ── Map zone ──
  mapZone: {
    flex: 0.55,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 8,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PALETTE.darkBrown + '80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 22,
    color: PALETTE.cream,
    fontFamily: FONTS.pixel,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginRight: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FONTS.heading,
    color: PALETTE.parchmentBg,
    textShadowColor: PALETTE.darkBrown,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.pixel,
    color: PALETTE.parchmentBg,
    textShadowColor: PALETTE.darkBrown,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 2,
  },
  tapHint: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: PALETTE.parchmentBg + 'CC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  tapHintText: {
    fontSize: 13,
    fontFamily: FONTS.pixel,
    color: PALETTE.warmBrown,
  },

  // ── Form zone ──
  formZone: {
    flex: 0.45,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: FONTS.heading,
    color: PALETTE.darkBrown,
    marginBottom: 6,
    marginTop: 8,
  },

  // Activity grid
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
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
    fontFamily: FONTS.pixel,
    color: PALETTE.darkBrown,
  },
  activitySublabel: {
    fontSize: 11,
    fontFamily: FONTS.pixel,
    color: PALETTE.stoneGrey,
  },
  activityDesc: {
    fontSize: 10,
    fontFamily: FONTS.pixel,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginTop: 2,
  },

  // Satisfaction
  satisfactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    fontFamily: FONTS.pixel,
    color: PALETTE.stoneGrey,
  },

  // Generic chip row
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: PALETTE.cream,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey + '40',
  },
  sentimentChipText: {
    fontSize: 13,
    fontFamily: FONTS.pixel,
    color: PALETTE.darkBrown,
  },
  floorChipText: {
    fontSize: 13,
    fontFamily: FONTS.pixel,
    color: PALETTE.darkBrown,
  },
  chipTextSelected: {
    color: PALETTE.cream,
  },

  // Stepper inputs (duration + time)
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.warmBrown,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.3,
  },
  stepperBtnText: {
    fontSize: 18,
    color: PALETTE.cream,
    fontFamily: FONTS.pixel,
  },
  stepperValueBox: {
    width: 48,
    height: 36,
    borderRadius: 8,
    backgroundColor: PALETTE.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValueBoxWide: {
    width: 64,
    height: 36,
    borderRadius: 8,
    backgroundColor: PALETTE.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontFamily: FONTS.pixel,
    color: PALETTE.darkBrown,
    textAlign: 'center',
  },
  stepperUnit: {
    fontSize: 12,
    fontFamily: FONTS.pixel,
    color: PALETTE.stoneGrey,
    marginLeft: 2,
  },
  timeSeparator: {
    fontSize: 18,
    fontFamily: FONTS.pixel,
    color: PALETTE.darkBrown,
  },
  timeWarning: {
    fontSize: 12,
    fontFamily: FONTS.pixel,
    color: PALETTE.errorRed,
    marginTop: 4,
  },

  // Date row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  dateDisplay: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    backgroundColor: PALETTE.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDisplayText: {
    fontSize: 14,
    fontFamily: FONTS.pixel,
    color: PALETTE.darkBrown,
  },

  // Submit
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  submitBtnDisabled: {
    backgroundColor: PALETTE.stoneGrey,
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
  },
  submitBtnTextDisabled: {
    color: PALETTE.cream + '80',
  },

  // Error banner
  errorBanner: {
    backgroundColor: PALETTE.errorRed + '15',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: PALETTE.errorRed + '30',
  },
  errorBannerText: {
    fontSize: 13,
    fontFamily: FONTS.pixel,
    color: PALETTE.errorRed,
    textAlign: 'center',
  },
  errorBannerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  errorBannerBtnText: {
    fontSize: 13,
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
  },

  // ── Full-screen states ──
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  blockedIcon: {
    fontSize: 48,
  },
  blockedHeading: {
    fontSize: 18,
    fontFamily: FONTS.heading,
    color: PALETTE.darkBrown,
    textAlign: 'center',
  },
  blockedBody: {
    fontSize: 14,
    fontFamily: FONTS.pixel,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
  },
  fullCenterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  fullCenterIcon: {
    fontSize: 48,
  },
  successHeading: {
    fontSize: 22,
    fontFamily: FONTS.heading,
    color: PALETTE.deepGreen,
  },
  capHeading: {
    fontSize: 20,
    fontFamily: FONTS.heading,
    color: PALETTE.warmBrown,
  },
  fullCenterBody: {
    fontSize: 14,
    fontFamily: FONTS.pixel,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
  },
  actionBtnText: {
    fontSize: 16,
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 6,
    backgroundColor: PALETTE.stoneGrey,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
  },
  rateLimitBanner: {
    backgroundColor: PALETTE.warmBrown + '15',
    borderColor: PALETTE.warmBrown + '30',
  },
  rateLimitText: {
    color: PALETTE.warmBrown,
  },
});
