import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/navigation/AuthStack';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { AppTextInput } from '@/components/common/AppTextInput';
import { useAuthStore } from '@/store/useAuthStore';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Verify'>;
type Route = RouteProp<AuthStackParamList, 'Verify'>;

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { email } = route.params;
  // Legacy Cognito verify — kept for type safety; Google Sign-In bypasses this screen
  const login = async (_email: string, _code: string): Promise<boolean> => false;
  const [code, setCode] = useState<string[]>(new Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const resendRef = useRef<number>(0);

  // Success animation
  const sparkleScale = useRef(new Animated.Value(0)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(resendRef.current);
    };
  }, []);

  const handleChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every((c) => c !== '') && newCode.join('').length === CODE_LENGTH) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const playSuccessAnimation = useCallback(() => {
    sparkleOpacity.setValue(1);
    sparkleScale.setValue(0);
    Animated.parallel([
      Animated.spring(sparkleScale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(sparkleOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [sparkleScale, sparkleOpacity]);

  const handleVerify = async (fullCode: string) => {
    setLoading(true);
    try {
      const success = await login(email, fullCode);
      if (!success) {
        Alert.alert('Invalid Code', 'Please check the code and try again.');
        setCode(new Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        setLoading(false);
      } else {
        // Play sparkle, then orientation transition happens via RootNavigator
        playSuccessAnimation();
        // login sets isAuthenticated = true, RootNavigator swaps to Tutorial/Main
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setResendCooldown(30);
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = 30 - elapsed;
      if (remaining <= 0) {
        setResendCooldown(0);
        return;
      }
      setResendCooldown(remaining);
      resendRef.current = requestAnimationFrame(tick);
    };
    resendRef.current = requestAnimationFrame(tick);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          {/* Elder Moss dialogue */}
          <View style={styles.elderSection}>
            <View style={styles.elderPortrait}>
              <Text style={styles.elderEmoji}>🧙</Text>
            </View>
            <View style={styles.dialogueBox}>
              <Text style={styles.dialogueText}>
                The grove awaits your answer...
              </Text>
              <View style={styles.dialogueTail} />
            </View>
          </View>

          {/* Parchment panel with code inputs */}
          <View style={styles.parchmentPanel}>
            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.subtitle}>
              A code has been sent to{' '}
              <Text style={styles.emailBold}>{email}</Text>
            </Text>

            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <AppTextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.codeInput,
                    focusedIndex === index && styles.codeInputFocused,
                    digit !== '' && styles.codeInputFilled,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleChange(text, index)}
                  onKeyPress={({ nativeEvent }) =>
                    handleKeyPress(nativeEvent.key, index)
                  }
                  onFocus={() => setFocusedIndex(index)}
                  onBlur={() => setFocusedIndex(null)}
                  keyboardType="number-pad"
                  maxLength={1}
                  editable={!loading}
                  selectTextOnFocus
                />
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.verifyButton,
                pressed && styles.verifyButtonPressed,
                (loading || code.some((c) => c === '')) && styles.verifyButtonDisabled,
              ]}
              onPress={() => handleVerify(code.join(''))}
              disabled={loading || code.some((c) => c === '')}
            >
              <Text style={styles.verifyButtonText}>
                {loading ? 'Verifying...' : 'Verify'}
              </Text>
            </Pressable>

            <Pressable onPress={handleResend} disabled={resendCooldown > 0}>
              <Text
                style={[
                  styles.resendText,
                  resendCooldown > 0 && styles.resendTextDisabled,
                ]}
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : 'Resend code'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success sparkle overlay */}
      <Animated.View
        style={[
          styles.sparkleOverlay,
          {
            opacity: sparkleOpacity,
            transform: [{ scale: sparkleScale }],
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.sparkleText}>✦</Text>
        <Text style={[styles.sparkleText, styles.sparkle2]}>✦</Text>
        <Text style={[styles.sparkleText, styles.sparkle3]}>✦</Text>
        <Text style={[styles.sparkleText, styles.sparkle4]}>✦</Text>
        <Text style={styles.successText}>Welcome!</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.parchmentBg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  // Back button
  backButton: {
    paddingTop: 16,
    paddingBottom: 8,
    alignSelf: 'flex-start',
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.warmBrown,
  },
  // Elder Moss
  elderSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
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
  // Parchment panel
  parchmentPanel: {
    backgroundColor: PALETTE.cream,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: PALETTE.darkBrown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 24,
    textAlign: 'center',
  },
  emailBold: {
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.darkBrown,
  },
  codeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  codeInput: {
    width: 44,
    height: 56,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.darkBrown,
    backgroundColor: PALETTE.parchmentBg,
  },
  codeInputFocused: {
    borderColor: PALETTE.honeyGold,
    elevation: 4,
    shadowColor: PALETTE.honeyGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  codeInputFilled: {
    backgroundColor: PALETTE.cream,
  },
  verifyButton: {
    backgroundColor: PALETTE.honeyGold,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: PALETTE.warmBrown,
    marginBottom: 16,
    minWidth: 200,
  },
  verifyButtonPressed: {
    borderBottomWidth: 0,
    transform: [{ translateY: 3 }],
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: PALETTE.darkBrown,
    fontSize: 17,
    fontFamily: FONTS.bodySemiBold,
  },
  resendText: {
    color: PALETTE.honeyGold,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    minHeight: 48,
    textAlignVertical: 'center',
  },
  resendTextDisabled: {
    color: PALETTE.stoneGrey,
  },
  // Success sparkle overlay
  sparkleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 234, 203, 0.9)',
  },
  sparkleText: {
    position: 'absolute',
    fontSize: 32,
    color: PALETTE.honeyGold,
  },
  sparkle2: {
    top: '35%',
    left: '25%',
    fontSize: 24,
  },
  sparkle3: {
    top: '30%',
    right: '20%',
    fontSize: 28,
  },
  sparkle4: {
    bottom: '35%',
    left: '35%',
    fontSize: 20,
  },
  successText: {
    fontSize: 32,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginTop: 8,
  },
});
