import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import { configureGoogleSignIn } from '@/api/auth';
import { requestNotificationPermission } from '@/utils/notifications';

export default function LoginScreen() {
  const googleSignIn = useAuthStore((s) => s.googleSignIn);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const handleGoogleSignIn = async () => {
    const result = await googleSignIn();
    if (result.success) {
      requestNotificationPermission();
    } else {
      if (result.errorCode === 'CANCELLED') return;

      const errorMsg =
        result.errorCode === 'INVALID_DOMAIN'
          ? 'Only @student.tce.edu or @tce.edu accounts are allowed'
          : result.errorCode === 'NOT_IN_ROSTER'
          ? 'Your email is not on the approved roster. Contact your administrator.'
          : result.errorMessage || 'Something went wrong.';
      Alert.alert('Error', errorMsg);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top section — logo and tagline */}
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>GroveWars</Text>
            <View style={styles.logoUnderline} />
          </View>
          <Text style={styles.tagline}>
            Five clans. One campus.{'\n'}Who will claim it?
          </Text>
        </View>

        {/* Elder Moss dialogue */}
        <View style={styles.elderSection}>
          <View style={styles.elderPortrait}>
            <Text style={styles.elderEmoji}>🧙</Text>
          </View>
          <View style={styles.dialogueBox}>
            <Text style={styles.dialogueText}>
              Welcome back, grove keeper...
            </Text>
            <View style={styles.dialogueTail} />
          </View>
        </View>

        {/* Sign in section */}
        <View style={styles.inputSection}>
          <View style={styles.parchmentPanel}>
            <Text style={styles.inputLabel}>Sign in with your college account</Text>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Signing in...' : 'Sign in with Google'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Bottom hint */}
        <Text style={styles.hintText}>
          Use your @student.tce.edu or @tce.edu Google account
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.parchmentBg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  // Top section
  topSection: {
    alignItems: 'center',
    paddingTop: 48,
    marginBottom: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 42,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
  logoUnderline: {
    width: 80,
    height: 3,
    backgroundColor: PALETTE.honeyGold,
    borderRadius: 2,
    marginTop: 4,
  },
  tagline: {
    fontSize: 16,
    fontFamily: FONTS.headerRegular,
    color: PALETTE.warmBrown,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Elder Moss
  elderSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  elderPortrait: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PALETTE.softGreen + '30',
    borderWidth: 2.5,
    borderColor: PALETTE.warmBrown,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  elderEmoji: {
    fontSize: 28,
  },
  dialogueBox: {
    flex: 1,
    backgroundColor: PALETTE.cream,
    borderWidth: 1.5,
    borderColor: PALETTE.warmBrown,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dialogueText: {
    fontSize: 14,
    fontFamily: FONTS.headerRegular,
    color: PALETTE.darkBrown,
    fontStyle: 'italic',
  },
  dialogueTail: {
    position: 'absolute',
    left: -8,
    top: 16,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: PALETTE.warmBrown,
  },
  // Input section
  inputSection: {
    marginBottom: 20,
  },
  parchmentPanel: {
    backgroundColor: PALETTE.cream,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: PALETTE.darkBrown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: PALETTE.honeyGold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: PALETTE.warmBrown,
  },
  buttonPressed: {
    borderBottomWidth: 0,
    transform: [{ translateY: 3 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: PALETTE.darkBrown,
    fontSize: 17,
    fontFamily: FONTS.bodySemiBold,
  },
  // Bottom
  hintText: {
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
  },
});
