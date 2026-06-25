import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { useVideoPlayer, VideoView } from 'expo-video';

type OnboardingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Onboarding'>;

interface Props {
  navigation: OnboardingScreenNavigationProp;
}

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const videoSource = require('../../../../assets/intro.mp4');
  const player = useVideoPlayer(videoSource, player => {
    player.loop = false;
    player.play();
  });

  const handleFinish = () => {
    navigation.replace('Login');
  };

  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      handleFinish();
    });
    return () => {
      subscription?.remove();
    };
  }, [player]);

  return (
    <View style={styles.container}>
      <VideoView
        style={styles.video}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  }
});
