import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  ImageBackground,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/useAuthStore';
import LoginScreen from '@/screens/LoginScreen';
import TutorialScreen from '@/screens/TutorialScreen';
import { MainStack } from './MainStack';

export type RootStackParamList = {
  Login: undefined;
  Tutorial: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function SplashScreen() {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <ImageBackground
      source={require('@/assets/ui/backgrounds/bg_splash.png')}
      resizeMode="cover"
      style={styles.splashBg}
    >
      <View style={styles.splashContent}>
        <Image
          source={require('@/assets/sprites/logo/logo_grovewars.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <Animated.Image
          source={require('@/assets/ui/icons/spinner_leaf.png')}
          style={[styles.splashSpinner, { transform: [{ rotate: spin }] }]}
          resizeMode="contain"
        />
      </View>
    </ImageBackground>
  );
}

export function RootNavigator() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tutorialDone = useAuthStore((s) => s.tutorialDone);
  const tutorialSkipped = useAuthStore((s) => s.tutorialSkipped);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const logout = useAuthStore((s) => s.logout);

  const [sessionChecked, setSessionChecked] = React.useState(false);

  // After Zustand rehydrates persisted state, verify the token is still valid
  // before rendering the main app. This prevents the map screen from firing
  // API calls with a stale or missing token.
  React.useEffect(() => {
    if (!isHydrated) return;

    if (isAuthenticated) {
      restoreSession()
        .then((valid) => {
          if (!valid) {
            // Token is stale or Keychain is empty — send user to login
            logout();
          }
        })
        .finally(() => setSessionChecked(true));
    } else {
      // Not authenticated — nothing to verify
      setSessionChecked(true);
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  if (!isHydrated || !sessionChecked) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !tutorialDone && !tutorialSkipped ? (
          <Stack.Screen name="Tutorial" component={TutorialScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splashBg: {
    flex: 1,
  },
  splashContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: 450,
    height: 150,
  },
  splashSpinner: {
    width: 48,
    height: 48,
    marginTop: 24,
  },
});
