import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  ImageBackground,
  PermissionsAndroid,
  Linking,
  Modal,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PALETTE, CLAN_COLORS, CLAN_LABELS, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { CottageButton } from '@/components/common/CottageButton';
import { AppTextInput } from '@/components/common/AppTextInput';
import { ErrorToast } from '@/components/common/ErrorToast';
import { requestNotificationPermission } from '@/utils/notifications';
import { ClanId } from '@/types';

type RootStackParamList = {
  Login: undefined;
  Tutorial: undefined;
  Main: undefined;
  TermsAndConditions: { mode: 'consent' | 'view' };
};

const plainBg = require('@/assets/ui/backgrounds/bg_plain.png');
const APP_VERSION = '1.0.0 (beta)';
const ADMIN_EMAIL = 'karthikrajak@student.tce.edu';

// ── Section Divider ──────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerDot}>{'\u2726'}</Text>
      <Text style={styles.dividerLabel}>{label}</Text>
      <Text style={styles.dividerDot}>{'\u2726'}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Auth store
  const displayName = useAuthStore((s) => s.displayName);
  const email = useAuthStore((s) => s.email);
  const clan = useAuthStore((s) => s.clan);
  const playerCode = useAuthStore((s) => s.playerCode);
  const setDisplayName = useAuthStore((s) => s.setDisplayName);
  const logout = useAuthStore((s) => s.logout);

  // Game store — notification mute (local user preference, NOT server quiet mode)
  const notificationsMuted = useGameStore((s) => s.notificationsMuted);
  const setNotificationsMuted = useGameStore((s) => s.setNotificationsMuted);

  // Local state
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName ?? '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [gpsGranted, setGpsGranted] = useState<boolean | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [quietNote, setQuietNote] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Check GPS permission on mount
  useEffect(() => {
    (async () => {
      try {
        const status = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (mountedRef.current) setGpsGranted(status);
      } catch {
        if (mountedRef.current) setGpsGranted(false);
      }
    })();
  }, []);

  // ── Handlers ──

  const handleNameSubmit = useCallback(() => {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) {
      setErrorMsg("Name can't be empty");
      return;
    }
    setDisplayName(trimmed);
    setEditingName(false);
  }, [nameDraft, setDisplayName]);

  const handleNotificationToggle = useCallback(async (enabling: boolean) => {
    if (enabling) {
      // Turning notifications ON
      setNotificationsMuted(false);
      setQuietNote(false);
      try {
        const androidResult = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (!androidResult) {
          const reqResult = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          if (reqResult !== PermissionsAndroid.RESULTS.GRANTED) {
            if (mountedRef.current) {
              setErrorMsg(
                'Notifications are blocked in system settings. Enable them in your Android notification settings.',
              );
              setNotificationsMuted(true);
            }
            return;
          }
        }
        await requestNotificationPermission();
      } catch {
        if (mountedRef.current) {
          setErrorMsg(
            'Notifications are blocked in system settings. Enable them in your Android notification settings.',
          );
          setNotificationsMuted(true);
        }
      }
    } else {
      // Turning notifications OFF
      setNotificationsMuted(true);
      setQuietNote(true);
    }
  }, [setNotificationsMuted]);

  const handleGpsRerequest = useCallback(async () => {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      if (mountedRef.current) {
        setGpsGranted(granted);
        if (!granted) {
          setErrorMsg(
            'Location permission denied. GroveWars needs GPS to verify you\'re at a location. Please enable it in Android Settings > Apps > GroveWars > Permissions.',
          );
        }
      }
    } catch {
      if (mountedRef.current) setGpsGranted(false);
    }
  }, []);

  const handleReplayTutorial = useCallback(() => {
    // Reset both flags so RootNavigator routes back to TutorialScreen on next render
    useAuthStore.getState().resetTutorial();
  }, []);

  const handleAdminEmail = useCallback(() => {
    Linking.openURL(`mailto:${ADMIN_EMAIL}`);
  }, []);

  const handleLogout = useCallback(async () => {
    setShowLogoutModal(false);
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [logout, navigation]);

  const clanColor = clan ? CLAN_COLORS[clan] : PALETTE.stoneGrey;
  const clanLabel = clan ? CLAN_LABELS[clan as ClanId] : 'No Clan';
  const switchTrackOff = PALETTE.stoneGreyLight;
  const switchThumb = clan ? CLAN_COLORS[clan] : PALETTE.softGreen;

  return (
    <ImageBackground source={plainBg} style={styles.container} resizeMode="cover">
      {/* Drag handle */}
      <View style={styles.dragHandle} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Settings</Text>
        <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.closeBtnText}>{'\u2715'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SECTION 1: ACCOUNT ── */}
        <SectionDivider label="Account" />

        <View style={styles.card}>
          {/* Display name */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Display Name</Text>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <AppTextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  onBlur={handleNameSubmit}
                  autoFocus
                  maxLength={24}
                  returnKeyType="done"
                  onSubmitEditing={handleNameSubmit}
                  style={styles.nameInput}
                />
                <Pressable onPress={handleNameSubmit} hitSlop={8}>
                  <Text style={styles.checkmark}>{'\u2713'}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setNameDraft(displayName ?? '');
                  setEditingName(true);
                }}
              >
                <Text style={styles.rowValueEditable}>{displayName ?? 'Unnamed'}</Text>
              </Pressable>
            )}
          </View>

          {/* Email */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValueSubdued}>{email ?? '—'}</Text>
          </View>

          {/* Clan badge */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Clan</Text>
            <View style={[styles.clanBadge, { backgroundColor: clanColor }]}>
              <Text style={styles.clanBadgeText}>{clanLabel}</Text>
            </View>
          </View>

          {/* Player code */}
          <View style={styles.rowLast}>
            <Text style={styles.rowLabel}>Player Code</Text>
            <Text style={styles.rowValueMono}>{playerCode ?? '—'}</Text>
          </View>
        </View>

        {/* ── SECTION 2: NOTIFICATIONS ── */}
        <SectionDivider label="Notifications" />

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.rowLabel}>Push Notifications</Text>
            <Switch
              value={!notificationsMuted}
              onValueChange={(val) => handleNotificationToggle(val)}
              thumbColor={switchThumb}
              trackColor={{ false: switchTrackOff, true: PALETTE.warmBrownLight }}
            />
          </View>
          {quietNote && notificationsMuted && (
            <Text style={styles.quietNote}>
              You won't receive game alerts until this is turned back on.
            </Text>
          )}
        </View>

        {/* ── SECTION 3: PERMISSIONS ── */}
        <SectionDivider label="Permissions" />

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.rowLabel}>Location Access</Text>
            {gpsGranted === null ? (
              <Text style={styles.permChecking}>Checking...</Text>
            ) : gpsGranted ? (
              <View style={styles.permBadgeGranted}>
                <Text style={styles.permBadgeText}>Granted</Text>
              </View>
            ) : (
              <View style={styles.permDeniedRow}>
                <View style={styles.permBadgeDenied}>
                  <Text style={styles.permBadgeTextDenied}>Denied</Text>
                </View>
                <CottageButton
                  title="Re-request"
                  variant="secondary"
                  onPress={handleGpsRerequest}
                  style={styles.permBtn}
                />
              </View>
            )}
          </View>
        </View>

        {/* ── SECTION 4: GAME ── */}
        <SectionDivider label="Game" />

        <View style={styles.card}>
          <Pressable style={styles.row} onPress={handleReplayTutorial}>
            <View style={styles.replayTextBlock}>
              <Text style={styles.rowLabel}>Replay Tutorial</Text>
              <Text style={styles.replaySubtitle}>
                Replay the intro story from the beginning.
              </Text>
            </View>
            <Text style={styles.replayChevron}>{'\u203A'}</Text>
          </Pressable>
          <Pressable
            style={styles.rowLast}
            onPress={() => navigation.navigate('TermsAndConditions', { mode: 'view' })}
          >
            <View style={styles.replayTextBlock}>
              <Text style={styles.rowLabel}>Terms &amp; Conditions</Text>
              <Text style={styles.replaySubtitle}>
                View research consent and data usage policy
              </Text>
            </View>
            <Text style={styles.replayChevron}>{'\u203A'}</Text>
          </Pressable>
        </View>

        {/* ── SECTION 5: ABOUT ── */}
        <SectionDivider label="About" />

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>App Version</Text>
            <Text style={styles.rowValueSubdued}>{APP_VERSION}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Game Season</Text>
            <Text style={styles.rowValueSubdued}>Season 1</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Contact Email</Text>
            <Pressable onPress={handleAdminEmail}>
              <Text style={[styles.emergencyValue, { color: clanColor }]}>
                {ADMIN_EMAIL}
              </Text>
            </Pressable>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.aboutParagraph}>
              GroveWars is a campus territory game built for TCE. Capture spaces,
              earn XP, and bring your clan to glory.
            </Text>
          </View>
        </View>

        {/* ── SECTION 5: SIGN OUT ── */}
        <SectionDivider label="" />

        <CottageButton
          title="Sign Out"
          variant="primary"
          onPress={() => setShowLogoutModal(true)}
          style={styles.signOutBtn}
        />

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* ── Logout confirmation modal ── */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave the Grove?</Text>
            <Text style={styles.modalBody}>
              You'll be signed out of GroveWars. Your progress is saved.
            </Text>
            <View style={styles.modalButtons}>
              <CottageButton
                title="Stay"
                variant="primary"
                onPress={() => setShowLogoutModal(false)}
                style={styles.modalBtnPrimary}
              />
              <CottageButton
                title="Sign Out"
                variant="secondary"
                onPress={handleLogout}
                style={styles.modalBtnSecondary}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Error toast */}
      <ErrorToast message={errorMsg} onDismiss={() => setErrorMsg(null)} />
    </ImageBackground>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.parchmentBg,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: PALETTE.stoneGrey,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerSpacer: {
    width: 36,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 26,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PALETTE.warmBrownFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.darkBrown,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // ── Divider ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: PALETTE.warmBrownLight,
  },
  dividerDot: {
    fontSize: 10,
    color: PALETTE.warmBrown,
    marginHorizontal: 6,
  },
  dividerLabel: {
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // ── Card ──
  card: {
    backgroundColor: PALETTE.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.warmBrownFaint,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 2,
  },

  // ── Rows ──
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.warmBrownFaint,
  },
  rowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  rowValueEditable: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.warmBrown,
    textDecorationLine: 'underline',
  },
  rowValueSubdued: {
    fontSize: 13,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '55%',
  },
  rowValueMono: {
    fontSize: 14,
    fontFamily: FONTS.pixel,
    color: PALETTE.darkBrown,
    letterSpacing: 1,
  },

  // ── Name editing ──
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  nameInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  checkmark: {
    fontSize: 20,
    color: PALETTE.softGreen,
    marginLeft: 8,
  },

  // ── Clan badge ──
  clanBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clanBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.white,
  },

  // ── Switch row ──
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
  },
  quietNote: {
    fontSize: 11,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    paddingBottom: 12,
  },

  // ── Permissions ──
  permChecking: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
  },
  permBadgeGranted: {
    backgroundColor: PALETTE.softGreen,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  permBadgeDenied: {
    backgroundColor: PALETTE.mutedRose,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  permBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.white,
  },
  permBadgeTextDenied: {
    fontSize: 11,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.white,
  },
  permDeniedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  // ── About ──
  emergencyValue: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    textDecorationLine: 'underline',
  },
  aboutParagraph: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    lineHeight: 18,
    flex: 1,
  },

  // ── Replay tutorial ──
  replayTextBlock: {
    flex: 1,
  },
  replaySubtitle: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginTop: 2,
  },
  replayChevron: {
    fontSize: 20,
    color: PALETTE.stoneGrey,
    marginLeft: 8,
  },

  // ── Sign out ──
  signOutBtn: {
    backgroundColor: PALETTE.mutedRose,
    marginTop: 8,
  },
  bottomPad: {
    height: 32,
  },

  // ── Logout modal ──
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
  modalTitle: {
    fontSize: 22,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtnPrimary: {
    flex: 1,
  },
  modalBtnSecondary: {
    flex: 1,
    borderColor: PALETTE.mutedRose,
  },
});
