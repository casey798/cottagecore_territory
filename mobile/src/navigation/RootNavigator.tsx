import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/useAuthStore';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import LoginScreen from '@/screens/LoginScreen';
import VerifyScreen from '@/screens/VerifyScreen';
import TutorialScreen from '@/screens/TutorialScreen';
import { MainStack } from './MainStack';

export type RootStackParamList = {
  Login: undefined;
  Verify: { email: string };
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

  if (!isHydrated) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Verify" component={VerifyScreen} />
          </>
        ) : !tutorialDone ? (
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
