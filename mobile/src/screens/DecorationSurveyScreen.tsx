import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainModalParamList } from '@/navigation/MainStack';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useGameStore } from '@/store/useGameStore';
import * as spacesApi from '@/api/spaces';
import { SubmitDecorationBody } from '@/api/spaces';

type Nav = NativeStackNavigationProp<MainModalParamList>;
type Route = RouteProp<MainModalParamList, 'DecorationSurvey'>;

const VISIT_OPTIONS = ['yes', 'maybe', 'no'] as const;
type VisitOption = typeof VISIT_OPTIONS[number];

const VISIT_LABELS: Record<VisitOption, string> = {
  yes: 'Yes',
  maybe: 'Maybe',
  no: 'No',
};

export default function DecorationSurveyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { spaceId, spaceName, placedAssets, screenshotBase64 } = route.params;

  const [wantSpaceToBe, setWantSpaceToBe] = useState('');
  const [whyChoseItems, setWhyChoseItems] = useState('');
  const [wouldVisitMore, setWouldVisitMore] = useState<VisitOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xpDisplay, setXpDisplay] = useState<number | null>(null);

  const todayXp = useGameStore((s) => s.todayXp);
  const setTodayXp = useGameStore((s) => s.setTodayXp);

  // XP overlay fade animation
  const xpOpacity = useRef(new Animated.Value(0)).current;
  const xpScale = useRef(new Animated.Value(0.5)).current;
  const navTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (xpDisplay !== null && xpDisplay > 0) {
      Animated.parallel([
        Animated.timing(xpOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(xpScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [xpDisplay, xpOpacity, xpScale]);

  const handleSubmit = useCallback(async () => {
    const errors: string[] = [];
    if (wantSpaceToBe.trim().length < 10) {
      errors.push('Q1 needs at least 10 characters');
    }
    if (whyChoseItems.trim().length < 10) {
      errors.push('Q2 needs at least 10 characters');
    }
    if (!wouldVisitMore) {
      errors.push('Select Yes / Maybe / No for Q3');
    }
    if (errors.length > 0) {
      setError(errors.join('. ') + '.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const body: SubmitDecorationBody = {
      spaceId,
      layout: { placedAssets },
      survey: {
        wantSpaceToBe: wantSpaceToBe.trim(),
        whyChoseItems: whyChoseItems.trim(),
        wouldVisitMore,
      },
      screenshotBase64,
    };

    try {
      const response = await spacesApi.submitSpaceDecoration(body);
      const xpAwarded = response.success && response.data ? response.data.xpAwarded : 0;

      // Update Zustand store so the map HUD reflects the new XP
      if (xpAwarded > 0) {
        setTodayXp(todayXp + xpAwarded);
      }

      if (xpAwarded > 0) {
        // Show XP overlay, then navigate after delay
        setXpDisplay(xpAwarded);
        navTimerRef.current = setTimeout(() => {
          navigation.navigate('Map', { clearedSpaceId: spaceId });
        }, 1200);
      } else {
        // Re-decoration or 0 XP — navigate immediately
        navigation.navigate('Map', { clearedSpaceId: spaceId });
      }
    } catch (err) {
      console.error('[DecorationSurvey] submit failed:', err);
      setError('Submission failed — please try again.');
      setSubmitting(false);
    }
  }, [wantSpaceToBe, whyChoseItems, wouldVisitMore, spaceId, placedAssets, screenshotBase64, navigation, todayXp, setTodayXp]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={styles.spaceName} numberOfLines={1} adjustsFontSizeToFit>
            {spaceName}
          </Text>
        </View>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionHeading}>Tell us about this space</Text>

        <Text style={styles.questionLabel}>
          What would you want this space to be?
        </Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={3}
          placeholder="Describe what you'd like this space to look and feel like..."
          placeholderTextColor={PALETTE.stoneGrey}
          value={wantSpaceToBe}
          onChangeText={setWantSpaceToBe}
          textAlignVertical="top"
        />

        <Text style={styles.questionLabel}>
          Why did you choose these items?
        </Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={3}
          placeholder="Tell us about your choices and what inspired them..."
          placeholderTextColor={PALETTE.stoneGrey}
          value={whyChoseItems}
          onChangeText={setWhyChoseItems}
          textAlignVertical="top"
        />

        <Text style={styles.questionLabel}>
          Would you visit this space more if it looked like this?
        </Text>
        <View style={styles.optionRow}>
          {VISIT_OPTIONS.map((option) => {
            const isSelected = wouldVisitMore === option;
            return (
              <Pressable
                key={option}
                style={[
                  styles.optionBtn,
                  isSelected && styles.optionBtnSelected,
                ]}
                onPress={() => setWouldVisitMore(option)}
              >
                <Text
                  style={[
                    styles.optionBtnText,
                    isSelected && styles.optionBtnTextSelected,
                  ]}
                >
                  {VISIT_LABELS[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={PALETTE.cream} />
          ) : (
            <Text style={styles.submitBtnText}>Submit</Text>
          )}
        </Pressable>
      </ScrollView>

      {/* XP earned overlay */}
      {xpDisplay !== null && xpDisplay > 0 && (
        <View style={styles.xpOverlay}>
          <Animated.View
            style={[
              styles.xpOverlayCard,
              { opacity: xpOpacity, transform: [{ scale: xpScale }] },
            ]}
          >
            <Text style={styles.xpOverlayText}>+{xpDisplay} XP</Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.parchmentBg,
  },
  topBar: {
    height: 56,
    backgroundColor: PALETTE.darkBrown,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: PALETTE.cream,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  spaceName: {
    fontSize: 18,
    fontFamily: FONTS.heading,
    color: PALETTE.cream,
  },
  topBarSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 20,
    fontFamily: FONTS.heading,
    color: PALETTE.darkBrown,
    marginBottom: 20,
  },
  questionLabel: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: PALETTE.cream,
    borderWidth: 1,
    borderColor: PALETTE.warmBrownMild,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
    minHeight: 80,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: PALETTE.warmBrownMild,
    alignItems: 'center',
    backgroundColor: PALETTE.cream,
  },
  optionBtnSelected: {
    borderColor: PALETTE.honeyGold,
    backgroundColor: PALETTE.honeyGold,
  },
  optionBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  optionBtnTextSelected: {
    color: PALETTE.cream,
  },
  errorText: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.errorRed,
    marginBottom: 12,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: PALETTE.honeyGold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.cream,
  },

  // XP overlay
  xpOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(61, 43, 31, 0.55)',
  },
  xpOverlayCard: {
    backgroundColor: PALETTE.parchmentBg,
    paddingHorizontal: 40,
    paddingVertical: 24,
    borderRadius: 16,
    elevation: 6,
  },
  xpOverlayText: {
    fontSize: 36,
    fontFamily: FONTS.heading,
    color: PALETTE.softGreen,
    textAlign: 'center',
  },
});
