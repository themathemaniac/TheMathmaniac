import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/auth';
import { apiClient } from '../api/client';

// Configure how notifications are displayed in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface PushNotificationContextType {
  registerForPushNotifications: () => Promise<void>;
}

const PushNotificationContext = createContext<PushNotificationContextType | undefined>(undefined);

export const usePushNotifications = () => {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error('usePushNotifications must be used within a PushNotificationProvider');
  }
  return context;
};

export const PushNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthStore();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  const registerForPushNotifications = async () => {
    try {
      if (Platform.OS === 'web') return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Push Notifications] Permission not granted to receive push notifications.');
        return;
      }

      // Retrieve project ID from Expo config
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        console.warn('[Push Notifications] Missing eas.projectId in app config. Skipping token generation.');
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const pushToken = tokenData.data;
      console.log('[Push Notifications] Expo Push Token retrieved:', pushToken);

      // Register the token to backend database if the user is authenticated
      if (user) {
        await apiClient.post('/profile/push-token', { pushToken });
        console.log('[Push Notifications] Stored push token successfully on server.');
      }
    } catch (error) {
      console.error('[Push Notifications] Error during registration:', error);
    }
  };

  useEffect(() => {
    // If user is authenticated, register push token
    if (user) {
      registerForPushNotifications();
    }
  }, [user]);

  useEffect(() => {
    // Listener called when a notification is received while the app is running in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Push Notifications] Notification received in foreground:', notification);
    });

    // Listener called when a user interacts with a notification (taps it)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[Push Notifications] User interacted with notification:', response);
    });

    // Configure notification channel for Android devices
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return (
    <PushNotificationContext.Provider value={{ registerForPushNotifications }}>
      {children}
    </PushNotificationContext.Provider>
  );
};
