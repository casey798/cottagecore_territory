import React, { useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ClanId, ChestDrop } from '@/types';
import { PlacedDecorationAsset } from '@/api/spaces';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { getTodayISTString } from '@/utils/time';
import * as mapApi from '@/api/map';
import MainMapScreen from '@/screens/MainMapScreen';
import ClanScoreboardScreen from '@/screens/ClanScoreboardScreen';
import PlayerProfileScreen from '@/screens/PlayerProfileScreen';
// AssetInventory import kept for type safety — screen registration disabled
import AssetInventoryScreen from '@/screens/AssetInventoryScreen';
import QRScannerScreen from '@/screens/QRScannerScreen';
import MinigameSelectScreen from '@/screens/MinigameSelectScreen';
import MinigamePlayScreen from '@/screens/MinigamePlayScreen';
import ResultScreen from '@/screens/ResultScreen';
import SpaceSentimentScreen from '@/screens/SpaceSentimentScreen';
import SpaceDecorationScreen from '@/screens/SpaceDecorationScreen';
import DecorationSurveyScreen from '@/screens/DecorationSurveyScreen';
import CaptureCelebrationScreen from '@/screens/CaptureCelebrationScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import CharacterCreationScreen from '@/screens/CharacterCreationScreen';
import SeasonSummaryScreen from '@/screens/SeasonSummaryScreen';
import FreeRoamCheckInScreen from '@/screens/FreeRoamCheckInScreen';
import JournalScreen from '@/screens/JournalScreen';
import TermsAndConditionsScreen from '@/screens/TermsAndConditionsScreen';

// Suppress unused import warning — AssetInventoryScreen kept for type references
void AssetInventoryScreen;

export type MainModalParamList = {
  Map: { clearedSpaceId?: string } | undefined;
  ClanScoreboard: undefined;
  PlayerProfile: undefined;
  AssetInventory: {
    fromSpaceId?: string;
    fromSpaceName?: string;
    fromSpaceClan?: ClanId;
    fromSpaceGridCells?: Array<{ x: number; y: number }>;
    fromSpacePolygonPoints?: Array<{ x: number; y: number }>;
  } | undefined;
  QRScanner: {
    locationId?: string;
    locationName?: string;
    mode?: 'location' | 'space';
  } | undefined;
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
    lockedUntil?: string;
    locationId?: string;
    locationName?: string;
    minigameId?: string;
    sessionId?: string;
    practiceMode?: boolean;
  };
  SpaceSentiment: {
    sessionId: string;
    locationId: string;
    locationName: string;
  };
  SpaceDecoration: {
    spaceId: string;
    spaceName: string;
    gridCells: Array<{ col: number; row: number }>;
    gridColumns: number;
    gridRows: number;
    polygonPoints?: Array<{ x: number; y: number }>;
  };
  DecorationSurvey: {
    spaceId: string;
    spaceName: string;
    placedAssets: PlacedDecorationAsset[];
    screenshotBase64: string;
  };
  CaptureCelebration: { clan: ClanId; spaceName: string };
  SeasonSummary: undefined;
  Settings: undefined;
  CharacterCreation: undefined;
  FreeRoamCheckIn: undefined;
  Journal: undefined;
  TermsAndConditions: { mode: 'consent' | 'view' };
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

    // Issue #19: If user skipped tutorial without creating a character,
    // redirect to CharacterCreation before anything else.
    // Guard on isHydrated so we never fire before AsyncStorage has been read —
    // displayName/selectedPresetId are transiently null during rehydration and
    // would otherwise redirect every returning user on first render.
    // Also guard on tutorialSkipped: only users who bailed out of the tutorial
    // before Scene 6 need this redirect; tutorialDone users already have a character.
    const { isHydrated, tutorialSkipped, displayName, selectedPresetId } =
      useAuthStore.getState();
    if (isHydrated && tutorialSkipped && (!displayName || selectedPresetId == null)) {
      navigation.navigate('CharacterCreation');
    }

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
      {/* AssetInventory screen registration disabled — old inventory flow removed */}
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
        name="DecorationSurvey"
        component={DecorationSurveyScreen}
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
      <ModalStack.Screen
        name="Journal"
        component={JournalScreen}
        options={{ presentation: 'modal' }}
      />
      <ModalStack.Screen
        name="TermsAndConditions"
        component={TermsAndConditionsScreen}
        options={{ presentation: 'modal' }}
      />
    </ModalStack.Navigator>
  );
}
