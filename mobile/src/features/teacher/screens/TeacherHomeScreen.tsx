import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Image, Modal, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../../core/store/auth';
import { apiClient } from '../../../core/api/client';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { Timetable, RoutineSession } from '../../../shared/components/Timetable';
import { TeacherAttendanceCalendar } from '../components/TeacherAttendanceCalendar';

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
      const schedRes = await apiClient.get('/teacher/schedules');
      if (schedRes.data.success) {
        setSchedules(schedRes.data.data);
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
      const res = await apiClient.put(`/teacher/schedules/${selectedSchedule.id}/reschedule`, {
        newDate: dateStr,
        newStartTime: formatTime(rescheduleStartTime),
        newEndTime: formatTime(rescheduleEndTime),
        newCampus: rescheduleBranch
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

  useEffect(() => {
    loadStats();
  }, []);

  const COLORS = ['#3CA79B', '#D97706', '#2563EB', '#9333EA', '#E11D48'];

  const mappedSchedules: RoutineSession[] = schedules.map((schedule, idx) => {
    const d = new Date(schedule.date);
    const dayMap: any = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
    const dayOfWeek = dayMap[d.getDay()];

    return {
      id: schedule.id,
      dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      courseName: schedule.title,
      batchName: schedule.class || schedule.subject || 'Class',
      location: schedule.campus,
      color: COLORS[idx % COLORS.length]
    };
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
                    const sched = schedules.find(s => s.id === session.id);
                    if (sched) {
                      setSelectedSchedule(sched);
                      setRescheduleDate(new Date(sched.date));
                      setRescheduleBranch(sched.campus);
                      
                      // Quick parse for times (format "hh:mm AM")
                      const parseTime = (t: string) => {
                        const date = new Date();
                        const [time, ampm] = t.split(' ');
                        if(!time) return date;
                        const [h, m] = time.split(':');
                        let hours = parseInt(h);
                        if(ampm === 'PM' && hours < 12) hours += 12;
                        if(ampm === 'AM' && hours === 12) hours = 0;
                        date.setHours(hours, parseInt(m), 0, 0);
                        return date;
                      };
                      
                      setRescheduleStartTime(parseTime(sched.startTime));
                      setRescheduleEndTime(parseTime(sched.endTime));
                      setShowRescheduleModal(true);
                    }
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
    </View>
  );
};

