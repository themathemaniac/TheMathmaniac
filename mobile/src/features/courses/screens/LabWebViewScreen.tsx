import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Smartphone } from 'lucide-react-native';

type LabWebViewRouteProp = {
  key: string;
  name: 'LabWebView';
  params: {
    url: string;
    title: string;
    redirectUrl?: string;
    gravitonLabTitle?: string;
  };
};

export const LabWebViewScreen: React.FC = () => {
  const route = useRoute<LabWebViewRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { url, title, redirectUrl, gravitonLabTitle } = route.params;
  const [loading, setLoading] = useState(true);
  const [isPortrait, setIsPortrait] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [hasRedirected, setHasRedirected] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const isNativeLab = url.includes('alchemax') || url.includes('graviton');

  useEffect(() => {
    let subscription: ScreenOrientation.Subscription;

    const setupOrientation = async () => {
      if (isNativeLab) {
        // Allow user to rotate their device
        await ScreenOrientation.unlockAsync();

        // Check initial orientation
        const orientation = await ScreenOrientation.getOrientationAsync();
        setIsPortrait(
          orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
          orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN
        );

        // Listen for orientation changes
        subscription = ScreenOrientation.addOrientationChangeListener((event) => {
          const newOrientation = event.orientationInfo.orientation;
          setIsPortrait(
            newOrientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
            newOrientation === ScreenOrientation.Orientation.PORTRAIT_DOWN
          );
        });
      }
    };

    setupOrientation();

    return () => {
      if (isNativeLab) {
        if (subscription) {
          ScreenOrientation.removeOrientationChangeListener(subscription);
        }
        // Lock back to portrait when exiting
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    };
  }, [isNativeLab]);

  // Handle animation for rotation prompt
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isNativeLab && isPortrait) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(500),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(500)
        ])
      ).start();
    } else {
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
    }
  }, [isPortrait, isNativeLab, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-90deg']
  });

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header - only show if NOT in landscape native lab */}
      {!(isNativeLab && !isPortrait) && (
        <View className="flex-row items-center px-4 pb-4 pt-12 border-b border-slate-800">
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="p-2 mr-2 bg-slate-900 rounded-full"
          >
            <Text className="text-white text-lg font-bold">←</Text>
          </TouchableOpacity>
          <Text className="text-slate-100 text-lg font-bold flex-1" numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}

      {/* WebView */}
      <View className="flex-1 relative">
        {loading && !(isNativeLab && isPortrait) && (
          <View className="absolute inset-0 justify-center items-center z-10 bg-slate-950">
            <ActivityIndicator size="large" color="#2D8C82" />
            <Text className="text-slate-400 mt-4 text-xs font-medium tracking-widest uppercase">Loading Lab...</Text>
          </View>
        )}
        
        {/* Landscape Prompt Overlay */}
        {isNativeLab && isPortrait && (
          <View className="absolute inset-0 bg-slate-50 z-20 justify-center items-center px-8">
            <View className="bg-white p-8 rounded-3xl items-center border border-slate-200 shadow-2xl w-full max-w-sm">
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Smartphone color="#0f172a" size={64} strokeWidth={1.5} />
              </Animated.View>
              <Text className="text-black text-xl font-bold mt-8 mb-2 text-center">
                Rotate Device
              </Text>
              <Text className="text-slate-600 text-center text-sm leading-6">
                Please rotate your phone to landscape mode to start the lab experience.
              </Text>
            </View>
          </View>
        )}

        {!(isNativeLab && isPortrait) && (
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          className="flex-1 bg-transparent"
          onLoadEnd={(syntheticEvent) => {
            setLoading(false);
            const loadedUrl = syntheticEvent.nativeEvent.url;
            
            if (!hasRedirected) {
              if (redirectUrl && (loadedUrl === url || loadedUrl === url + '/')) {
                setTimeout(() => {
                  setCurrentUrl(redirectUrl);
                  setHasRedirected(true);
                }, 1500);
              } else if (gravitonLabTitle && (loadedUrl === url || loadedUrl === url + '/')) {
                setTimeout(() => {
                  setCurrentUrl(url.replace(/\/$/, '') + '/workspace');
                  setHasRedirected(true);
                }, 1500);
              }
            } else if (hasRedirected && gravitonLabTitle && loadedUrl.includes('/workspace')) {
              // Inject JS to select the lab in Graviton
              const js = `
                setTimeout(function() {
                  let sidebar = document.querySelector('.overflow-y-auto');
                  if (!sidebar) {
                    const toggleBtn = document.querySelector('button[aria-label="Toggle Sidebar"]');
                    if (toggleBtn) toggleBtn.click();
                  }
                  
                  setTimeout(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const targetBtn = buttons.find(b => b.textContent.includes("${gravitonLabTitle}"));
                    if (targetBtn) targetBtn.click();
                    
                    setTimeout(() => {
                      const toggleBtn = document.querySelector('button[aria-label="Toggle Sidebar"]');
                      if (toggleBtn) toggleBtn.click();
                    }, 500);
                  }, 300);
                }, 1000);
                true;
              `;
              webViewRef.current?.injectJavaScript(js);
            }
          }}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
        />
        )}
      </View>
    </View>
  );
};
