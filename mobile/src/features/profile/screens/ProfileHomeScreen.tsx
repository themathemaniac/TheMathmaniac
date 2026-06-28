import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../../core/store/auth';
import { apiClient } from '../../../core/api/client';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Button } from '../../../shared/components/Button';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { generateWeeks, getMonthName, formatDateString } from '../../../shared/utils/calendar';

type ProfileHomeNavigationProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

interface AttendanceCalendarProps {
  records: any[];
  loading: boolean;
}

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ records, loading }) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const weeks = generateWeeks(currentYear, currentMonth);

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

  // Convert records array to a map for easy lookup
  const recordMap = new Map(records.map(r => [r.date, r.status]));

  // Calculate percentage of present days across all recorded days in history (Regular class held days)
  const regularRecords = records.filter(r => r.status === 'PRESENT' || r.status === 'ABSENT');
  const presentCount = regularRecords.filter(r => r.status === 'PRESENT').length;
  const totalCount = regularRecords.length;
  const presentPercentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;

  const isFutureDate = (day: number) => {
    const checkDate = new Date(currentYear, currentMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return checkDate > today;
  };

  const handleDayPress = (day: number) => {
    const dayStr = formatDateString(currentYear, currentMonth, day);
    const status = recordMap.get(dayStr);
    const future = isFutureDate(day);

    if (future) {
      Alert.alert('Future Date', 'Class schedule or attendance has not been recorded yet.');
    } else if (status === 'HOLIDAY') {
      Alert.alert('Institute Holiday', `${getMonthName(currentMonth)} ${day}: Institute closed for Holiday.`);
    } else if (status === 'CANCELLED') {
      Alert.alert('Class Cancelled', `${getMonthName(currentMonth)} ${day}: Class was not held because the instructor was on leave.`);
    } else if (status === 'PRESENT') {
      Alert.alert('Attendance Status', `${getMonthName(currentMonth)} ${day}: You attended this class.`);
    } else if (status === 'ABSENT') {
      Alert.alert('Attendance Status', `${getMonthName(currentMonth)} ${day}: You were absent from this class.`);
    } else {
      Alert.alert('Unmarked Date', `${getMonthName(currentMonth)} ${day}: Attendance was not recorded for this day.`);
    }
  };

  return (
    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center gap-1">
          <TouchableOpacity onPress={handlePrevMonth} className="p-1">
            <Text className="text-slate-400 text-xs font-bold">◀</Text>
          </TouchableOpacity>
          <Text className="text-slate-100 text-xs font-bold">
            📅 {getMonthName(currentMonth)} {currentYear}
          </Text>
          <TouchableOpacity onPress={handleNextMonth} className="p-1">
            <Text className="text-slate-400 text-xs font-bold">▶</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color="#2D8C82" />
        ) : (
          <Text className="text-emerald-400 text-xs font-bold">{presentPercentage}% Present</Text>
        )}
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
              const status = recordMap.get(dayStr);
              const future = isFutureDate(day);

              let bgClass = 'bg-transparent';
              let borderClass = 'border border-slate-800';
              let textClass = 'text-slate-400';
              
              if (status === 'PRESENT') {
                bgClass = 'bg-green-500/20';
                borderClass = 'border border-green-500/40';
                textClass = 'text-green-400 font-bold';
              } else if (status === 'ABSENT') {
                bgClass = 'bg-red-500/20';
                borderClass = 'border border-red-500/40';
                textClass = 'text-red-400 font-bold';
              } else if (status === 'HOLIDAY') {
                bgClass = 'bg-amber-500/10';
                borderClass = 'border border-amber-500/20';
                textClass = 'text-amber-500 font-bold';
              } else if (status === 'CANCELLED') {
                bgClass = 'bg-slate-950/40';
                borderClass = 'border border-red-500/20';
                textClass = 'text-red-300 font-bold';
              } else if (future) {
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
          <Text className="text-slate-500 text-[9px] font-medium">Present</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40 mr-1.5" />
          <Text className="text-slate-500 text-[9px] font-medium">Absent</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-2.5 h-2.5 rounded-full bg-slate-950/40 border border-red-500/20 mr-1.5" />
          <Text className="text-slate-500 text-[9px] font-medium">Cancelled</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-2.5 h-2.5 rounded-full bg-amber-500/10 border border-amber-500/20 mr-1.5" />
          <Text className="text-slate-500 text-[9px] font-medium">Holiday</Text>
        </View>
      </View>
    </View>
  );
};

export const ProfileHomeScreen: React.FC = () => {
  const navigation = useNavigation<ProfileHomeNavigationProp>();
  const { logout } = useAuthStore();
  const [profileData, setProfileData] = useState<{
    profile: any;
    stats: {
      purchasedCoursesCount: number;
      completedLecturesCount: number;
      testsAttemptedCount: number;
      averageTestAccuracy: number;
    };
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/profile');
      setProfileData(response.data.data);
    } catch (e) {
      console.log('Error pulling profile data:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      setAttendanceLoading(true);
      const response = await apiClient.get('/attendance/my-attendance');
      if (response.data.success) {
        setAttendanceRecords(response.data.data);
      }
    } catch (e) {
      console.log('Error fetching student attendance:', e);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchAttendance();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchAttendance()]);
    setRefreshing(false);
  };

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D8C82" />}
      >
        {loading ? (
          <View className="space-y-6">
            <Skeleton height={100} borderRadius={24} />
            <Skeleton height={200} borderRadius={24} />
          </View>
        ) : profileData ? (
          <View className="pb-24">
            {/* User Details */}
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 flex-row items-center">
              <View className="w-16 h-16 bg-blue-600 rounded-full justify-center items-center shadow-lg shadow-blue-500/20 mr-4">
                <Text className="text-white text-2xl font-black">
                  {profileData.profile.name.charAt(0)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-slate-100 text-lg font-black">{profileData.profile.name}</Text>
                <Text className="text-slate-400 text-xs mt-1">{profileData.profile.phoneNumber}</Text>
                <Text className="text-slate-500 text-xs mt-0.5" numberOfLines={1}>
                  {profileData.profile.email}
                </Text>
              </View>
            </View>

            {/* Performance Analytics Grid */}
            <Text className="text-slate-100 text-base font-bold mb-4">Performance Analytics</Text>
            <View className="flex-row flex-wrap justify-between mb-8">
              {/* Box 1 */}
              <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                  Programs Unlocked
                </Text>
                <Text className="text-slate-100 text-2xl font-black mt-2">
                  {profileData.stats.purchasedCoursesCount}
                </Text>
              </View>
              {/* Box 2 */}
              <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                  Videos Completed
                </Text>
                <Text className="text-slate-100 text-2xl font-black mt-2">
                  {profileData.stats.completedLecturesCount}
                </Text>
              </View>
              {/* Box 3 */}
              <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                  Tests Attempted
                </Text>
                <Text className="text-slate-100 text-2xl font-black mt-2">
                  {profileData.stats.testsAttemptedCount}
                </Text>
              </View>
              {/* Box 4 */}
              <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                  Avg Accuracy
                </Text>
                <Text className="text-emerald-400 text-2xl font-black mt-2">
                  {profileData.stats.averageTestAccuracy}%
                </Text>
              </View>
            </View>

            {/* Subscriptions Status */}
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
              <Text className="text-slate-100 text-sm font-bold">Academic Institution Status</Text>
              <View className="flex-row items-center justify-between mt-4 pb-4 border-b border-slate-850/80">
                <View>
                  <Text className="text-slate-300 text-xs font-semibold">The Mathemaniac</Text>
                  <Text className="text-slate-500 text-[10px] mt-0.5">{profileData.profile.school || 'Enrolled Student'}</Text>
                </View>
                <View className="bg-blue-600/20 px-3 py-1 rounded-full border border-blue-500/20">
                  <Text className="text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                    Enrolled
                  </Text>
                </View>
              </View>

              {/* Class and Teachers details */}
              <View className="mt-4 space-y-3">
                <View>
                  <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Current Class</Text>
                  <Text className="text-slate-200 text-xs font-bold mt-1">
                    {profileData.profile.class ? `${profileData.profile.class} Standard` : 'N/A'}{profileData.profile.stream ? ` - ${profileData.profile.stream}` : ''}
                  </Text>
                </View>
                <View className="mt-3">
                  <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Assigned Faculty / Instructors</Text>
                  <Text className="text-slate-300 text-xs mt-1 leading-5">
                    {profileData.profile.faculty ? `• ${profileData.profile.faculty}` : '• No Faculty assigned yet'}
                  </Text>
                </View>
              </View>
              {/* Fee Billings Option */}
              <TouchableOpacity
                onPress={() => navigation.navigate('FeePayment')}
                className="mt-4 pt-4 border-t border-slate-800/80 flex-row justify-between items-center active:opacity-80"
              >
                <View>
                  <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Fee Payment Receipts</Text>
                  <Text className="text-slate-300 text-xs font-bold mt-1">View logged monthly fee receipts</Text>
                </View>
                <View className="bg-emerald-600/20 px-3 py-1 rounded-full border border-emerald-500/20">
                  <Text className="text-emerald-400 text-[9px] font-bold uppercase tracking-wider">View 📄</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Attendance calendar component */}
            <AttendanceCalendar records={attendanceRecords} loading={attendanceLoading} />

            {/* Action Buttons */}
            <View className="mb-4 gap-y-4">
              <Button
                title="Change Password"
                onPress={() => navigation.navigate('ChangePassword')}
              />

              {/* Admin Panel Button */}
              {(profileData.profile.role === 'ADMIN' || (profileData.profile.phoneNumber && ['+917980357754', '+919831754957'].includes(profileData.profile.phoneNumber))) && (
                <Button
                  title="Admin Control Panel"
                  onPress={() => navigation.navigate('AdminPanel')}
                />
              )}
            </View>

            {/* Logout */}
            <Button title="Sign Out of Session" onPress={handleLogout} variant="danger" />
          </View>
        ) : (
          <View className="items-center py-20">
            <Text className="text-slate-400 font-bold">Failed to load details.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
