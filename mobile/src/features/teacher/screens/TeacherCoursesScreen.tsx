import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { apiClient } from '../../../core/api/client';

export const TeacherCoursesScreen: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/courses');
      setCourses(res.data.data);
    } catch (e) {
      console.log('Error pulling teacher courses:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCourses();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      <View className="mb-4">
        <Text className="text-slate-100 text-2xl font-black">My Active Batches</Text>
      </View>

      {loading && !refreshing ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2D8C82" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D8C82" />}
        >
          <View className="pb-24">
            {courses.length > 0 ? (
              courses.map((course) => (
                <View
                  key={course.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4"
                >
                  <Text className="text-slate-500 text-[9px] font-black tracking-widest uppercase border border-slate-800 bg-slate-950 px-2 py-0.5 rounded-md mr-2 self-start">
                    {course.category?.name || 'General'}
                  </Text>
                  
                  <Text className="text-slate-100 text-base font-bold mt-3">
                    {course.title}
                  </Text>

                  <View className="flex-row mt-4 pt-3 border-t border-slate-800/80 justify-between">
                    <View>
                      <Text className="text-slate-500 text-[9px] uppercase font-bold">Instructor</Text>
                      <Text className="text-slate-200 text-sm font-bold mt-0.5">👤 {course.instructorName}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-slate-500 text-[9px] uppercase font-bold">Video Lectures</Text>
                      <Text className="text-slate-200 text-sm font-bold mt-0.5">🎬 {course.lectureCount} Lectures</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View className="items-center py-20">
                <Text className="text-4xl">📚</Text>
                <Text className="text-slate-400 font-bold mt-4">No batches available.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};
