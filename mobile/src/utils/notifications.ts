import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { updateFcmToken } from '@/api/player';

export async function registerFcmToken(token: string): Promise<void> {
  try {
    const result = await updateFcmToken(token);
    if (result.success) {
      console.log('[FCM] Token registered with backend');
    } else {
      console.warn('[FCM] Failed to register token:', result.error?.message);
    }
  } catch (err) {
    console.warn('[FCM] Error registering token:', err);
  }
}

export async function requestNotificationPermission(): Promise<void> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      console.log('[FCM] Android POST_NOTIFICATIONS result:', result);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('[FCM] Android notification permission denied');
        return;
      }
    }

    const authStatus = await messaging().requestPermission();
    const granted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (granted) {
      console.log('[FCM] Permission granted, status:', authStatus);
      const token = await messaging().getToken();
      console.log('[FCM] Token obtained:', token ? token.substring(0, 20) + '...' : 'NONE');
      if (token) {
        await registerFcmToken(token);
      }
    } else {
      console.log('[FCM] Permission denied, status:', authStatus);
    }
  } catch (err) {
    console.warn('[FCM] Permission request error:', err);
  }
}
