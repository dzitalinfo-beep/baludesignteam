import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
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

export function usePushNotifications(userId: string | null) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        saveTokenToBackend(userId, token);
      }
    });
  }, [userId]);

  return { expoPushToken };
}

async function saveTokenToBackend(userId: string, token: string) {
  try {
    const response = await axios.get(`${CONFIG.API_BASE_URL}/api.php`, {
      params: {
        api_key: CONFIG.API_KEY,
        transac: 'save_push_token',
        user_id: userId,
        push_token: token
      }
    });
    
    // Visual debug confirmation on your standalone phone screen
    alert('Success: Token saved to database!');
  } catch (err: any) {
    // Visual debug if your PHP server or network connection fails
    alert('API Error: ' + (err.message || 'Network request failed'));
    console.error('Failed to save push token on server', err);
  }
}

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    alert('Must use physical device for Push Notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    alert('Failed to get push token permission!');
    return null;
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (e: any) {
    // Visual debug if Firebase/FCM configuration fails inside standalone APK
    alert('Token Fetch Error: ' + (e.message || JSON.stringify(e)));
    console.error('Error fetching push token:', e);
    return null;
  }
}