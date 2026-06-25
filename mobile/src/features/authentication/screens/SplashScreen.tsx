import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '../../../core/store/auth';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { useVideoPlayer, VideoView } from 'expo-video';

type SplashScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Splash'>;

interface Props {
  navigation: SplashScreenNavigationProp;
}

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const { initializeAuth, isAuthenticated } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [videoFinished, setVideoFinished] = useState(false);

  const videoSource = require('../../../../assets/loading.mp4');
  const player = useVideoPlayer(videoSource, player => {
    player.loop = false;
    player.play();
  });

  useEffect(() => {
    const checkAuth = async () => {
      await initializeAuth();
      setAuthChecked(true);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      setVideoFinished(true);
    });
    return () => {
      subscription?.remove();
    };
  }, [player]);

  useEffect(() => {
    if (videoFinished && authChecked) {
      if (isAuthenticated) {
        navigation.replace('AppTabs', { screen: 'Home' });
      } else {
        navigation.replace('Login');
      }
    }
  }, [videoFinished, authChecked, isAuthenticated]);

  return (
    <View style={styles.container}>
      <VideoView
        style={styles.video}
        player={player}
        contentFit="contain" // Ensures the video is not cropped, so characters are fully visible
        nativeControls={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Assuming the background of the new video is off-white or white
    // If it's pure white, change this to #FFFFFF.
    backgroundColor: '#EAE7DF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%', // Allow contain to figure out aspect ratio
    transform: [{ scale: 1.7 }], // Slight zoom
  }
});
