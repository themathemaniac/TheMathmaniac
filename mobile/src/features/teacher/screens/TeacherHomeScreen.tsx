import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Image, Modal, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../../core/store/auth';
import { apiClient } from '../../../core/api/client';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { Timetable, RoutineSession, DayOfWeek } from '../../../shared/components/Timetable';
import { TeacherAttendanceCalendar } from '../components/TeacherAttendanceCalendar';
import { COURSE_THEMES, getThemeUrl, extractThemeColor } from '../../../core/constants/courseThemes';
import { CourseCard } from '../../../shared/components/CourseCard';

type TeacherHomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SuperuserReports'>;

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
  const [schedules, setSchedules] = useState<any[]>([]);

  // Reschedule Modal State
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [rescheduleStartTime, setRescheduleStartTime] = useState(new Date());
  const [rescheduleEndTime, setRescheduleEndTime] = useState(new Date());
  const [rescheduleBranch, setRescheduleBranch] = useState('Sodepur');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);
  const [peers, setPeers] = useState<{id: string, name: string}[]>([]);
  const [rescheduleTeacherId, setRescheduleTeacherId] = useState<string | null>(null);

  // Theme Selector State
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [selectedCourseForTheme, setSelectedCourseForTheme] = useState<any | null>(null);

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
      const schedRes = await apiClient.get('/attendance/teacher/schedules');
      if (schedRes.data.success) {
        setSchedules(schedRes.data.data);
      }
      const peersRes = await apiClient.get('/attendance/teacher/peers');
      if (peersRes.data.success) {
        setPeers(peersRes.data.data);
      }
    } catch (e) {
      console.log('Error pulling teacher stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedSchedule) return;

    const formatTime = (d: Date) => {
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
    };

    const year = rescheduleDate.getFullYear();
    const month = String(rescheduleDate.getMonth() + 1).padStart(2, '0');
    const day = String(rescheduleDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    try {
      setIsSubmittingReschedule(true);
      const res = await apiClient.put(`/attendance/teacher/schedules/${selectedSchedule.id}/reschedule`, {
        newDate: dateStr,
        newStartTime: formatTime(rescheduleStartTime),
        newEndTime: formatTime(rescheduleEndTime),
        newCampus: rescheduleBranch,
        substituteTeacherId: rescheduleTeacherId
      });

      if (res.data.success) {
        Alert.alert('Success', 'Class rescheduled successfully.');
        setShowRescheduleModal(false);
        loadStats(); // Reload schedules
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to reschedule.');
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  const handleUpdateTheme = async (themeUri: string) => {
    if (!selectedCourseForTheme) return;
    try {
      setLoading(true);
      await apiClient.put(`/courses/${selectedCourseForTheme.id}/theme`, { thumbnailUrl: themeUri });
      Alert.alert("Success", "Course theme updated successfully!");
      setShowThemeSelector(false);
      setSelectedCourseForTheme(null);
      await loadStats();
    } catch (e: any) {
      console.log('Error updating course theme:', e);
      Alert.alert("Error", e.response?.data?.error || "Failed to update theme");
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
    } catch(e) {}

    slots.forEach(slot => {
      if (!slot) return;
      const rawDay = String(slot.day || '').trim().toLowerCase().substring(0, 3);
      const dayMap: Record<string, string> = { 'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday', 'thu': 'Thursday', 'fri': 'Friday', 'sat': 'Saturday', 'sun': 'Sunday' };
      const dayOfWeek = dayMap[rawDay] || slot.day;
      
      let startTime = slot.startTime || '';
      let endTime = slot.endTime || '';
      if ((!startTime || !endTime) && slot.time) {
        const parts = String(slot.time).split(/[-–—]|to/i);
        startTime = parts[0]?.trim() || startTime;
        endTime = parts[1]?.trim() || endTime;
      }

      if (!startTime || !endTime) return;

      mappedSchedules.push({
        id: `${course.id}-${slot.day}-${startTime}`,
        dayOfWeek: dayOfWeek as DayOfWeek,
        startTime,
        endTime,
        courseName: course.title,
        batchName: course.targetClass && course.category?.name ? `${course.category.name} • Class ${course.targetClass}` : (course.targetClass ? `Class ${course.targetClass}` : course.category?.name || 'Program'),
        location: course.branch || 'Sodepur',
        color: COLORS[courseIdx % COLORS.length]
      });
    });
  });

  const courseGroups: { [key: string]: any[] } = {};
  const otherCourses: any[] = [];
  courses.forEach((c) => {
    if (c.targetClass && !isNaN(Number(c.targetClass))) {
      const num = Number(c.targetClass);
      if (!courseGroups[num]) courseGroups[num] = [];
      courseGroups[num].push(c);
    } else {
      otherCourses.push(c);
    }
  });
  const sortedKeys = Object.keys(courseGroups).map(Number).sort((a, b) => a - b);
  const groupedCourses = sortedKeys.map((k) => ({
    id: `class-${k}`,
    title: `Class ${k}`,
    items: courseGroups[k],
  }));
  if (otherCourses.length > 0) {
    groupedCourses.push({
      id: 'other',
      title: 'Other Programs & Batches',
      items: otherCourses,
    });
  }

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
            <TeacherAttendanceCalendar 
              courses={courses} 
              schedules={schedules}
              onReschedule={(sched: any) => {
                setSelectedSchedule(sched);
                const [rsY, rsM, rsD] = sched.date.split('-').map(Number);
                setRescheduleDate(new Date(rsY, rsM - 1, rsD));
                setRescheduleBranch(sched.campus);
                
                const parseTime = (timeStr: string) => {
                  const d = new Date();
                  const match = timeStr.match(/(\d+):(\d+)\s+(AM|PM)/i);
                  if (match) {
                    let h = parseInt(match[1]);
                    const m = parseInt(match[2]);
                    const ampm = match[3].toUpperCase();
                    if (ampm === 'PM' && h < 12) h += 12;
                    if (ampm === 'AM' && h === 12) h = 0;
                    d.setHours(h, m, 0);
                  }
                  return d;
                };
                
                setRescheduleStartTime(parseTime(sched.startTime));
                setRescheduleEndTime(parseTime(sched.endTime));
                setRescheduleTeacherId(user?.id || null);
                setShowRescheduleModal(true);
              }}
            />

            {mappedSchedules.length > 0 ? (
              <View className="mb-6">
                <Timetable
                  title="Timetable"
                  sessions={mappedSchedules}
                  hideDetailedSchedule={true}
                />
              </View>
            ) : (
              <View className="items-center py-10 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl mb-6">
                <Text className="text-slate-500 font-bold text-sm">No upcoming classes scheduled.</Text>
              </View>
            )}


            {/* Active Batches Section */}
            {courses.length > 0 && (
              <View className="mb-6">
                <Text className="text-slate-100 text-lg font-bold mb-3 px-1">My Active Batches</Text>
                {groupedCourses.map(group => (
                  <View key={group.id} className="mb-4">
                    <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">{group.title}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                      {group.items.map(course => (
                        <CourseCard
                          key={course.id}
                          id={course.id}
                          title={course.title}
                          category={course.category?.name || (course.targetClass ? `Class ${course.targetClass}` : 'Program')}
                          price={course.price || 0}
                          thumbnailUrl={course.thumbnailUrl}
                          lectureCount={course.lectureCount || 0}
                          teacherName={course.instructorName}
                          branch={course.branch || 'Sodepur'}
                          horizontal={false}
                          onPress={() => navigation.navigate('TeacherCourseDetails', { courseId: course.id, courseTitle: course.title })}
                          onThemePress={(e) => {
                            e?.stopPropagation && e.stopPropagation();
                            setSelectedCourseForTheme(course);
                            setShowThemeSelector(true);
                          }}
                        />
                      ))}
                    </ScrollView>
                  </View>
                ))}
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

      {/* Reschedule Modal */}
      <Modal visible={showRescheduleModal} transparent animationType="slide" onRequestClose={() => setShowRescheduleModal(false)}>
        <View className="flex-1 justify-end bg-black/85">
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 pb-10">
            <Text className="text-slate-100 text-base font-black mb-1">Reschedule Class</Text>
            <Text className="text-slate-400 text-[10px] mb-4">You are modifying {selectedSchedule?.title} ({selectedSchedule?.date})</Text>

            {/* Date Selector */}
            <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">New Date</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-3 items-center">
              <Text className="text-slate-300 text-xs font-bold">{rescheduleDate.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker value={rescheduleDate} mode="date" display="default" minimumDate={new Date()} onChange={(e, date) => { setShowDatePicker(false); if (date) setRescheduleDate(date); }} />
            )}

            {/* Timings */}
            <View className="flex-row gap-4 mb-4">
              <View className="flex-1">
                <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Start Time</Text>
                <TouchableOpacity onPress={() => setShowStartPicker(true)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 items-center">
                  <Text className="text-slate-300 text-xs">{rescheduleStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
                {showStartPicker && <DateTimePicker value={rescheduleStartTime} mode="time" display="default" onChange={(e, time) => { setShowStartPicker(false); if (time) setRescheduleStartTime(time); }} />}
              </View>
              <View className="flex-1">
                <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">End Time</Text>
                <TouchableOpacity onPress={() => setShowEndPicker(true)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 items-center">
                  <Text className="text-slate-300 text-xs">{rescheduleEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
                {showEndPicker && <DateTimePicker value={rescheduleEndTime} mode="time" display="default" onChange={(e, time) => { setShowEndPicker(false); if (time) setRescheduleEndTime(time); }} />}
              </View>
            </View>

            {/* Branch */}
            <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Campus</Text>
            <View className="flex-row gap-3 mb-5">
              <TouchableOpacity onPress={() => setRescheduleBranch('Sodepur')} className={`flex-1 p-3 rounded-xl border ${rescheduleBranch === 'Sodepur' ? 'bg-[#2D8C82]/20 border-[#2D8C82]' : 'bg-slate-950 border-slate-800'}`}>
                <Text className={`text-center font-bold text-xs ${rescheduleBranch === 'Sodepur' ? 'text-[#2D8C82]' : 'text-slate-400'}`}>Sodepur</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setRescheduleBranch('Madhyamgram')} className={`flex-1 p-3 rounded-xl border ${rescheduleBranch === 'Madhyamgram' ? 'bg-[#2D8C82]/20 border-[#2D8C82]' : 'bg-slate-950 border-slate-800'}`}>
                <Text className={`text-center font-bold text-xs ${rescheduleBranch === 'Madhyamgram' ? 'text-[#2D8C82]' : 'text-slate-400'}`}>Madhyamgram</Text>
              </TouchableOpacity>
            </View>

            {/* Teacher Selection */}
            <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Assign Teacher</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <TouchableOpacity
                onPress={() => setRescheduleTeacherId(user?.id || null)}
                className={`mr-2 px-4 py-2.5 rounded-xl border ${
                  rescheduleTeacherId === user?.id ? 'bg-[#2D8C82]/20 border-[#2D8C82]' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <Text className={`text-xs font-bold ${rescheduleTeacherId === user?.id ? 'text-[#2D8C82]' : 'text-slate-400'}`}>
                  Myself ({user?.name || 'Me'})
                </Text>
              </TouchableOpacity>
              {peers.filter(p => p.id !== user?.id).map(p => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setRescheduleTeacherId(p.id)}
                  className={`mr-2 px-4 py-2.5 rounded-xl border ${
                    rescheduleTeacherId === p.id ? 'bg-[#2D8C82]/20 border-[#2D8C82]' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <Text className={`text-xs font-bold ${rescheduleTeacherId === p.id ? 'text-[#2D8C82]' : 'text-slate-400'}`}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="flex-row gap-4 mt-2">
              <TouchableOpacity onPress={() => setShowRescheduleModal(false)} className="flex-1 bg-slate-800 py-3 rounded-xl items-center">
                <Text className="text-slate-300 text-xs font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleReschedule} disabled={isSubmittingReschedule} className="flex-1 bg-[#2D8C82] py-3 rounded-xl items-center">
                {isSubmittingReschedule ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text className="text-white text-xs font-bold">Save Change</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

