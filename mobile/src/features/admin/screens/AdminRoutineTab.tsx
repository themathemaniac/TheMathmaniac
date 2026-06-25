import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { apiClient } from '../../../core/api/client';
import { useAuthStore } from '../../../core/store/auth';
import { Timetable, RoutineSession, DayOfWeek } from '../../../shared/components/Timetable';

export const AdminRoutineTab: React.FC = () => {
  const { adminListUsers, adminListCourses } = useAuthStore();

  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  useEffect(() => {
    loadTeachers();
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await adminListCourses();
      setCourses(data || []);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load routines.');
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    try {
      const data = await adminListUsers('', 'TEACHER');
      setTeachers(data);
    } catch (e) {
      console.error('Failed to load teachers', e);
    }
  };

  const COLORS = ['#3CA79B', '#D97706', '#2563EB', '#9333EA', '#E11D48'];
  
  const mappedSchedules: RoutineSession[] = [];
  
  courses.forEach((course, courseIdx) => {
    if (selectedTeacherId) {
      const hasTeacher = course.teachers?.some((t: any) => t.userId === selectedTeacherId);
      if (!hasTeacher) return;
    }

    let slots: any[] = [];
    try {
      slots = typeof course.timeSlots === 'string' ? JSON.parse(course.timeSlots) : (course.timeSlots || []);
    } catch(e) {}

    slots.forEach(slot => {
      const dayMap: Record<string, string> = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday' };
      const dayOfWeek = dayMap[slot.day] || slot.day;
      
      let startTime = ''; let endTime = '';
      if (slot.time) {
        const parts = slot.time.split('-');
        startTime = parts[0]?.trim() || '';
        endTime = parts[1]?.trim() || '';
      } else if (slot.startTime && slot.endTime) {
        startTime = slot.startTime;
        endTime = slot.endTime;
      }

      if (!startTime || !endTime) return;

      const teacherNames = course.teachers?.map((t: any) => t.user?.name).join(', ') || 'Unassigned';

      mappedSchedules.push({
        id: `${course.id}-${slot.day}-${startTime}`,
        dayOfWeek: dayOfWeek as DayOfWeek,
        startTime,
        endTime,
        courseName: course.title,
        batchName: `${course.targetClass ? `Class ${course.targetClass}` : course.category?.name || 'General'} (${teacherNames})`,
        location: course.branch || 'Sodepur',
        color: COLORS[courseIdx % COLORS.length]
      });
    });
  });

  return (
    <View className="flex-1">
      {/* Teacher Filter */}
      <View className="mb-4">
        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Filter by Teacher</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => setSelectedTeacherId(null)}
            className={`mr-2 px-4 py-2.5 rounded-xl border ${
              selectedTeacherId === null ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <Text className={`text-xs font-bold ${selectedTeacherId === null ? 'text-white' : 'text-slate-400'}`}>
              All Teachers
            </Text>
          </TouchableOpacity>
          {teachers.map(t => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setSelectedTeacherId(t.id)}
              className={`mr-2 px-4 py-2.5 rounded-xl border ${
                selectedTeacherId === t.id ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <Text className={`text-xs font-bold ${selectedTeacherId === t.id ? 'text-white' : 'text-slate-400'}`}>
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Routine Viewer List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text className="text-slate-100 text-base font-bold mb-4">Institute Routines</Text>
        {loading && courses.length === 0 ? (
          <View className="items-center py-10">
            <ActivityIndicator size="small" color="#2D8C82" />
          </View>
        ) : mappedSchedules.length === 0 ? (
          <View className="items-center py-10 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl">
            <Text className="text-slate-500 font-bold text-sm">No routines found.</Text>
          </View>
        ) : (
          <Timetable sessions={mappedSchedules} />
        )}
      </ScrollView>
    </View>
  );
};
