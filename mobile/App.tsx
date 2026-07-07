import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppNavigator } from './src/navigation/AppNavigator';
import { VersionCheckProvider } from './src/core/providers/VersionCheckProvider';
import { PushNotificationProvider } from './src/core/providers/PushNotificationProvider';

import { enableScreens } from 'react-native-screens';

enableScreens(true);

// Configure TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <VersionCheckProvider>
          <PushNotificationProvider>
            <StatusBar style="light" />
            <AppNavigator />
          </PushNotificationProvider>
        </VersionCheckProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
