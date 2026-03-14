import React, { useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { ClanId, ChestDrop } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useGameStore } from '@/store/useGameStore';
import { getTodayISTString } from '@/utils/time';
import * as mapApi from '@/api/map';
import MainMapScreen from '@/screens/MainMapScreen';
import ClanScoreboardScreen from '@/screens/ClanScoreboardScreen';
import PlayerProfileScreen from '@/screens/PlayerProfileScreen';
import AssetInventoryScreen from '@/screens/AssetInventoryScreen';
import QRScannerScreen from '@/screens/QRScannerScreen';
import MinigameSelectScreen from '@/screens/MinigameSelectScreen';
import MinigamePlayScreen from '@/screens/MinigamePlayScreen';
import ResultScreen from '@/screens/ResultScreen';
import SpaceDecorationScreen from '@/screens/SpaceDecorationScreen';
import CaptureCelebrationScreen from '@/screens/CaptureCelebrationScreen';
import SettingsScreen from '@/screens/SettingsScreen';

export type MainTabParamList = {
  Map: undefined;
  Clan: undefined;
  Profile: undefined;
  Inventory: undefined;
};

export type MainModalParamList = {
  Tabs: undefined;
  QRScanner: { locationId?: string; locationName?: string } | undefined;
  MinigameSelect: { locationId: string; locationName: string };
  MinigamePlay: {
    sessionId: string;
    minigameId: string;
    timeLimit: number;
    salt: string;
    locationId: string;
    locationName: string;
    puzzleData?: Record<string, unknown>;
    xpAvailable?: boolean;
  };
  Result: {
    result: 'win' | 'lose';
    xpEarned: number;
    xpAwarded?: boolean;
    newTodayXp?: number;
    clanTodayXp?: number;
    chestDrop?: ChestDrop;
    locationLocked?: boolean;
    locationId?: string;
    locationName?: string;
    minigameId?: string;
  };
  SpaceDecoration: { spaceId: string };
  CaptureCelebration: { clan: ClanId; spaceName: string };
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const ModalStack = createNativeStackNavigator<MainModalParamList>();

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
      {label}
    </Text>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: PALETTE.honeyGold,
        tabBarInactiveTintColor: PALETTE.stoneGrey,
      }}
    >
      <Tab.Screen
        name="Map"
        component={MainMapScreen}
        options={{
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Map" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Clan"
        component={ClanScoreboardScreen}
        options={{
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Clan" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={PlayerProfileScreen}
        options={{
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Profile" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={AssetInventoryScreen}
        options={{
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Inventory" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function MainStack() {
  // Connect WebSocket at the stack level so it persists across all screens
  useWebSocket();

  const navigation = useNavigation<NativeStackNavigationProp<MainModalParamList>>();
  const checkedRef = useRef(false);

  // On mount: check daily info for missed celebration, then check pending flag
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      // FIX 3: Daily info safety net — catch missed FCM + WS entirely
      try {
        const result = await mapApi.getDailyInfo();
        if (result.success && result.data) {
          const { status, winnerClan, targetSpace } = result.data;
          if (status === 'complete' && winnerClan) {
            const today = getTodayISTString();
            const { lastSeenCelebrationDate } = useGameStore.getState();
            if (lastSeenCelebrationDate !== today) {
              useGameStore.getState().setCelebrationPending(
                winnerClan,
                targetSpace.name,
              );
            }
          }
        }
      } catch {
        // Non-fatal — celebration will be missed if all channels fail
      }

      // FIX 4: Navigate to celebration if pending
      const { celebrationPending, pendingCelebrationClan, pendingCelebrationSpace } =
        useGameStore.getState();
      if (celebrationPending && pendingCelebrationClan && pendingCelebrationSpace) {
        navigation.navigate('CaptureCelebration', {
          clan: pendingCelebrationClan as ClanId,
          spaceName: pendingCelebrationSpace,
        });
      }
    })();
  }, [navigation]);

  return (
    <ModalStack.Navigator screenOptions={{ headerShown: false }}>
      <ModalStack.Screen name="Tabs" component={TabNavigator} />
      <ModalStack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <ModalStack.Screen
        name="MinigameSelect"
        component={MinigameSelectScreen}
        options={{ presentation: 'modal' }}
      />
      <ModalStack.Screen
        name="MinigamePlay"
        component={MinigamePlayScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <ModalStack.Screen
        name="Result"
        component={ResultScreen}
        options={{ presentation: 'modal' }}
      />
      <ModalStack.Screen
        name="SpaceDecoration"
        component={SpaceDecorationScreen}
        options={{ presentation: 'modal' }}
      />
      <ModalStack.Screen
        name="CaptureCelebration"
        component={CaptureCelebrationScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <ModalStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ presentation: 'modal' }}
      />
    </ModalStack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: PALETTE.parchmentBg,
    borderTopColor: PALETTE.warmBrown,
    borderTopWidth: 1,
    height: 50,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: PALETTE.stoneGrey,
  },
  tabLabelActive: {
    color: PALETTE.honeyGold,
    fontFamily: FONTS.bodyBold,
  },
});
