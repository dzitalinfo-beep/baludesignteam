import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
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
  if (!userId || userId === '0' || userId === 'null') {
    console.log('Skipping token save: Invalid User ID');
    return;
  }

  try {
    const url = `${CONFIG.API_BASE_URL}/api.php?api_key=${CONFIG.API_KEY}&transac=save_push_token`;
    console.log('Sending token via POST to URL:', url, { user_id: userId, token_length: token.length });

    const response = await axios.post(
      url,
      {
        user_id: String(userId),
        push_token: token,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 15000,
      }
    );

    console.log('Token saved to backend response:', response.data);

    if (response.data && response.data.status === 'success') {
      Alert.alert('Database Success', 'Token successfully saved to MySQL database!');
    } else {
      Alert.alert('PHP Server Error', 'Response: ' + JSON.stringify(response.data));
    }
  } catch (err: any) {
    console.error('Failed to save push token on server', err);
    let errorMsg = err.message;
    if (err.response) {
      errorMsg = `Server Status ${err.response.status}: ${JSON.stringify(err.response.data)}`;
    }
    Alert.alert('Database/API Failed', errorMsg);
  }
}

async function getFcmToken(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
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
    return null;
  }

  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data as string;
    
    console.log('Full Raw Native FCM Token:', token);
    await Clipboard.setStringAsync(token);

    return token;
  } catch (e: any) {
    console.error('Token Fetch Exception:', e);
    return null;
  }
}

export async function registerAndSavePushToken(userId: string) {
  if (!userId || userId === '0') return;
  const token = await getFcmToken();
  if (token) {
    await saveTokenToBackend(userId, token);
  }
}

export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId || userId === '0' || userId === 'null') return;

    registerAndSavePushToken(userId);

    const sub = Notifications.addPushTokenListener(t => {
      if (t?.data) {
        saveTokenToBackend(userId, t.data as string);
      }
    });

    return () => sub.remove();
  }, [userId]);
}