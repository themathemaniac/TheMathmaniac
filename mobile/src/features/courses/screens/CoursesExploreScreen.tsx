import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { apiClient } from '../../../core/api/client';
import { CourseCard } from '../../../shared/components/CourseCard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type CourseExploreNavigationProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

export const CoursesExploreScreen: React.FC = () => {
  const navigation = useNavigation<CourseExploreNavigationProp>();
  const [courses, setCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(''); // empty means 'All'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, coursesRes] = await Promise.all([
        apiClient.get('/courses/categories'),
        apiClient.get(`/courses?category=${activeCategory}&search=${searchQuery}`),
      ]);
      setCategories(categoriesRes.data.data);
      setCourses(coursesRes.data.data);
    } catch (e) {
      console.log('Error pulling courses data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeCategory, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      {/* Search Header */}
      <View className="mb-4">
        <View className="flex-row justify-between items-center">
          <Text className="text-slate-100 text-2xl font-black">Explore Programs</Text>
          <Image
            source={require('../../../../assets/Mathemaniac_Logo_Padded.png')}
            className="w-20 h-14 rounded-full border border-slate-700/60"
            resizeMode="cover"
          />
        </View>
        <View className="bg-slate-900 border border-slate-800 rounded-2xl flex-row items-center px-4 py-3.5 mt-4">
          <Text className="text-slate-500 mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-slate-300 font-semibold"
            placeholder="Search Calculus, NEET Physics..."
            placeholderTextColor="#8A8070"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Categories Horizontal Pills Scroll */}
      <View className="h-14 mb-4 justify-center">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          <TouchableOpacity
            onPress={() => setActiveCategory('')}
            className={`px-5 py-2.5 rounded-full mr-2 justify-center border ${
              activeCategory === ''
                ? 'bg-blue-600 border-blue-500'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <Text className={`font-semibold text-xs ${activeCategory === '' ? 'text-white' : 'text-slate-400'}`}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setActiveCategory(cat.slug)}
              className={`px-5 py-2.5 rounded-full mr-2 justify-center border ${
                activeCategory === cat.slug
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <Text
                className={`font-semibold text-xs ${
                  activeCategory === cat.slug ? 'text-white' : 'text-slate-400'
                }`}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Courses List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D8C82" />}
      >
        {loading ? (
          <View className="space-y-4">
            <Skeleton height={120} borderRadius={24} />
            <Skeleton height={120} borderRadius={24} />
            <Skeleton height={120} borderRadius={24} />
          </View>
        ) : courses.length > 0 ? (
          <View className="pb-24">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                category={course.targetClass ? `Class ${course.targetClass}` : course.category?.name || 'Program'}
                price={course.price}
                thumbnailUrl={course.thumbnailUrl}
                lectureCount={course.lectureCount}
                isPurchased={course.isPurchased}
                teacherName={course.teachers && course.teachers.length > 0 ? course.teachers.map((t: any) => t.user?.name).filter(Boolean).join(', ') : course.instructorName}
                onPress={() => navigation.navigate('CourseDetails', { courseId: course.id })}
                horizontal
              />
            ))}
          </View>
        ) : (
          <View className="items-center py-20">
            <Text className="text-4xl">📚</Text>
            <Text className="text-slate-400 font-bold mt-4 text-center">
              No programs found matching the query.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
