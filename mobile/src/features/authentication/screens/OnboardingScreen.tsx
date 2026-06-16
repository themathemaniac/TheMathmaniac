import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { Button } from '../../../shared/components/Button';

type OnboardingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Onboarding'>;

interface Props {
  navigation: OnboardingScreenNavigationProp;
}

const { width } = Dimensions.get('window');

const slides = [
  {
    title: 'Learn Math, Mathemaniac Style',
    description: 'Instant, bite-sized lessons, formula sheets, and mock tests at your fingertips. No bloat, just speed.',
    icon: '⚡',
    color: 'text-blue-500',
  },
  {
    title: 'Premium Video Learning',
    description: 'Interactive chapter markers, playback speeds, and auto-resume. Designed for short attention spans.',
    icon: '🎬',
    color: 'text-emerald-400',
  },
  {
    title: 'Gamified Practice Quizzes',
    description: 'Solve single correct, multi-correct, and numericals. View instant leaderboard standings.',
    icon: '🏆',
    color: 'text-amber-400',
  },
];

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      const nextSlide = currentSlide + 1;
      scrollViewRef.current?.scrollTo({ x: nextSlide * width, animated: true });
      setCurrentSlide(nextSlide);
    } else {
      navigation.replace('Login');
    }
  };

  const handleSkip = () => {
    navigation.replace('Login');
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / width);
    setCurrentSlide(index);
  };

  return (
    <View className="flex-1 bg-slate-950 justify-between pt-16 pb-12">
      {/* Header Skip */}
      <View className="flex-row justify-end px-6">
        <TouchableOpacity onPress={handleSkip}>
          <Text className="text-slate-400 text-sm font-medium">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Main Slide Carousel Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        className="flex-1 my-auto"
      >
        {slides.map((slide, index) => (
          <View key={index} style={{ width }} className="items-center justify-center px-12">
            <Text className="text-8xl mb-8">{slide.icon}</Text>
            <Text className="text-slate-100 text-2xl font-bold text-center">
              {slide.title}
            </Text>
            <Text className="text-slate-400 text-sm text-center mt-4 leading-6">
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Slide Indicators & Buttons */}
      <View className="w-full px-6">
        {/* Indicators */}
        <View className="flex-row justify-center mb-8">
          {slides.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full mx-1 ${
                index === currentSlide ? 'w-6 bg-blue-600' : 'w-2 bg-slate-700'
              }`}
            />
          ))}
        </View>

        {/* Action Button */}
        <Button
          title={currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          variant="primary"
        />
      </View>
    </View>
  );
};

