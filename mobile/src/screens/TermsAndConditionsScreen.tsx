import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PALETTE } from '@/constants/colors';
import { TC_VERSION } from '@/constants/config';
import { ENDPOINTS } from '@/constants/api';
import { apiRequest } from '@/api/client';
import { useAuthStore } from '@/store/useAuthStore';
import { CottageButton } from '@/components/common/CottageButton';

export type TermsAndConditionsScreenParams = {
  mode: 'consent' | 'view';
};

type RootStackParamList = {
  Login: undefined;
  Tutorial: undefined;
  Main: undefined;
  TermsAndConditions: TermsAndConditionsScreenParams;
};

export default function TermsAndConditionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TermsAndConditions'>>();
  const mode = route.params?.mode ?? 'consent';

  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const contentHeightRef = useRef(0);
  const viewHeightRef = useRef(0);

  const checkScrolledToBottom = useCallback((scrollY: number) => {
    if (scrollY + viewHeightRef.current >= contentHeightRef.current - 20) {
      setScrolledToBottom(true);
    }
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      checkScrolledToBottom(e.nativeEvent.contentOffset.y);
    },
    [checkScrolledToBottom],
  );

  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    contentHeightRef.current = h;
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    viewHeightRef.current = e.nativeEvent.layout.height;
  }, []);

  const handleAccept = useCallback(() => {
    const now = new Date().toISOString();
    useAuthStore.getState().setTcAccepted(now, TC_VERSION);

    // Fire-and-forget backend call
    apiRequest(ENDPOINTS.ACCEPT_TC, {
      method: 'PUT',
      body: JSON.stringify({ tcVersion: TC_VERSION }),
    }).catch((err) => {
      console.warn('acceptTc fire-and-forget failed:', err);
    });

    const { tutorialDone, tutorialSkipped } = useAuthStore.getState();
    if (!tutorialDone && !tutorialSkipped) {
      navigation.reset({ index: 0, routes: [{ name: 'Tutorial' }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  }, [navigation]);

  const handleDecline = useCallback(async () => {
    await useAuthStore.getState().logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [navigation]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const isConsent = mode === 'consent';
  const acceptDisabled = isConsent && !scrolledToBottom;

  return (
    <View style={styles.outerContainer}>
      <View style={styles.card}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleLayout}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator
        >
          <Text style={styles.screenHeader}>
            GroveWars — Research Participation &amp; Consent
          </Text>
          <Text style={styles.subtitle}>Please read carefully before playing.</Text>

          {/* Section 1 */}
          <Text style={styles.sectionHeader}>1. About This Study</Text>
          <Text style={styles.bodyText}>
            GroveWars is a research project conducted as part of a Master of Architecture
            thesis at Thiagarajar College of Engineering (TCE), Tamil Nadu. This study
            investigates how gamified spatial experiences influence voluntary movement
            patterns across campus — specifically whether gameplay encourages students to
            visit underutilised spaces they would not otherwise explore.
          </Text>
          <Text style={styles.bodyText}>
            This game is the primary research instrument. By playing, you are voluntarily
            participating in an active academic study.
          </Text>

          {/* Section 2 */}
          <Text style={styles.sectionHeader}>2. Principal Researcher</Text>
          <Text style={styles.bodyText}>
            Study conducted by: Cathrine Maria Sheeba, Karthikraja K{'\n'}
            Department: T'SEDA, Thiagarajar College of Engineering, Madurai{'\n'}
            Contact: karthikrajak@student.tce.edu{'\n'}
            Academic Supervisor: Elangovan S
          </Text>
          <Text style={styles.bodyText}>
            For questions or to withdraw at any time, email the address above.
          </Text>

          {/* Section 3 */}
          <Text style={styles.sectionHeader}>3. What Data We Collect</Text>
          <Text style={styles.bodyText}>
            The following data is collected while you play:
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.boldText}>Location data (limited):</Text> Your GPS
            coordinates are captured only at the moment you scan a QR code at a campus
            location, solely to verify physical presence. GPS is not tracked continuously.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.boldText}>Game session data:</Text> Which locations you
            visited, which minigames you played, results (win/loss/timeout), XP earned, and
            timestamps.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.boldText}>Sentiment ratings:</Text> Brief voluntary
            questions about how you feel about a space after each minigame.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.boldText}>Free-roam check-in data:</Text> If you
            voluntarily check in at a location, the location, activity type, and satisfaction
            score you report are recorded.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.boldText}>Clan and assignment data:</Text> Your clan, your
            daily assigned locations, and whether you visited them.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.boldText}>Device notification token:</Text> Used only to
            deliver push notifications. Not linked to your device identity.
          </Text>

          {/* Section 4 */}
          <Text style={styles.sectionHeader}>4. What We Do NOT Collect</Text>
          <Text style={styles.bodyText}>
            We do not collect your real name. You play under a self-chosen display name.
          </Text>
          <Text style={styles.bodyText}>
            We do not track your GPS location continuously or outside active gameplay.
          </Text>
          <Text style={styles.bodyText}>
            We do not access your camera (except for QR code scanning), microphone,
            contacts, messages, or any other device data.
          </Text>
          <Text style={styles.bodyText}>
            We do not share your data with any third party outside the research team.
          </Text>

          {/* Section 5 */}
          <Text style={styles.sectionHeader}>5. How Your Data Is Used</Text>
          <Text style={styles.bodyText}>
            All data is used exclusively for academic research. Findings will be presented in
            anonymised or aggregated form in the thesis and any resulting publications.
            Individual players will not be identifiable in any published output. Data is
            stored securely on AWS servers in the Asia Pacific (Mumbai) region, accessible
            only to the research team.
          </Text>

          {/* Section 6 */}
          <Text style={styles.sectionHeader}>6. Data Retention</Text>
          <Text style={styles.bodyText}>
            Research data will be retained for a minimum of 5 years following thesis
            publication, in accordance with standard academic research practice. After this
            period, all personally identifiable information (your email address and display
            name) will be permanently deleted. Anonymised behavioural data may be retained
            longer to support future research.
          </Text>

          {/* Section 7 */}
          <Text style={styles.sectionHeader}>7. Your Rights &amp; Right to Withdraw</Text>
          <Text style={styles.bodyText}>
            Participation is entirely voluntary. You may withdraw at any time by contacting
            the researcher at the email above. Withdrawal will result in account
            deactivation with no academic penalty or disadvantage of any kind.
          </Text>
          <Text style={styles.bodyText}>
            By tapping "I Accept" below, you confirm:{'\n'}
            {'\u2022'} You are a current student or staff member of TCE.{'\n'}
            {'\u2022'} You have read and understood this consent form.{'\n'}
            {'\u2022'} You voluntarily agree to participate in this research study.{'\n'}
            {'\u2022'} You understand you may withdraw at any time without penalty.
          </Text>

          {/* Footer note */}
          <Text style={styles.footerNote}>
            Consent recorded with timestamp. Version: {TC_VERSION}. This screen is
            accessible anytime from Settings.
          </Text>
        </ScrollView>

        {/* Button area */}
        <View style={styles.buttonContainer}>
          {isConsent ? (
            <>
              <CottageButton
                title="I Accept"
                variant="primary"
                onPress={handleAccept}
                disabled={acceptDisabled}
                style={acceptDisabled ? { ...styles.acceptButton, ...styles.acceptButtonDisabled } : styles.acceptButton}
              />
              <CottageButton
                title="Decline"
                variant="secondary"
                onPress={handleDecline}
                style={styles.declineButton}
                textStyle={styles.declineButtonText}
              />
            </>
          ) : (
            <CottageButton
              title="Close"
              variant="primary"
              onPress={handleClose}
              style={styles.acceptButton}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: PALETTE.cream,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  card: {
    flex: 1,
    backgroundColor: PALETTE.parchment,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  screenHeader: {
    fontFamily: 'Caveat-Bold',
    fontSize: 26,
    textAlign: 'center',
    color: PALETTE.darkBrown,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Nunito-Regular',
    fontSize: 13,
    textAlign: 'center',
    color: PALETTE.warmBrown,
    marginBottom: 24,
  },
  sectionHeader: {
    fontFamily: 'Caveat-Bold',
    fontSize: 18,
    color: PALETTE.darkBrown,
    marginTop: 20,
    marginBottom: 6,
  },
  bodyText: {
    fontFamily: 'Nunito-Regular',
    fontSize: 14,
    color: PALETTE.darkBrown,
    lineHeight: 22,
    marginBottom: 8,
  },
  boldText: {
    fontFamily: 'Nunito-Regular',
    fontWeight: 'bold',
  },
  footerNote: {
    fontFamily: 'Nunito-Regular',
    fontSize: 11,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: PALETTE.warmBrownFaint,
  },
  acceptButton: {
    backgroundColor: PALETTE.darkBrown,
    borderRadius: 12,
    paddingVertical: 14,
  },
  acceptButtonDisabled: {
    opacity: 0.4,
  },
  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 10,
  },
  declineButtonText: {
    color: PALETTE.stoneGrey,
    textAlign: 'center',
  },
});
