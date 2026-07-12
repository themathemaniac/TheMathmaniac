import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useAuthStore } from '../../../core/store/auth';
import { apiClient } from '../../../core/api/client';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { Timetable, RoutineSession } from '../../../shared/components/Timetable';
import { TeacherAttendanceCalendar } from '../components/TeacherAttendanceCalendar';

type TeacherHomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TeacherAttendanceTracking' | 'SuperuserReports'>;

const SUPERUSER_PHONES = ['+917980357754', '+919831754957'];

export const TeacherHomeScreen: React.FC = () => {
  const { user } = useAuthStore();
  const navigation = useNavigation<TeacherHomeScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalStudents: number;
    totalCourses: number;
    totalTests: number;
    totalMaterials: number;
  } | null>(null);
  const [courses, setCourses] = useState<any[]>([]);

  const isSuperuser = user && SUPERUSER_PHONES.includes(user.phoneNumber);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/profile');
      if (res.data.success) {
        setStats(res.data.data.stats);
      }
      const coursesRes = await apiClient.get('/courses?assigned=true');
      if (coursesRes.data.success) {
        setCourses(coursesRes.data.data);
      }
    } catch (e) {
      console.log('Error pulling teacher stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const COLORS = ['#3CA79B', '#D97706', '#2563EB', '#9333EA', '#E11D48'];

  const mappedSchedules: RoutineSession[] = [];
  courses.forEach((course, courseIdx) => {
    let slots: any[] = [];
    try {
      slots = typeof course.timeSlots === 'string' ? JSON.parse(course.timeSlots) : (course.timeSlots || []);
    } catch (e) { }

    slots.forEach((slot: any) => {
      const dayMap: Record<string, string> = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday' };
      const dayOfWeek = dayMap[slot.day] || slot.day;

      let startTime = ''; let endTime = '';
      if (slot.time) {
        const parts = slot.time.split('-');
        startTime = parts[0]?.trim() || '';
        endTime = parts[1]?.trim() || '';
      }

      if (!startTime || !endTime) return;

      mappedSchedules.push({
        id: `${course.id}-${slot.day}-${startTime}`,
        dayOfWeek: dayOfWeek as any,
        startTime,
        endTime,
        courseName: course.title,
        batchName: `${course.targetClass ? `Class ${course.targetClass}` : course.category?.name || 'Program'}`,
        location: course.branch || 'Sodepur',
        color: COLORS[courseIdx % COLORS.length]
      });
    });
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="bg-slate-900 border-b border-slate-800/80 pl-6 pr-2 pt-14 pb-4 flex-row justify-between items-center">
        <View>
          <Text className="text-slate-500 text-xs font-semibold tracking-widest uppercase">
            Mathemaniac Faculty
          </Text>
          <Text className="text-slate-100 text-lg font-black mt-0.5">
            Hey, {user?.name || 'Instructor'}! 👨‍🏫
          </Text>
        </View>
        <Image
          source={require('../../../../assets/Mathemaniac_Logo_Padded.png')}
          className="w-20 h-14 rounded-full border border-slate-700/60"
          resizeMode="cover"
        />
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D8C82" />}
      >
        {loading && !refreshing ? (
          <View className="flex-1 justify-center items-center py-20">
            <ActivityIndicator size="large" color="#2D8C82" />
          </View>
        ) : (
          <View className="pb-12">
            {/* Institute Calendar for Teachers */}
            <TeacherAttendanceCalendar courses={courses} />

            {mappedSchedules.length > 0 ? (
              <View className="mb-6">
                <Timetable
                  title="Timetable"
                  sessions={mappedSchedules}
                  onSessionPress={(session) => {
                    console.log('Pressed session:', session);
                  }}
                />
              </View>
            ) : (
              <View className="items-center py-10 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl mb-6">
                <Text className="text-slate-500 font-bold text-sm">No upcoming classes scheduled.</Text>
              </View>
            )}


            {/* Superuser Controls Card */}
            {isSuperuser && (
              <View className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 mb-6">
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-4">
                    <View className="flex-row items-center">
                      <View className="bg-amber-500/10 px-2 py-0.5 rounded-full mr-2">
                        <Text className="text-amber-400 text-[9px] font-extrabold uppercase tracking-widest">
                          Superuser
                        </Text>
                      </View>
                      <Text className="text-slate-100 text-sm font-bold">🔑 System Reports</Text>
                    </View>
                    <Text className="text-slate-500 text-[10px] mt-2 leading-4 font-semibold">
                      Access cryptographic daily attendance logs, view generated PDFs, and force system compilation.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('SuperuserReports')}
                    className="bg-amber-500 border border-amber-600 px-4 py-2.5 rounded-2xl active:opacity-90 shadow-md shadow-amber-500/10"
                  >
                    <Text className="text-slate-950 text-xs font-extrabold uppercase tracking-wider">View Reports</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </View>
        )}
      </ScrollView>
    </View>
  );
};

