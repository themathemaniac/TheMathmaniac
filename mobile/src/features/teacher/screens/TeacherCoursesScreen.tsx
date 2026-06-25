import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Modal, Image, Alert } from 'react-native';
import { apiClient } from '../../../core/api/client';
import { COURSE_THEMES, getThemeUrl, extractThemeColor } from '../../../core/constants/courseThemes';

import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

export const TeacherCoursesScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [selectedCourseForTheme, setSelectedCourseForTheme] = useState<any | null>(null);

  const handleUpdateTheme = async (themeUri: string) => {
    if (!selectedCourseForTheme) return;
    try {
      setLoading(true);
      await apiClient.put(`/courses/${selectedCourseForTheme.id}/theme`, { thumbnailUrl: themeUri });
      Alert.alert("Success", "Course theme updated successfully!");
      setShowThemeSelector(false);
      setSelectedCourseForTheme(null);
      await fetchCourses();
    } catch (e: any) {
      console.log('Error updating course theme:', e);
      Alert.alert("Error", e.response?.data?.error || "Failed to update theme");
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/courses?assigned=true');
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
              courses.map((course) => {
                const themeColor = extractThemeColor(course.thumbnailUrl);
                return (
                <TouchableOpacity
                  key={course.id}
                  onPress={() => navigation.navigate('TeacherCourseDetails', { courseId: course.id, courseTitle: course.title })}
                  className="bg-slate-900 border rounded-2xl p-5 mb-4 active:bg-slate-800/80 shadow-sm"
                  style={{ borderColor: themeColor || '#1e293b', shadowColor: themeColor || '#000' }}
                >
                  <Text 
                    className="text-slate-500 text-[9px] font-black tracking-widest uppercase border bg-slate-950 px-2 py-0.5 rounded-md mr-2 self-start"
                    style={{ borderColor: themeColor ? `${themeColor}50` : '#1e293b', color: themeColor || '#64748b' }}
                  >
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
                  
                  <TouchableOpacity 
                    onPress={() => {
                      setSelectedCourseForTheme(course);
                      setShowThemeSelector(true);
                    }}
                    className="bg-slate-800 border border-slate-700/80 rounded-xl py-2.5 items-center mt-3 shadow-sm shadow-black/30"
                  >
                    <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider">Change Theme</Text>
                  </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View className="items-center py-20">
                <Text className="text-4xl">📚</Text>
                <Text className="text-slate-400 font-bold mt-4">No batches available.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Theme Selection Modal */}
      <Modal visible={showThemeSelector} animationType="slide" transparent onRequestClose={() => setShowThemeSelector(false)}>
        <View className="flex-1 justify-end bg-black/80">
          <View className="bg-slate-900 rounded-t-3xl border-t border-slate-800 pb-10" style={{ maxHeight: '60%' }}>
            <View className="flex-row justify-between items-center p-5 border-b border-slate-850">
              <Text className="text-slate-100 text-lg font-black">Select a Theme</Text>
              <TouchableOpacity onPress={() => setShowThemeSelector(false)} className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700/50">
                <Text className="text-slate-300 font-bold text-xs">Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView className="p-5">
              {(() => {
                if (!selectedCourseForTheme) return null;
                const titleLower = selectedCourseForTheme.title.toLowerCase();
                let availableThemes: any[] = [];
                if (/\b(computer|cs|tech|programming|coding)\b/.test(titleLower)) availableThemes = COURSE_THEMES.computer;
                else if (/\b(physic|physics)\b/.test(titleLower)) availableThemes = COURSE_THEMES.physics;
                else if (/\b(chem|chemistry)\b/.test(titleLower)) availableThemes = COURSE_THEMES.chemistry;
                else if (/\b(math|maths|mathematics)\b/.test(titleLower)) availableThemes = COURSE_THEMES.maths;
                else if (/\b(bio|biology|botany|zoology)\b/.test(titleLower)) availableThemes = COURSE_THEMES.biology;
                else availableThemes = [...COURSE_THEMES.computer, ...COURSE_THEMES.physics, ...COURSE_THEMES.chemistry, ...COURSE_THEMES.maths, ...COURSE_THEMES.biology];

                return (
                  <View className="flex-row flex-wrap justify-between">
                    {availableThemes.map((theme) => {
                      const themeUri = getThemeUrl(theme.url, theme.color);
                      const isSelected = selectedCourseForTheme.thumbnailUrl === themeUri;
                      return (
                        <TouchableOpacity
                          key={theme.id}
                          onPress={() => handleUpdateTheme(themeUri)}
                          className={`rounded-xl overflow-hidden border-2 mb-4 ${isSelected ? 'border-blue-500 shadow-sm shadow-blue-500/50' : 'border-slate-800'}`}
                          style={{ width: '48%' }}
                        >
                          <Image source={theme.url ? { uri: theme.url } : undefined} style={{ width: '100%', height: 90 }} resizeMode="cover" />
                          <View className="p-2" style={{ backgroundColor: theme.color }}>
                            <Text className="text-white text-[10px] font-bold text-center" numberOfLines={1}>{theme.name}</Text>
                          </View>
                          {isSelected && (
                            <View className="absolute top-2 right-2 bg-blue-500 rounded-full w-5 h-5 items-center justify-center">
                              <Text className="text-white text-[10px] font-black">✓</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}
              <View className="h-10" />
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};
