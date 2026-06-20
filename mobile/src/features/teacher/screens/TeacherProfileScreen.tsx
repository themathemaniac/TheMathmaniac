import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, Modal, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { generateWeeks, getMonthName, formatDateString } from '../../../shared/utils/calendar';
import { apiClient } from '../../../core/api/client';

type TeacherProfileNavigationProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

const TeacherAttendanceCalendar: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  const [monthLogs, setMonthLogs] = useState<Record<string, string>>({});
  const [roster, setRoster] = useState<{ id: string; name: string; status: 'PRESENT' | 'ABSENT' }[]>([]);
  const [dayStatus, setDayStatus] = useState<'CLASS_HELD' | 'CANCELLED' | 'HOLIDAY'>('CLASS_HELD');
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const weeks = generateWeeks(currentYear, currentMonth);

  const fetchMonthLogs = async () => {
    try {
      const response = await apiClient.get('/attendance/month-summary', {
        params: { month: currentMonth + 1, year: currentYear }
      });
      if (response.data.success) {
        setMonthLogs(response.data.data);
      }
    } catch (e) {
      console.log('Error fetching month summary:', e);
    }
  };

  useEffect(() => {
    fetchMonthLogs();
  }, [currentMonth, currentYear]);

  const isFutureDate = (day: number) => {
    const checkDate = new Date(currentYear, currentMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return checkDate > today;
  };

  const requiresReason = () => {
    if (!selectedDay) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const target = new Date(currentYear, currentMonth, selectedDay);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - target.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 2;
  };

  const handleDayPress = async (day: number) => {
    if (isFutureDate(day)) {
      Alert.alert('Future Date', 'Class schedule and attendance roster are not available yet.');
      return;
    }
    
    setSelectedDay(day);
    setReason('');
    setModalVisible(true);
    setLoadingRoster(true);
    
    try {
      const dateStr = formatDateString(currentYear, currentMonth, day);
      const response = await apiClient.get('/attendance', {
        params: { date: dateStr }
      });
      
      if (response.data.success) {
        const { dayStatus: dbDayStatus, roster: dbRoster } = response.data.data;
        setDayStatus(dbDayStatus || 'CLASS_HELD');
        
        const mappedRoster = dbRoster.map((student: any) => ({
          id: student.id,
          name: student.name,
          status: (student.status === 'ABSENT' ? 'ABSENT' : 'PRESENT') as 'PRESENT' | 'ABSENT'
        }));
        setRoster(mappedRoster);
      }
    } catch (e: any) {
      console.error('[Fetch Roster Error]', e);
      Alert.alert('Error', e.response?.data?.error || 'Failed to load student roster.');
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleToggleStudentStatus = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setRoster(prev => prev.map(student => 
      student.id === studentId ? { ...student, status } : student
    ));
  };

  const handleSaveAttendance = async () => {
    if (!selectedDay) return;
    
    if (requiresReason() && reason.trim() === '') {
      Alert.alert('Reason Required', 'Please enter a reason for this retroactive attendance change.');
      return;
    }

    setSaving(true);
    
    try {
      const dateStr = formatDateString(currentYear, currentMonth, selectedDay);
      const records = roster.map(student => ({
        studentId: student.id,
        status: student.status
      }));

      const response = await apiClient.post('/attendance', {
        date: dateStr,
        dayStatus,
        records,
        reason: requiresReason() ? reason.trim() : undefined
      });

      if (response.data.success) {
        Alert.alert('Success', 'Attendance recorded successfully.');
        setModalVisible(false);
        fetchMonthLogs();
      }
    } catch (e: any) {
      console.error('[Save Attendance Error]', e);
      Alert.alert('Error', e.response?.data?.error || 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(prev => {
      const newD = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      return newD;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const newD = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      return newD;
    });
  };

  const presentCount = roster.filter(s => s.status === 'PRESENT').length;
  const absentCount = roster.filter(s => s.status === 'ABSENT').length;

  return (
    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center gap-1">
          <TouchableOpacity onPress={handlePrevMonth} className="p-1">
            <Text className="text-slate-400 text-xs font-bold">◀</Text>
          </TouchableOpacity>
          <Text className="text-slate-100 text-xs font-bold">
            📅 {getMonthName(currentMonth)} {currentYear} Log
          </Text>
          <TouchableOpacity onPress={handleNextMonth} className="p-1">
            <Text className="text-slate-400 text-xs font-bold">▶</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-slate-500 text-[10px] font-bold">Tap a day to view roster</Text>
      </View>
      
      {/* Weekday headers */}
      <View className="flex-row justify-between mb-2">
        {weekDays.map((wd, idx) => (
          <View key={idx} className="w-8 items-center">
            <Text className="text-slate-500 text-[10px] font-bold">{wd}</Text>
          </View>
        ))}
      </View>
      
      {/* Days grid */}
      <View className="mb-2">
        {weeks.map((week, wIdx) => (
          <View key={wIdx} className="flex-row justify-between mb-1.5">
            {week.map((day, dIdx) => {
              if (day === null) {
                return <View key={`empty-${dIdx}`} className="w-8 h-8" />;
              }

              const dayStr = formatDateString(currentYear, currentMonth, day);
              const status = monthLogs[dayStr]; // "CLASS_HELD", "CANCELLED", "HOLIDAY"
              const future = isFutureDate(day);

              let bgClass = 'bg-slate-950/40';
              let borderClass = 'border border-slate-800/60';
              let textClass = 'text-slate-200';
              
              if (status === 'CLASS_HELD') {
                // Class Held -> Green
                bgClass = 'bg-green-500/20';
                borderClass = 'border border-green-500/40';
                textClass = 'text-green-400 font-bold';
              } else if (status === 'CANCELLED') {
                // Class Not Held (Teacher Leave) -> Red
                bgClass = 'bg-red-500/20';
                borderClass = 'border border-red-500/40';
                textClass = 'text-red-400 font-bold';
              } else if (status === 'HOLIDAY') {
                // Institute Holiday -> Amber
                bgClass = 'bg-amber-500/10';
                borderClass = 'border border-amber-500/20';
                textClass = 'text-amber-500 font-bold';
              } else if (future) {
                // Future Date -> Unmarked
                bgClass = 'bg-transparent';
                borderClass = 'border border-slate-800';
                textClass = 'text-slate-500';
              }
              
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => handleDayPress(day)}
                  className="w-8 h-8 items-center justify-center"
                >
                  <View className={`w-7 h-7 rounded-full items-center justify-center ${bgClass} ${borderClass}`}>
                    <Text className={`text-[10px] ${textClass}`}>{day}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View className="flex-row justify-around mt-4 pt-3 border-t border-slate-800/50 flex-wrap gap-y-2">
        <View className="flex-row items-center">
          <View className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/40 mr-1.5" />
          <Text className="text-slate-500 text-[9px] font-medium">Class Held</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40 mr-1.5" />
          <Text className="text-slate-500 text-[9px] font-medium">Leave (No Class)</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-2.5 h-2.5 rounded-full bg-amber-500/10 border border-amber-500/20 mr-1.5" />
          <Text className="text-slate-500 text-[9px] font-medium">Holiday</Text>
        </View>
      </View>

      {/* Roster Details Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-slate-950/80">
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 h-[75%]">
            
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-800">
              <View className="flex-1 mr-4">
                <Text className="text-slate-100 text-base font-black">
                  Class Attendance
                </Text>
                <Text className="text-slate-400 text-[10px] font-medium mt-0.5">
                  {getMonthName(currentMonth)} {selectedDay}, {currentYear} • {dayStatus === 'CLASS_HELD' ? `${presentCount} Present, ${absentCount} Absent` : dayStatus === 'CANCELLED' ? 'Teacher Leave' : 'Holiday'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700/50"
              >
                <Text className="text-slate-100 text-xs font-bold">Close</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1 mb-4">
              
              {/* Day Type Selector */}
              <View className="mb-4">
                <Text className="text-slate-400 text-[10px] font-black mb-2 uppercase tracking-wider">
                  Select Day Status
                </Text>
                <View className="flex-row bg-slate-950/50 p-1 rounded-2xl border border-slate-850">
                  {(['CLASS_HELD', 'CANCELLED', 'HOLIDAY'] as const).map((statusOption) => {
                    const label = statusOption === 'CLASS_HELD' ? 'Class Held' : statusOption === 'CANCELLED' ? 'Leave' : 'Holiday';
                    const active = dayStatus === statusOption;
                    return (
                      <TouchableOpacity
                        key={statusOption}
                        onPress={() => setDayStatus(statusOption)}
                        className={`flex-1 py-2 rounded-xl items-center justify-center ${
                          active ? 'bg-slate-800 border border-slate-700/30' : 'bg-transparent'
                        }`}
                      >
                        <Text className={`text-[11px] font-bold ${active ? 'text-slate-100' : 'text-slate-500'}`}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Retroactive Edit Warning & Reason Input */}
              {!loadingRoster && requiresReason() && (
                <View className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                  <Text className="text-amber-400 text-xs font-bold mb-1">
                    ⚠️ Retroactive Change Required
                  </Text>
                  <Text className="text-slate-400 text-[10px] leading-4 mb-3">
                    This date is past the 24-hour grace period. Please provide a brief reason for this modification.
                  </Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="e.g., Student submitted medical slip"
                    placeholderTextColor="#64748B"
                    className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-xs"
                  />
                </View>
              )}

              {/* Roster List / Status Card */}
              {loadingRoster ? (
                <View className="justify-center items-center py-10">
                  <ActivityIndicator size="small" color="#2D8C82" />
                  <Text className="text-slate-400 text-xs mt-2 font-medium">Loading roster...</Text>
                </View>
              ) : dayStatus !== 'CLASS_HELD' ? (
                <View className="justify-center items-center py-8 px-4 bg-slate-950/20 border border-slate-850 rounded-2xl mb-6">
                  <Text className="text-slate-400 text-sm font-bold text-center">
                    Roster Disabled
                  </Text>
                  <Text className="text-slate-500 text-[10px] text-center mt-2 leading-4">
                    {dayStatus === 'CANCELLED'
                      ? 'No roster is editable because the class was cancelled (Teacher Leave). Saving will log a cancellation event for this day.'
                      : 'No roster is editable because it is an institute holiday. Saving will log a holiday event for this day.'}
                  </Text>
                </View>
              ) : (
                <View className="pb-4">
                  {roster.map((student) => {
                    const isPresent = student.status === 'PRESENT';
                    return (
                      <View
                        key={student.id}
                        className="bg-slate-950/30 border border-slate-800/60 rounded-2xl p-4 mb-3 flex-row justify-between items-center"
                      >
                        <Text className="text-slate-200 text-sm font-bold">{student.name}</Text>
                        
                        <View className="flex-row items-center gap-2">
                          <TouchableOpacity
                            onPress={() => handleToggleStudentStatus(student.id, 'PRESENT')}
                            className={`px-3 py-1.5 rounded-xl border ${
                              isPresent
                                ? 'bg-green-500/20 border-green-500/50'
                                : 'bg-slate-900 border-slate-850'
                            }`}
                          >
                            <Text className={`text-[10px] font-bold uppercase tracking-wider ${
                              isPresent ? 'text-green-400' : 'text-slate-500'
                            }`}>
                              Present
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleToggleStudentStatus(student.id, 'ABSENT')}
                            className={`px-3 py-1.5 rounded-xl border ${
                              !isPresent
                                ? 'bg-red-500/20 border-red-500/50'
                                : 'bg-slate-900 border-slate-850'
                            }`}
                          >
                            <Text className={`text-[10px] font-bold uppercase tracking-wider ${
                              !isPresent ? 'text-red-400' : 'text-slate-500'
                            }`}>
                              Absent
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Save Button */}
            {!loadingRoster && (
              <View className="border-t border-slate-850 pt-4 flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  className="flex-1 bg-slate-950/50 border border-slate-800 py-3.5 rounded-2xl items-center"
                >
                  <Text className="text-slate-400 text-xs font-bold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveAttendance}
                  disabled={saving}
                  className="flex-[2] bg-blue-600/90 py-3.5 rounded-2xl items-center justify-center shadow-lg shadow-blue-600/10"
                >
                  <Text className="text-white text-xs font-bold">
                    {saving ? 'Saving...' : 'Save Attendance'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export const TeacherProfileScreen: React.FC = () => {
  const navigation = useNavigation<TeacherProfileNavigationProp>();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        onPress: async () => {
          await logout();
          navigation.replace('Login');
        },
        style: 'destructive',
      },
    ]);
  };

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pb-24">
          {/* User Details */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 flex-row items-center">
            <View className="w-16 h-16 bg-blue-600 rounded-full justify-center items-center shadow-lg shadow-blue-500/20 mr-4">
              <Text className="text-white text-2xl font-black">
                {user?.name?.charAt(0) || 'T'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-slate-100 text-lg font-black">{user?.name || 'Instructor'}</Text>
              <Text className="text-slate-400 text-xs mt-1">{user?.phoneNumber || ''}</Text>
              <Text className="text-slate-500 text-xs mt-0.5" numberOfLines={1}>
                {user?.email || ''}
              </Text>
            </View>
          </View>

          {/* Teacher Info / Analytics */}
          <Text className="text-slate-100 text-base font-bold mb-4">Teaching Analytics</Text>
          <View className="flex-row flex-wrap justify-between mb-8">
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Batches Managed</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">0</Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Avg Ratings</Text>
              <Text className="text-emerald-400 text-2xl font-black mt-2">N/A</Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Feedback Sheets</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">0</Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Teaching Hours</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">0 hrs</Text>
            </View>
          </View>

          {/* Academic Institution Card */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
            <Text className="text-slate-100 text-sm font-bold">Academic Institution Status</Text>
            <View className="flex-row items-center justify-between mt-4">
              <View>
                <Text className="text-slate-300 text-xs font-semibold">The Mathemaniac</Text>
                <Text className="text-slate-500 text-[10px] mt-0.5">{user?.faculty || 'Faculty Member'}</Text>
              </View>
              <View className="bg-blue-600/20 px-3 py-1 rounded-full border border-blue-500/20">
                <Text className="text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                  Active
                </Text>
              </View>
            </View>
          </View>

          {/* Attendance Calendar */}
          <TeacherAttendanceCalendar />

          {/* Admin Panel Button */}
          {user?.role === 'ADMIN' && (
            <Button
              title="Admin Control Panel"
              onPress={() => navigation.navigate('AdminPanel')}
              className="mb-4"
            />
          )}

          {/* Logout */}
          <Button title="Sign Out of Session" onPress={handleLogout} variant="danger" />
        </View>
      </ScrollView>
    </View>
  );
};
