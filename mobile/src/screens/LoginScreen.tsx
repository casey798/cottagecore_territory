import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { AppTextInput } from '@/components/common/AppTextInput';
import * as authApi from '@/api/auth';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
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
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.leftPanel}>
            <View style={styles.illustrationPlaceholder}>
              <Text style={styles.logoText}>GroveWars</Text>
              <Text style={styles.placeholderText}>Cottagecore Illustration</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.rightPanel}>
            <Text style={styles.title}>GroveWars</Text>
            <Text style={styles.subtitle}>Enter your college email</Text>
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
                {loading ? 'Sending...' : 'Send Code'}
              </Text>
            </Pressable>
          </View>
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
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: PALETTE.parchmentBg,
  },
  leftPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PALETTE.parchmentBg,
  },
  illustrationPlaceholder: {
    width: '80%',
    height: '80%',
    borderRadius: 16,
    backgroundColor: PALETTE.parchmentBg,
    borderWidth: 2,
    borderColor: PALETTE.softGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 28,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 8,
  },
  placeholderText: {
    color: PALETTE.stoneGrey,
    fontSize: 12,
    fontFamily: FONTS.bodyRegular,
  },
  divider: {
    width: 1,
    backgroundColor: PALETTE.warmBrown,
    marginVertical: 24,
  },
  rightPanel: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: PALETTE.parchmentBg,
  },
  title: {
    fontSize: 32,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.stoneGrey,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1.5,
    borderColor: PALETTE.warmBrown,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FONTS.bodyRegular,
    color: PALETTE.darkBrown,
    backgroundColor: PALETTE.cream,
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
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.warmBrown,
  },
  buttonPressed: {
    borderBottomWidth: 0,
    transform: [{ translateY: 2 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: PALETTE.darkBrown,
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
  },
});
