import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { AppTextInput } from '@/components/common/AppTextInput';
import * as authApi from '@/api/auth';
import { useLockPortrait } from '@/hooks/useScreenOrientation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  useLockPortrait();
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith('@student.tce.edu')) {
      Alert.alert('Invalid Email', 'Please use your student.tce.edu email address.');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.signup(trimmed);
      if (result.success) {
        navigation.navigate('Verify', { email: trimmed });
      } else {
        const errorMsg =
          result.error?.code === 'NOT_IN_ROSTER'
            ? 'Your email is not registered. Contact your admin.'
            : result.error?.message || 'Something went wrong.';
        Alert.alert('Error', errorMsg);
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
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
              Four clans. One campus.{'\n'}Who will claim it?
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

          {/* Input section */}
          <View style={styles.inputSection}>
            <View style={styles.parchmentPanel}>
              <Text style={styles.inputLabel}>Enter your college email</Text>
              <AppTextInput
                style={[styles.input, inputFocused && styles.inputFocused]}
                placeholder="you@student.tce.edu"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSendCode}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Sending...' : 'Enter the Grove'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Bottom hint */}
          <Text style={styles.hintText}>
            First time? You'll receive a verification code.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginBottom: 10,
  },
  input: {
    borderWidth: 2,
    borderColor: PALETTE.warmBrown,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
    backgroundColor: PALETTE.parchmentBg,
    marginBottom: 16,
  },
  inputFocused: {
    borderColor: PALETTE.honeyGold,
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
