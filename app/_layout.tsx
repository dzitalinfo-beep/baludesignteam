import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router, Slot } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { usePushNotifications } from '../utils/usePushNotifications';

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  }
};

export default function RootLayout() {
  const [userId, setUserId] = useState<string | null>(null);

  // Automatically fetch logged-in user ID from storage
  useEffect(() => {
    async function loadUser() {
      const id = await storage.get('user_id');
      if (id) setUserId(id);
    }
    loadUser();
  }, []);

  // Trigger push notification token registration for this user
  usePushNotifications(userId);

  // Handle notification response listener when tapped
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.screen === 'search-jobs') {
        router.push('/search-jobs');
      }
    });

    return () => subscription.remove();
  }, []);

  return <Slot />;
}