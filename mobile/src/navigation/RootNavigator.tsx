import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/useAuthStore';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import LoginScreen from '@/screens/LoginScreen';
import TutorialScreen from '@/screens/TutorialScreen';
import { MainStack } from './MainStack';

export type RootStackParamList = {
  Login: undefined;
  Tutorial: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingTitle}>GroveWars</Text>
      <ActivityIndicator size="large" color={PALETTE.honeyGold} style={{ marginTop: 16 }} />
    </View>
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
    return <LoadingScreen />;
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PALETTE.parchmentBg,
  },
  loadingTitle: {
    fontSize: 36,
    fontFamily: FONTS.headerBold,
    color: PALETTE.darkBrown,
  },
});
