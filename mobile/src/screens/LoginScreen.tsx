import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { configureGoogleSignIn } from '@/api/auth';
import { FONTS } from '@/constants/fonts';
import { requestNotificationPermission } from '@/utils/notifications';

export default function LoginScreen() {
  const googleSignIn = useAuthStore((s) => s.googleSignIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const handleGoogleSignIn = async () => {
    setError(null);
    const result = await googleSignIn();
    if (result.success) {
      requestNotificationPermission();
    } else {
      if (result.errorCode === 'CANCELLED') return;

      if (result.errorCode === 'NOT_IN_ROSTER') {
        setError('This email is not registered for GroveWars. Contact your coordinator.');
      } else {
        setError(result.errorMessage || 'Something went wrong.');
      }
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/ui/backgrounds/bg_login.png')}
      resizeMode="cover"
      style={styles.background}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            {/* Logo */}
            <Image
              source={require('@/assets/sprites/logo/logo_grovewars.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={styles.spacer} />

            {/* Sign in button */}
            {isLoading ? (
              <Image
                source={require('../assets/ui/buttons/btn_google_clicked.png')}
                style={styles.googleButton}
                resizeMode="contain"
              />
            ) : (
              <Pressable
                onPress={handleGoogleSignIn}
                style={({ pressed }) => [pressed && styles.buttonPressed]}
              >
                <ImageBackground
                  source={require('@/assets/ui/buttons/btn_google.png')}
                  resizeMode="contain"
                  style={styles.googleButton}
                />
              </Pressable>
            )}

            {/* Error message */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

          </View>

          {/* Elder Moss — absolutely positioned at bottom */}
          <Image
            source={require('@/assets/sprites/npc/npc_elder_moss.png')}
            style={styles.elderMoss}
            resizeMode="contain"
          />
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  safeArea: {
    flex: 1,
    position: 'relative',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
  },
  logo: {
    width: 420,
    height: 140,
    marginTop: 200,
  },
  spacer: {
    flex: 1,
  },
  elderMoss: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: 360,
    height: 290,
  },
  googleButton: {
    width: 320,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 250,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  errorText: {
    fontFamily: FONTS.pixel,
    fontSize: 17,
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 8,
  },
});
