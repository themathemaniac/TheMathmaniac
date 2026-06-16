import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, Image } from 'react-native';
import { useAuthStore } from '../../../core/store/auth';
import { apiClient } from '../../../core/api/client';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Button } from '../../../shared/components/Button';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type ProfileHomeNavigationProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

const AttendanceCalendar: React.FC = () => {
  // June 2026: 30 days, starts on Monday
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  
  // Custom mock attendance record
  // 1 = Present, 0 = Absent, -3 = Holiday, -4 = Teacher Leave, -2 = Future/Unmarked
  const getAttendanceStatus = (day: number) => {
    if (day > 15) return -2; // Future
    if (day === 11) return -3; // Holiday
    if ([5, 12].includes(day)) return -4; // Teacher Leave (Class Not Held)
    if ([3, 10].includes(day)) return 0; // Absent
    return 1; // Present
  };

  const weeks = [
    [1, 2, 3, 4, 5, 6, 7],
    [8, 9, 10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19, 20, 21],
    [22, 23, 24, 25, 26, 27, 28],
    [29, 30, null, null, null, null, null],
  ];

  const handleDayPress = (day: number) => {
    const status = getAttendanceStatus(day);
    if (status === -2) {
      Alert.alert('Future Date', 'Class schedule or attendance has not been recorded yet.');
    } else if (status === -3) {
      Alert.alert('Institute Holiday', 'June 11: Institute closed for Holiday.');
    } else if (status === -4) {
      Alert.alert('Class Cancelled', `June ${day}: Class was not held because the instructor was on leave.`);
    } else if (status === 1) {
      Alert.alert('Attendance Status', `June ${day}: You attended this class.`);
    } else if (status === 0) {
      Alert.alert('Attendance Status', `June ${day}: You were absent from this class.`);
    }
  };

  return (
    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-slate-100 text-sm font-bold">📅 June 2026 Attendance</Text>
        <Text className="text-emerald-400 text-xs font-bold">83.3% Present</Text>
      </View>
      
      {/* Weekday headers */}
      <View className="flex-row justify-between mb-2">
        {weekDays.map((wd, idx) => (
          <View key={idx} className="w-8 items-center">
            <Text className="text-slate-500 text-[10px] font-bold">{wd}</Text>
          </View>
        ))}
      </View>
      
      {/* Days grid - rendering week by week for perfect alignment */}
      <View className="mb-2">
        {weeks.map((week, wIdx) => (
          <View key={wIdx} className="flex-row justify-between mb-1.5">
            {week.map((day, dIdx) => {
              if (day === null) {
                return <View key={`empty-${dIdx}`} className="w-8 h-8" />;
              }

              const status = getAttendanceStatus(day);
              let bgClass = 'bg-transparent';
              let borderClass = 'border border-slate-800';
              let textClass = 'text-slate-400';
              
              if (status === 1) {
                bgClass = 'bg-green-500/20';
                borderClass = 'border border-green-500/40';
                textClass = 'text-green-400 font-bold';
              } else if (status === 0) {
                bgClass = 'bg-red-500/20';
                borderClass = 'border border-red-500/40';
                textClass = 'text-red-400 font-bold';
              } else if (status === -3) {
                bgClass = 'bg-amber-500/10';
                borderClass = 'border border-amber-500/20';
                textClass = 'text-amber-500 font-bold';
              } else if (status === -4) {
                bgClass = 'bg-slate-950/40';
                borderClass = 'border border-red-500/20';
                textClass = 'text-red-300 font-bold';
              } else if (status === -2) {
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

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A2222" />}
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
                  <Text className="text-slate-500 text-[10px] mt-0.5">Madhyamgram Branch Student</Text>
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
                  <Text className="text-slate-200 text-xs font-bold mt-1">12th Standard - IIT-JEE Advanced Batch</Text>
                </View>
                <View className="mt-3">
                  <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Assigned Faculty / Instructors</Text>
                  <Text className="text-slate-300 text-xs mt-1 leading-5">
                    • <Text className="font-bold text-slate-200">Prof. S. Sen</Text> (Calculus){'\n'}
                    • <Text className="font-bold text-slate-200">S. K. Dey</Text> (Algebra & Olympiad Math)
                  </Text>
                </View>
              </View>
            </View>

            {/* Attendance calendar component */}
            <AttendanceCalendar />

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
