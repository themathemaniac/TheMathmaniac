import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { apiClient } from '../../../core/api/client';
import { Button } from '../../../shared/components/Button';
import { Skeleton } from '../../../shared/components/Skeleton';
import { extractThemeColor } from '../../../core/constants/courseThemes';

type CourseDetailsRouteProp = RouteProp<RootStackParamList, 'CourseDetails'>;
type CourseDetailsNavigationProp = StackNavigationProp<RootStackParamList, 'CourseDetails'>;

interface Props {
  route: CourseDetailsRouteProp;
}

export const CourseDetailsScreen: React.FC<Props> = ({ route }) => {
  const { courseId } = route.params;
  const navigation = useNavigation<CourseDetailsNavigationProp>();
  const [course, setCourse] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const fetchCourseDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/courses/${courseId}`);
      setCourse(response.data.data);
    } catch (e) {
      console.log('Error fetching course details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseDetails();
  }, [courseId]);

  const handleLecturePress = (lectureId: string) => {
    if (course?.isPurchased || course?.price === 0) {
      navigation.navigate('LecturePlayer', { lectureId });
    } else {
      Alert.alert('Course Locked', 'Please enroll in the course to unlock video lectures and study resources.');
    }
  };

  const handlePurchase = async () => {
    if (!course) return;
    try {
      setPurchaseLoading(true);
      const response = await apiClient.post('/payments/order', { courseId });
      const { orderId, amount, courseTitle } = response.data.data;

      // Navigate to web checkout simulator
      navigation.navigate('PurchaseWebview', {
        courseId,
        orderId,
        amount,
        title: courseTitle,
      });
    } catch (e: any) {
      Alert.alert('Payment Order Error', e.response?.data?.error || 'Unable to create payment order.');
    } finally {
      setPurchaseLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 px-6 pt-16">
        <Skeleton height={200} borderRadius={24} />
        <Skeleton height={30} className="mt-6" />
        <Skeleton height={100} className="mt-4" />
        <Skeleton height={200} className="mt-6" />
      </View>
    );
  }

  if (!course) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center px-6">
        <Text className="text-slate-100 text-base">Course details could not be loaded.</Text>
      </View>
    );
  }

  const formattedPrice = course.price === 0 ? 'FREE' : `₹${(course.price / 100).toLocaleString('en-IN')}`;
  const themeColor = extractThemeColor(course.thumbnailUrl);
  const cardStyle = themeColor ? { borderColor: themeColor } : {};

  return (
    <View className="flex-1 bg-slate-950">
      {/* Scrollable Details */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Course Teaser/Image Block */}
        <View className="relative">
          <Image source={course.thumbnailUrl ? { uri: course.thumbnailUrl } : undefined} className="w-full h-56" resizeMode="cover" />
          <TouchableOpacity
            className="absolute left-6 top-14 w-10 h-10 bg-slate-900/80 rounded-full justify-center items-center border border-slate-700/50"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-slate-100 text-lg font-bold">←</Text>
          </TouchableOpacity>
        </View>

        <View className="p-6">
          <Text className="text-xs font-bold text-blue-400 uppercase tracking-widest">
            {course.category.name}
          </Text>
          <Text className="text-slate-100 text-2xl font-black mt-2 leading-8">{course.title}</Text>

          {course.teachers && course.teachers.length > 0 && (
            <View className="mt-4 border rounded-2xl p-4" style={[{ backgroundColor: '#0f172a', borderColor: '#1e293b' }, cardStyle]}>
              <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3" style={themeColor ? { color: themeColor } : {}}>Assigned Faculty</Text>
              {course.teachers.map((t: any) => (
                <View key={t.user.id} className="flex-row items-center mb-2">
                  <View className="w-8 h-8 bg-blue-900/50 rounded-full items-center justify-center mr-3 border border-blue-500/30">
                    <Text className="text-blue-400 font-bold text-xs">{t.user.name.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text className="text-slate-200 font-bold text-xs">{t.user.name}</Text>
                    {t.user.subjects && (
                      <Text className="text-blue-400 text-[10px] font-medium">{t.user.subjects}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 10-Second Value Outcomes */}
          <View className="border rounded-3xl p-5 mt-6" style={[{ backgroundColor: '#0f172a', borderColor: '#1e293b' }, cardStyle]}>
            <Text className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3" style={themeColor ? { color: themeColor } : {}}>
              ⚡ What you will learn
            </Text>
            {course.learningOutcomes.map((outcome: string, idx: number) => (
              <View key={idx} className="flex-row items-start mt-2">
                <Text className="text-emerald-400 text-sm font-bold mr-2">✓</Text>
                <Text className="text-slate-200 text-xs leading-5 flex-1">{outcome}</Text>
              </View>
            ))}
          </View>

          {/* Description */}
          <Text className="text-slate-100 text-base font-bold mt-8">About Course</Text>
          <Text className="text-slate-400 text-xs leading-6 mt-3">{course.description}</Text>

          {/* Syllabus Outline */}
          <Text className="text-slate-100 text-base font-bold mt-8 mb-4">Syllabus ({course.lectureCount} Lessons)</Text>
          {course.lectures.map((lecture: any) => {
            const hasAccess = course.isPurchased || course.price === 0;
            return (
              <TouchableOpacity
                key={lecture.id}
                onPress={() => handleLecturePress(lecture.id)}
                className="border rounded-2xl p-4 mb-3 flex-row items-center justify-between"
                style={[{ backgroundColor: '#0f172a', borderColor: '#1e293b' }, cardStyle]}
              >
                <View className="flex-1 mr-3">
                  <Text className="text-slate-500 text-[10px] font-bold" style={themeColor ? { color: themeColor } : {}}>LESSON {lecture.sortOrder}</Text>
                  <Text className="text-slate-100 text-sm font-bold mt-1" numberOfLines={1}>
                    {lecture.title}
                  </Text>
                  <Text className="text-slate-400 text-xs mt-1">
                    ⌛ {Math.round(lecture.duration / 60)} mins
                  </Text>
                </View>

                {/* Status Indicator */}
                <View className="items-center">
                  {!hasAccess ? (
                    <Text className="text-slate-600 text-base">🔒</Text>
                  ) : lecture.completed ? (
                    <Text className="text-emerald-500 text-base">✓</Text>
                  ) : (
                    <Text className="text-blue-400 text-xs font-semibold">Play</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View className="h-28" />
      </ScrollView>

      {/* Sticky Bottom Action */}
      <View className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-6 py-5 flex-row justify-between items-center">
        <View>
          <Text className="text-slate-400 text-xs font-semibold">Total Price</Text>
          <Text className="text-slate-100 text-2xl font-black mt-1">{formattedPrice}</Text>
        </View>

        {course.isPurchased || course.price === 0 ? (
          <Button
            title="Resume Study"
            onPress={() => handleLecturePress(course.lectures[0]?.id)}
            variant="secondary"
            className="flex-1 ml-6"
          />
        ) : (
          <Button
            title="Enroll Now"
            onPress={handlePurchase}
            loading={purchaseLoading}
            variant="primary"
            className="flex-1 ml-6"
          />
        )}
      </View>
    </View>
  );
};
