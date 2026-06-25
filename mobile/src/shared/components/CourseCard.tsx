import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface CourseCardProps {
  id: string;
  title: string;
  category: string;
  price: number;
  thumbnailUrl: string;
  lectureCount: number;
  isPurchased?: boolean;
  onPress: () => void;
  horizontal?: boolean;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  id,
  title,
  category,
  price,
  thumbnailUrl,
  lectureCount,
  isPurchased = false,
  onPress,
  horizontal = false,
}) => {
  const formattedPrice = price === 0 ? 'FREE' : `₹${(price / 100).toLocaleString('en-IN')}`;

  if (horizontal) {
    return (
      <TouchableOpacity
        onPress={onPress}
        className="mb-4 rounded-2xl overflow-hidden active:opacity-90 shadow-lg"
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#1e293b', '#020617']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="flex-row p-3 rounded-2xl border border-slate-800 relative"
        >
          
          <Image
            source={thumbnailUrl ? { uri: thumbnailUrl } : undefined}
            className="w-24 h-24 rounded-xl"
            resizeMode="cover"
          />
          <View className="flex-1 ml-4 justify-between">
            <View>
              <Text className="text-xs font-bold text-amber-500 uppercase tracking-wider">{category}</Text>
              <Text className="text-sm font-semibold text-slate-100 mt-1" numberOfLines={2}>
                {title}
              </Text>
            </View>
            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-xs text-slate-400">{lectureCount} Lectures</Text>
              <Text className="text-sm font-bold text-blue-400">
                {isPurchased ? 'Unlocked' : formattedPrice}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      className="w-[280px] mr-4 rounded-3xl overflow-hidden active:opacity-95 shadow-xl"
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={['#1e293b', '#020617']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-3xl border border-slate-800 relative h-[330px] justify-between overflow-hidden"
      >

        <Image
          source={thumbnailUrl ? { uri: thumbnailUrl } : undefined}
          className="w-full h-32"
          resizeMode="cover"
        />
        <View className="p-4 flex-1 justify-between">
          <View>
            <View className="flex-row justify-between items-center">
              <Text className="text-xs font-bold text-amber-500 uppercase tracking-wider">{category}</Text>
              <Text className="text-xs text-slate-400">{lectureCount} Lectures</Text>
            </View>
            <Text className="text-base font-semibold text-slate-100 mt-2" numberOfLines={2}>
              {title}
            </Text>
          </View>

          <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-slate-800">
            <Text className="text-base font-bold text-blue-400">
              {isPurchased ? 'Unlocked' : formattedPrice}
            </Text>
            <View className="bg-blue-600/20 px-3 py-1.5 rounded-full border border-blue-500/30">
              <Text className="text-xs font-semibold text-blue-400">
                {isPurchased ? 'Start Study' : 'Get Course'}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

