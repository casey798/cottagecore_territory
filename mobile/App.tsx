import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import messaging from '@react-native-firebase/messaging';
import { lockPortrait } from './src/hooks/useScreenOrientation';
import { RootNavigator } from './src/navigation/RootNavigator';
import { registerFcmToken } from './src/utils/notifications';
import { useGameStore } from './src/store/useGameStore';

function App(): React.JSX.Element {
  useEffect(() => {
    lockPortrait();

    const unsubscribe = messaging().onTokenRefresh((token) => {
      console.log('[FCM] Token refreshed');
      registerFcmToken(token);
    });

    return unsubscribe;
  }, []);

  // FCM foreground message handler
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      if (remoteMessage.data?.type === 'CAPTURE_RESULT') {
        const clan = remoteMessage.data.winnerClan as string;
        const spaceName = remoteMessage.data.spaceName as string;
        if (clan && spaceName) {
          useGameStore.getState().setCelebrationPending(clan, spaceName);
        }
      }
    });
    return unsubscribe;
  }, []);

  // FCM quit-state: user tapped notification to open the app
  useEffect(() => {
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage?.data?.type === 'CAPTURE_RESULT') {
          const clan = remoteMessage.data.winnerClan as string;
          const spaceName = remoteMessage.data.spaceName as string;
          if (clan && spaceName) {
            useGameStore.getState().setCelebrationPending(clan, spaceName);
          }
        }
      });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar hidden />
      <RootNavigator />
    </GestureHandlerRootView>
  );
}

export default App;
