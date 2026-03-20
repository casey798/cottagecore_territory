import React, { useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import SpaceSentimentScreen from '@/screens/SpaceSentimentScreen';
import SpaceDecorationScreen from '@/screens/SpaceDecorationScreen';
import CaptureCelebrationScreen from '@/screens/CaptureCelebrationScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import CharacterCreationScreen from '@/screens/CharacterCreationScreen';
import SeasonSummaryScreen from '@/screens/SeasonSummaryScreen';
import FreeRoamCheckInScreen from '@/screens/FreeRoamCheckInScreen';

export type MainModalParamList = {
  Map: undefined;
  ClanScoreboard: undefined;
  PlayerProfile: undefined;
  AssetInventory: undefined;
  QRScanner: { locationId?: string; locationName?: string } | undefined;
  MinigameSelect: {
    locationId: string;
    locationName: string;
    practiceMode?: boolean;
    isCoopSession?: boolean;
    coopPartnerId?: string;
    coopPartnerDisplayName?: string;
  };
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
    sessionId?: string;
    practiceMode?: boolean;
    bonusXpTriggered?: boolean;
    linkedLocation?: { locationId: string; name: string } | null;
  };
  SpaceSentiment: {
    sessionId: string;
    locationName: string;
  };
  SpaceDecoration: {
    spaceId: string;
    spaceName: string;
    clan: ClanId;
    gridCells: Array<{ x: number; y: number }>;
    polygonPoints?: Array<{ x: number; y: number }>;
    userAssetId?: string;
  };
  CaptureCelebration: { clan: ClanId; spaceName: string };
  SeasonSummary: undefined;
  Settings: undefined;
  CharacterCreation: undefined;
  FreeRoamCheckIn: undefined;
};

const ModalStack = createNativeStackNavigator<MainModalParamList>();

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
      // Daily info safety net — catch missed FCM + WS entirely
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

      // Navigate to celebration if pending
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
      <ModalStack.Screen name="Map" component={MainMapScreen} />
      <ModalStack.Screen
        name="ClanScoreboard"
        component={ClanScoreboardScreen}
        options={{ presentation: 'modal' }}
      />
      <ModalStack.Screen
        name="PlayerProfile"
        component={PlayerProfileScreen}
        options={{ presentation: 'modal' }}
      />
      <ModalStack.Screen
        name="AssetInventory"
        component={AssetInventoryScreen}
        options={{ presentation: 'modal' }}
      />
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
        name="SpaceSentiment"
        component={SpaceSentimentScreen}
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
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
        name="SeasonSummary"
        component={SeasonSummaryScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <ModalStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ presentation: 'modal' }}
      />
      <ModalStack.Screen
        name="CharacterCreation"
        component={CharacterCreationScreen}
        options={{ presentation: 'modal' }}
      />
      <ModalStack.Screen
        name="FreeRoamCheckIn"
        component={FreeRoamCheckInScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
    </ModalStack.Navigator>
  );
}
