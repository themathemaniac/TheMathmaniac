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
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-slate-100 text-2xl font-black">My Active Batches</Text>
          <Text className="text-slate-400 text-xs mt-1">Class Rosters & Student Enrolls</Text>
        </View>
        <Image
          source={require('../../../../assets/Mathemaniac_Logo_Padded.png')}
          className="w-20 h-14 rounded-full border border-slate-700/60"
          resizeMode="cover"
        />
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
                    className="mb-4 rounded-2xl overflow-hidden active:opacity-90 shadow-lg border bg-white"
                    style={{ borderColor: themeColor || '#e2e8f0' }}
                    activeOpacity={0.85}
                  >
                    <View className="flex-row p-3 rounded-2xl relative">
                      <Image
                        source={course.thumbnailUrl ? { uri: course.thumbnailUrl } : undefined}
                        className="w-24 h-24 rounded-xl bg-slate-200"
                        resizeMode="cover"
                      />
                      <View className="flex-1 ml-4 justify-between">
                        <View>
                          <Text className="text-xs font-bold text-amber-600 uppercase tracking-wider" style={{ color: themeColor || '#d97706' }}>
                            {course.targetClass ? `Class ${course.targetClass}` : course.category?.name || 'Program'}
                          </Text>
                          <Text className="text-sm font-semibold text-slate-900 mt-1" numberOfLines={2} style={{ color: '#0f172a' }}>
                            {course.title}
                          </Text>
                          <Text className="text-xs text-slate-500 mt-1 font-medium" style={{ color: '#64748b' }}>
                            Instructor: {course.instructorName}
                          </Text>
                        </View>
                        <View className="flex-row justify-between items-center mt-2">
                          <Text className="text-xs text-slate-500 font-medium" style={{ color: '#64748b' }}>{course.lectureCount} Lectures</Text>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              setSelectedCourseForTheme(course);
                              setShowThemeSelector(true);
                            }}
                            className="bg-blue-50 border border-blue-200 px-3 py-1 rounded-full"
                          >
                            <Text className="text-[10px] font-bold text-blue-600 uppercase">Theme</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
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
