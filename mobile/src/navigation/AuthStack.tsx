import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '@/screens/LoginScreen';
import VerifyScreen from '@/screens/VerifyScreen';
import TutorialScreen from '@/screens/TutorialScreen';
import CharacterCreationScreen from '@/screens/CharacterCreationScreen';

export type AuthStackParamList = {
  Login: undefined;
  Verify: { email: string };
  Tutorial: undefined;
  CharacterCreation: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack({
  initialRouteName = 'Login',
}: {
  initialRouteName?: keyof AuthStackParamList;
}) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Verify" component={VerifyScreen} />
      <Stack.Screen name="Tutorial" component={TutorialScreen} />
      <Stack.Screen
        name="CharacterCreation"
        component={CharacterCreationScreen}
      />
    </Stack.Navigator>
  );
}
