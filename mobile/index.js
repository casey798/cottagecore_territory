/**
 * @format
 */

import '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// FCM background message handler — must be registered before AppRegistry
setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
  if (remoteMessage.data?.type === 'CAPTURE_RESULT') {
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    const raw = await AsyncStorage.default.getItem('grove-wars-game');
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.state.celebrationPending = true;
      parsed.state.pendingCelebrationClan = remoteMessage.data.winnerClan;
      parsed.state.pendingCelebrationSpace = remoteMessage.data.spaceName;
      await AsyncStorage.default.setItem('grove-wars-game', JSON.stringify(parsed));
    }
  }
});

AppRegistry.registerComponent(appName, () => App);
