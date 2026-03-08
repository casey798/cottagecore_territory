import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { AppTextInput } from '@/components/common/AppTextInput';
import { useAuthStore } from '@/store/useAuthStore';

type Route = RouteProp<RootStackParamList, 'Verify'>;

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const route = useRoute<Route>();
  const { email } = route.params;
  const login = useAuthStore((s) => s.login);
  const [code, setCode] = useState<string[]>(new Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const resendRef = useRef<number>(0);

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

  const handleVerify = async (fullCode: string) => {
    setLoading(true);
    try {
      const success = await login(email, fullCode);
      if (!success) {
        Alert.alert('Invalid Code', 'Please check the code and try again.');
        setCode(new Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
      // On success: do nothing — root navigator reacts to isAuthenticated change
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
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to {email}
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
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.parchmentBg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 32,
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  codeInput: {
    width: 44,
    height: 52,
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: FONTS.bodyBold,
    color: PALETTE.darkBrown,
    backgroundColor: PALETTE.cream,
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
    backgroundColor: PALETTE.parchmentBg,
  },
  verifyButton: {
    backgroundColor: PALETTE.honeyGold,
    paddingVertical: 12,
    paddingHorizontal: 48,
    borderRadius: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.warmBrown,
    marginBottom: 16,
  },
  verifyButtonPressed: {
    borderBottomWidth: 0,
    transform: [{ translateY: 2 }],
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: PALETTE.darkBrown,
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
  },
  resendText: {
    color: PALETTE.honeyGold,
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  resendTextDisabled: {
    color: PALETTE.stoneGrey,
  },
});
