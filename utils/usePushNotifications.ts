import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import axios from 'axios';
import CONFIG from '../config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function saveTokenToBackend(userId: string, token: string) {
  try {
    const response = await axios.get(`${CONFIG.API_BASE_URL}/api.php`, {
      params: {
        api_key: CONFIG.API_KEY,
        transac: 'save_push_token',
        user_id: userId,
        push_token: token,
      },
    });
    console.log('Token saved to backend:', response.data);
   // alert('Success: Token saved to database!');
  } catch (err: any) {
    console.error('Failed to save push token', err.message);
    alert('API Error (Save Failed): ' + (err.message || 'Unknown error'));
  }
}

// Gets the native Firebase (FCM) token on Android
async function getFcmToken(): Promise<string | null> {
  if (!Device.isDevice) {
    alert('Error: Must use a physical device for notifications.');
    return null;
  }

  if (Platform.OS === 'android') {
    // Channel must exist before asking permission on Android 13+
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    alert('Error: Notification permission was denied.');
    return null;
  }

  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data as string;
    alert('FCM Token: ' + token.substring(0, 15) + '...');
    return token;
  } catch (e: any) {
    alert('Token Fetch Exception: ' + (e.message || JSON.stringify(e)));
    return null;
  }
}

// Call this right after login
export async function registerAndSavePushToken(userId: string) {
  const token = await getFcmToken();
  if (token) await saveTokenToBackend(userId, token);
}

// Runs on app start for users who are already logged in
export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId || userId === '0') return;

    registerAndSavePushToken(userId);

    // Re-save if Firebase rotates the token
    const sub = Notifications.addPushTokenListener(t => {
      saveTokenToBackend(userId, t.data as string);
    });
    return () => sub.remove();
  }, [userId]);
}