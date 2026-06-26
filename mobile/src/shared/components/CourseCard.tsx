import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
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
  teacherName?: string;
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
  teacherName,
}) => {
  const formattedPrice = price === 0 ? 'FREE' : `₹${(price / 100).toLocaleString('en-IN')}`;

  if (horizontal) {
    return (
      <TouchableOpacity
        onPress={onPress}
        className="mb-4 rounded-2xl overflow-hidden active:opacity-90 shadow-lg border-2 border-slate-900 bg-white"
        activeOpacity={0.85}
      >
        <View className="flex-row p-3 rounded-2xl relative">

          <Image
            source={thumbnailUrl ? { uri: thumbnailUrl } : undefined}
            className="w-24 h-24 rounded-xl bg-slate-200"
            resizeMode="cover"
          />
          <View className="flex-1 ml-4 justify-between">
            <View>
              <Text className="text-xs font-bold text-amber-600 uppercase tracking-wider">{category}</Text>
              <Text className="text-sm font-semibold text-slate-900 mt-1" numberOfLines={2}>
                {title}
              </Text>
              {teacherName && (
                <Text className="text-xs text-slate-500 mt-1 font-medium" numberOfLines={1}>
                  Teacher: {teacherName}
                </Text>
              )}
            </View>
            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-xs text-slate-500 font-medium">{lectureCount} Lectures</Text>
              <Text className="text-sm font-bold text-blue-600">
                {isPurchased ? 'Unlocked' : formattedPrice}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      className="w-[280px] mr-4 rounded-3xl overflow-hidden active:opacity-95 shadow-xl border-2 border-slate-800 bg-white"
      activeOpacity={0.9}
    >
      <View className="rounded-3xl relative h-[330px] justify-between overflow-hidden">
        <Image
          source={thumbnailUrl ? { uri: thumbnailUrl } : undefined}
          className="w-full h-32 bg-slate-200"
          resizeMode="cover"
        />
        <View className="p-4 flex-1 justify-between">
          <View>
            <View className="flex-row justify-between items-center">
              <Text className="text-xs font-bold text-amber-600 uppercase tracking-wider">{category}</Text>
              <Text className="text-xs text-slate-500 font-medium">{lectureCount} Lectures</Text>
            </View>
            <Text className="text-base font-semibold text-slate-900 mt-2" numberOfLines={2}>
              {title}
            </Text>
            {teacherName && (
              <Text className="text-sm text-slate-500 mt-1 font-medium" numberOfLines={1}>
                Teacher: {teacherName}
              </Text>
            )}
          </View>

          <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-slate-200">
            <Text className="text-base font-bold text-blue-600">
              {isPurchased ? 'Unlocked' : formattedPrice}
            </Text>
            <View className="bg-blue-100 px-3 py-1.5 rounded-full border border-blue-200">
              <Text className="text-xs font-semibold text-blue-600">
                {isPurchased ? 'Start Study' : 'Get Course'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

