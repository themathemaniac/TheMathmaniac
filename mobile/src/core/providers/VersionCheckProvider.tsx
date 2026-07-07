import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, SafeAreaView, ActivityIndicator } from 'react-native';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { apiClient } from '../api/client';

interface VersionCheckContextType {
  checking: boolean;
}

const VersionCheckContext = createContext<VersionCheckContextType | null>(null);

export const VersionCheckProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [needsNativeUpdate, setNeedsNativeUpdate] = useState(false);
  const [apkDownloadUrl, setApkDownloadUrl] = useState('');
  const [hasOtaUpdate, setHasOtaUpdate] = useState(false);

  // Hook for OTA updates status
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();

  // 1. Check Native Version on Mount
  useEffect(() => {
    const checkNativeVersion = async () => {
      try {
        const res = await apiClient.get('/app-config');
        if (res.data.success) {
          const { minAndroidVersionCode, apkDownloadUrl: url } = res.data;
          
          if (Platform.OS === 'android') {
            const currentVersionCode = parseInt(Application.nativeBuildVersion || '1', 10);
            if (!isNaN(currentVersionCode) && currentVersionCode < minAndroidVersionCode) {
              setApkDownloadUrl(url);
              setNeedsNativeUpdate(true);
              setChecking(false);
              return;
            }
          }
        }
      } catch (e) {
        console.error('[Version Check Error]', e);
      } finally {
        setChecking(false);
      }
    };

    checkNativeVersion();
  }, []);

  // 2. React to OTA updates status
  useEffect(() => {
    if (isUpdateAvailable && !isUpdatePending) {
      // Download the update
      Updates.fetchUpdateAsync().catch((err) => {
        console.log('[OTA Fetch Error]', err);
      });
    }
  }, [isUpdateAvailable, isUpdatePending]);

  useEffect(() => {
    if (isUpdatePending) {
      setHasOtaUpdate(true);
    }
  }, [isUpdatePending]);

  // 3. Continuous Background Update Polling (Runs every 30 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Skip checking if we are already in development or update is already downloaded
        if (__DEV__ || isUpdatePending) return;

        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          console.log('[OTA Check] New update found, downloading...');
          await Updates.fetchUpdateAsync();
        }
      } catch (err) {
        console.log('[Interval OTA Check Error]', err);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isUpdatePending]);

  const handleDownloadApk = () => {
    if (apkDownloadUrl) {
      Linking.openURL(apkDownloadUrl);
    }
  };

  const handleReloadApp = async () => {
    try {
      await Updates.reloadAsync();
    } catch (e) {
      console.error('[App Reload Error]', e);
    }
  };

  // Block the screen if the native app version is outdated
  if (needsNativeUpdate) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 justify-center items-center px-6">
        <View className="bg-slate-900 border border-slate-850 rounded-3xl p-6 w-full items-center shadow-2xl">
          <View className="w-16 h-16 bg-red-500/10 rounded-full justify-center items-center mb-5 border border-red-500/25">
            <Text className="text-red-400 text-3xl font-black">⚙</Text>
          </View>
          <Text className="text-slate-100 text-xl font-black mb-2 text-center">Update Required</Text>
          <Text className="text-slate-400 text-xs text-center mb-6 leading-5">
            A newer version of Mathemaniac is available. You must install the latest version to continue.
          </Text>
          <TouchableOpacity
            onPress={handleDownloadApk}
            className="w-full bg-[#2D8C82] border border-[#237068] py-4 rounded-2xl items-center shadow-lg"
          >
            <Text className="text-white text-xs font-black uppercase tracking-wider">Download latest APK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <VersionCheckContext.Provider value={{ checking }}>
      {children}
      
      {/* Premium dark/indigo OTA update ready banner */}
      {hasOtaUpdate && (
        <SafeAreaView className="absolute top-5 left-5 right-5 z-[99999]">
          <TouchableOpacity
            onPress={handleReloadApp}
            activeOpacity={0.95}
            className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex-row justify-between items-center shadow-2xl shadow-indigo-500/10 active:opacity-90"
          >
            <View className="flex-1 mr-4">
              <View className="flex-row items-center gap-2">
                <View className="w-2 h-2 rounded-full bg-indigo-400" />
                <Text className="text-slate-100 text-sm font-black tracking-wide">New Update Available</Text>
              </View>
              <Text className="text-slate-400 text-[11px] mt-1.5 leading-4">
                Click reload to apply the latest features and fixes instantly.
              </Text>
            </View>
            <View className="bg-indigo-600 border border-indigo-500 px-4 py-2.5 rounded-2xl shadow-lg shadow-indigo-600/20">
              <Text className="text-white text-[10px] font-black uppercase tracking-wider">Reload Now</Text>
            </View>
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </VersionCheckContext.Provider>
  );
};

export const useVersionCheck = () => {
  const context = useContext(VersionCheckContext);
  if (!context) {
    throw new Error('useVersionCheck must be used within a VersionCheckProvider');
  }
  return context;
};
