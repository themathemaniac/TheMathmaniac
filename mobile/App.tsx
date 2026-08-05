import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppNavigator } from './src/navigation/AppNavigator';
import { VersionCheckProvider } from './src/core/providers/VersionCheckProvider';
import { PushNotificationProvider } from './src/core/providers/PushNotificationProvider';
import { Text, TextInput, StyleSheet } from 'react-native';
import {
  useFonts,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';

import { enableScreens } from 'react-native-screens';
import './src/features/teacher/tasks/GeofenceTask';

enableScreens(true);

// Set default typography to Poppins across React Native Text and TextInput components
const setGlobalFont = () => {
  try {
    const customTextProps = {
      ...((Text as any).defaultProps || {}),
      style: [ { fontFamily: 'Poppins_400Regular' } ],
    };
    (Text as any).defaultProps = customTextProps;

    const customTextInputProps = {
      ...((TextInput as any).defaultProps || {}),
      style: [ { fontFamily: 'Poppins_400Regular' } ],
    };
    (TextInput as any).defaultProps = customTextInputProps;

    const oldTextRender = (Text as any).render;
    if (oldTextRender) {
      (Text as any).render = function (...args: any[]) {
        const origin = oldTextRender.call(this, ...args);
        if (!origin) return origin;
        const flatStyle = StyleSheet.flatten([ { fontFamily: 'Poppins_400Regular' }, origin.props.style ]);
        let customFontFamily = 'Poppins_400Regular';
        if (flatStyle && flatStyle.fontWeight) {
          const fw = String(flatStyle.fontWeight);
          if (fw === '300' || fw === 'light') customFontFamily = 'Poppins_300Light';
          else if (fw === '400' || fw === 'normal') customFontFamily = 'Poppins_400Regular';
          else if (fw === '500' || fw === 'medium') customFontFamily = 'Poppins_500Medium';
          else if (fw === '600' || fw === 'semibold') customFontFamily = 'Poppins_600SemiBold';
          else if (fw === '700' || fw === 'bold') customFontFamily = 'Poppins_700Bold';
          else if (fw === '800' || fw === 'extrabold') customFontFamily = 'Poppins_800ExtraBold';
          else if (fw === '900' || fw === 'black') customFontFamily = 'Poppins_900Black';
        }
        return React.cloneElement(origin, {
          style: [ origin.props.style, { fontFamily: customFontFamily } ],
        });
      };
    }
  } catch (e) {
    console.warn('Failed to set global font:', e);
  }
};
setGlobalFont();

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
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  if (!fontsLoaded) {
    return null;
  }

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
