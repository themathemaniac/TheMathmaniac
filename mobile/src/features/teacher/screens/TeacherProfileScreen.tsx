import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, Modal, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type TeacherProfileNavigationProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

const TeacherAttendanceCalendar: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  
  const weeks = [
    [1, 2, 3, 4, 5, 6, 7],
    [8, 9, 10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19, 20, 21],
    [22, 23, 24, 25, 26, 27, 28],
    [29, 30, null, null, null, null, null],
  ];

  const students = [
    { id: '1', name: 'Amit Sharma' },
    { id: '2', name: 'Rohan Dey' },
    { id: '3', name: 'Anjali Sen' },
    { id: '4', name: 'Vikram Seth' },
    { id: '5', name: 'Priya Patel' },
    { id: '6', name: 'Kabir Mehta' },
  ];

  // Past/Present June 1-15:
  // June 11: Holiday (Institute Closed)
  // June 5, 12: Class Not Held (Teacher Leave)
  // Others: Class Held
  const getDayStatus = (day: number) => {
    if (day > 15) return -2; // Future
    if (day === 11) return -3; // Institute Holiday
    if ([5, 12].includes(day)) return -4; // Class Not Held (Teacher Leave)
    return 1; // Class Held
  };

  const getStudentAttendance = (day: number) => {
    return students.map(student => {
      if (student.name === 'Rohan Dey' && [3, 10].includes(day)) {
        return { ...student, status: 'Absent' as const };
      }
      if (student.name === 'Vikram Seth' && [5, 12].includes(day)) {
        return { ...student, status: 'Absent' as const };
      }
      if (student.name === 'Anjali Sen' && day === 8) {
        return { ...student, status: 'Absent' as const };
      }
      if (student.name === 'Priya Patel' && day === 2) {
        return { ...student, status: 'Absent' as const };
      }
      return { ...student, status: 'Present' as const };
    });
  };

  const handleDayPress = (day: number) => {
    const status = getDayStatus(day);
    if (status === -2) {
      Alert.alert('Future Date', 'Class schedule and attendance roster are not available yet.');
      return;
    }
    if (status === -3) {
      Alert.alert('Institute Holiday', 'June 11: Institute closed for Holiday.');
      return;
    }
    if (status === -4) {
      Alert.alert('Class Cancelled', `June ${day}: No class was held because you took leave.`);
      return;
    }
    setSelectedDay(day);
    setModalVisible(true);
  };

  const attendanceRoster = selectedDay ? getStudentAttendance(selectedDay) : [];
  const presentCount = attendanceRoster.filter(s => s.status === 'Present').length;
  const absentCount = attendanceRoster.filter(s => s.status === 'Absent').length;

  return (
    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-slate-100 text-sm font-bold">📅 June 2026 Attendance Log</Text>
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

              const status = getDayStatus(day);

              let bgClass = 'bg-slate-950/40';
              let borderClass = 'border border-slate-800/60';
              let textClass = 'text-slate-200';
              
              if (status === 1) {
                // Class Held -> Green
                bgClass = 'bg-green-500/20';
                borderClass = 'border border-green-500/40';
                textClass = 'text-green-400 font-bold';
              } else if (status === -4) {
                // Class Not Held (Teacher Leave) -> Red
                bgClass = 'bg-red-500/20';
                borderClass = 'border border-red-500/40';
                textClass = 'text-red-400 font-bold';
              } else if (status === -3) {
                // Institute Holiday -> Amber
                bgClass = 'bg-amber-500/10';
                borderClass = 'border border-amber-500/20';
                textClass = 'text-amber-500 font-bold';
              } else if (status === -2) {
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
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 min-h-[400px] max-h-[80%]">
            
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-800">
              <View className="flex-1 mr-4">
                <Text className="text-slate-100 text-base font-black">
                  Class Attendance
                </Text>
                <Text className="text-slate-400 text-[10px] font-medium mt-0.5">
                  June {selectedDay}, 2026 • {presentCount} Present, {absentCount} Absent
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700/50"
              >
                <Text className="text-slate-100 text-xs font-bold">Close</Text>
              </TouchableOpacity>
            </View>

            {/* Roster List */}
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              <View className="pb-10">
                {attendanceRoster.map((student) => {
                  const isPresent = student.status === 'Present';
                  return (
                    <View
                      key={student.id}
                      className="bg-slate-950/30 border border-slate-800/60 rounded-2xl p-4 mb-3 flex-row justify-between items-center"
                    >
                      <Text className="text-slate-200 text-sm font-bold">{student.name}</Text>
                      
                      <View className={`px-3 py-1 rounded-full border ${
                        isPresent 
                          ? 'bg-green-500/15 border-green-500/25' 
                          : 'bg-red-500/15 border-red-500/25'
                      }`}>
                        <Text className={`text-[10px] font-bold uppercase tracking-wider ${
                          isPresent ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {student.status}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
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
              <Text className="text-slate-400 text-xs mt-1">{user?.phoneNumber || '+917890302020'}</Text>
              <Text className="text-slate-500 text-xs mt-0.5" numberOfLines={1}>
                {user?.email || 'admin@synapseedutech.in'}
              </Text>
            </View>
          </View>

          {/* Teacher Info / Analytics */}
          <Text className="text-slate-100 text-base font-bold mb-4">Teaching Analytics</Text>
          <View className="flex-row flex-wrap justify-between mb-8">
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Batches Managed</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">3</Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Avg Ratings</Text>
              <Text className="text-emerald-400 text-2xl font-black mt-2">4.95/5</Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Feedback Sheets</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">12</Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Teaching Hours</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">140 hrs</Text>
            </View>
          </View>

          {/* Academic Institution Card */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
            <Text className="text-slate-100 text-sm font-bold">Academic Institution Status</Text>
            <View className="flex-row items-center justify-between mt-4">
              <View>
                <Text className="text-slate-300 text-xs font-semibold">The Mathemaniac</Text>
                <Text className="text-slate-500 text-[10px] mt-0.5">Senior Calculus Faculty Member</Text>
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

          {/* Logout */}
          <Button title="Sign Out of Session" onPress={handleLogout} variant="danger" />
        </View>
      </ScrollView>
    </View>
  );
};
