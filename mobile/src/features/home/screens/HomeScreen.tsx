import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, Image, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../../core/store/auth';
import { apiClient } from '../../../core/api/client';
import { CourseCard } from '../../../shared/components/CourseCard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type HomeScreenProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenProp>();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<{
    courses: any[];
    announcements: any[];
    tests: any[];
    stats: any;
    resumeLecture: any | null;
  }>({
    courses: [],
    announcements: [],
    tests: [],
    stats: null,
    resumeLecture: null,
  });
  const [feeStatus, setFeeStatus] = useState<{
    hasPendingFee: boolean;
    pendingFeeMonth: string;
    pendingFeeAmount: number;
    pendingFeeFine: number;
    pendingFeeTotal: number;
  } | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      // Fetch details in parallel
      const [coursesRes, profileRes, announceRes, testsRes, feesRes] = await Promise.all([
        apiClient.get('/courses'),
        apiClient.get('/profile'),
        apiClient.get('/profile/announcements'),
        apiClient.get('/tests'),
        apiClient.get('/payments/fees'),
      ]);

      const courses = coursesRes.data.data;
      const stats = profileRes.data.data.stats;
      const announcements = announceRes.data.data;
      const tests = testsRes.data.data;
      const fees = feesRes.data.data || [];

      // Find the first pending fee (representing the most urgent overdue/pending fee)
      const firstPending = fees.find((f: any) => f.status === 'PENDING');
      if (firstPending) {
        setFeeStatus({
          hasPendingFee: true,
          pendingFeeMonth: firstPending.month,
          pendingFeeAmount: firstPending.amount,
          pendingFeeFine: firstPending.fine,
          pendingFeeTotal: firstPending.totalAmount,
        });
      } else {
        setFeeStatus(null);
      }

      // Extract resume lecture from purchased courses progress
      let resumeLecture = null;
      const purchasedCourse = courses.find(
        (c: any) => c.isPurchased
      );

      if (purchasedCourse) {
        const detailRes = await apiClient.get(`/courses/${purchasedCourse.id}`);
        const outline = detailRes.data.data.lectures;
        const incomplete = outline.find((l: any) => !l.completed);
        if (incomplete) {
          resumeLecture = {
            ...incomplete,
            courseTitle: purchasedCourse.title,
          };
        }
      }

      setDashboardData({
        courses,
        announcements,
        tests,
        stats,
        resumeLecture,
      });
    } catch (e) {
      console.log('Error pulling dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="bg-slate-900 border-b border-slate-800/80 px-6 pt-14 pb-4 flex-row justify-between items-center">
        <View>
          <Text className="text-slate-500 text-xs font-semibold tracking-widest uppercase">
            Mathemaniac
          </Text>
          <Text className="text-slate-100 text-lg font-black mt-0.5">
            Hey, {user?.name.split(' ')[0] || 'Student'}! 👋
          </Text>
        </View>
        <TouchableOpacity
          className="w-10 h-10 bg-slate-800 border border-slate-700/60 rounded-full justify-center items-center active:bg-slate-700"
          onPress={() => navigation.navigate('AppTabs', { screen: 'Profile' })}
        >
          <Text className="text-lg">👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D8C82" />}
      >
        {loading ? (
          // Loading skeletons
          <View className="space-y-6">
            <Skeleton height={140} borderRadius={24} />
            <Skeleton height={200} borderRadius={24} />
            <Skeleton height={100} borderRadius={24} />
          </View>
        ) : (
          <View className="pb-12">
            {/* Fee Payment Reminder Banners */}
            {feeStatus?.hasPendingFee && (
              (() => {
                const [year, monthNum] = feeStatus.pendingFeeMonth.split('-');
                const monthNames = [
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ];
                const monthName = monthNames[parseInt(monthNum, 10) - 1] || 'Month';
                const hasFine = feeStatus.pendingFeeFine > 0;
                
                return (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('FeePayment')}
                    className={`rounded-3xl p-5 mb-6 shadow-md border ${
                      hasFine 
                        ? 'bg-red-950/90 border-red-800 shadow-red-900/10' 
                        : 'bg-yellow-950/90 border-yellow-800 shadow-yellow-900/10'
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className={`text-xs font-black uppercase tracking-widest ${
                        hasFine ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        {hasFine ? '🚨 Overdue Fee Alert' : '⚠️ Monthly Fee Reminder'}
                      </Text>
                      <Text className="text-white text-xs font-bold font-mono">
                        ₹{(feeStatus.pendingFeeTotal / 100).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <Text className="text-white text-[13px] mt-2 font-bold leading-5">
                      {hasFine
                        ? `Your fee for ${monthName} ${year} is overdue! A late payment fine of ₹50 has been applied.`
                        : `Please pay your tuition fee for ${monthName} ${year} by the 10th to avoid a late fee penalty of ₹50.`}
                    </Text>
                    <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-white/10">
                      <Text className="text-slate-400 text-[10px] font-semibold">
                        Click here to view invoice & clear dues
                      </Text>
                      <View className={`px-3 py-1 rounded-full ${hasFine ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                        <Text className={`text-[10px] font-bold ${hasFine ? 'text-red-400' : 'text-yellow-400'}`}>
                          Pay Now
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })()
            )}

            {/* 1. Continue Learning Banner */}
            {dashboardData.resumeLecture && (
              <View className="bg-blue-600/95 border border-blue-500 rounded-3xl p-5 mb-6 shadow-md shadow-blue-900/20">
                <View className="flex-row items-center justify-between">
                  <Text className="text-blue-200 text-xs font-bold uppercase tracking-widest">
                    ⚡ Continue Learning
                  </Text>
                  <Text className="text-blue-100 text-xs font-semibold">
                    Lecture {dashboardData.resumeLecture.sortOrder}
                  </Text>
                </View>
                <Text className="text-white text-lg font-black mt-2 leading-6" numberOfLines={1}>
                  {dashboardData.resumeLecture.title}
                </Text>
                <Text className="text-blue-100 text-xs mt-1 font-medium" numberOfLines={1}>
                  Course: {dashboardData.resumeLecture.courseTitle}
                </Text>

                <View className="flex-row justify-between items-center mt-5 pt-4 border-t border-blue-500/40">
                  <View className="flex-row items-center">
                    <Text className="text-white font-bold text-sm">Resume Playback</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('LecturePlayer', {
                        lectureId: dashboardData.resumeLecture.id,
                      })
                    }
                    className="bg-white px-5 py-2.5 rounded-full active:opacity-90"
                  >
                    <Text className="text-blue-600 font-bold text-xs uppercase">Resume</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 2. Your Courses Carousel */}
            <View className="mb-6">
              <View className="flex-row justify-between items-baseline mb-3">
                <Text className="text-slate-100 text-lg font-bold">Your Courses</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AppTabs', { screen: 'Courses' })}>
                  <Text className="text-blue-600 text-xs font-bold">See All</Text>
                </TouchableOpacity>
              </View>

              {dashboardData.courses.filter(c => c.isPurchased).length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                  {dashboardData.courses.filter(c => c.isPurchased).map((course) => (
                    <CourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      category={course.targetClass ? `Class ${course.targetClass}` : course.category?.name || 'Program'}
                      price={course.price}
                      thumbnailUrl={course.thumbnailUrl}
                      lectureCount={course.lectureCount}
                      isPurchased={course.isPurchased}
                      teacherName={course.teachers && course.teachers.length > 0 ? course.teachers.map((t: any) => t.user?.name).filter(Boolean).join(', ') : course.instructorName}
                      onPress={() => navigation.navigate('CourseDetails', { courseId: course.id })}
                    />
                  ))}
                </ScrollView>
              ) : (
                <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 items-center justify-center">
                  <Text className="text-3xl mb-2">📚</Text>
                  <Text className="text-slate-300 font-semibold text-center">
                    You have not enrolled in any course yet.
                  </Text>
                  <Text className="text-slate-500 text-xs text-center mt-1">
                    Explore our programs below to get started!
                  </Text>
                </View>
              )}
            </View>

            {/* 2b. Recommended Courses Carousel */}
            <View className="mb-6">
              <View className="flex-row justify-between items-baseline mb-3">
                <Text className="text-slate-100 text-lg font-bold">Recommended Programs</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AppTabs', { screen: 'Courses' })}>
                  <Text className="text-blue-600 text-xs font-bold">See All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                {dashboardData.courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    category={course.targetClass ? `Class ${course.targetClass}` : course.category?.name || 'Program'}
                    price={course.price}
                    thumbnailUrl={course.thumbnailUrl}
                    lectureCount={course.lectureCount}
                    isPurchased={course.isPurchased}
                    teacherName={course.teachers && course.teachers.length > 0 ? course.teachers.map((t: any) => t.user?.name).filter(Boolean).join(', ') : course.instructorName}
                    onPress={() => navigation.navigate('CourseDetails', { courseId: course.id })}
                  />
                ))}
              </ScrollView>
            </View>

            {/* 3. Upcoming Tests */}
            <View className="mb-6">
              <Text className="text-slate-100 text-lg font-bold mb-3">Upcoming Practice Tests</Text>
              {dashboardData.tests.map((test) => (
                <View key={test.id} className="rounded-2xl overflow-hidden mb-3 shadow-md">
                  <LinearGradient
                    colors={['rgba(110, 115, 125, 0.95)', 'rgba(80, 85, 95, 0.85)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="p-4 flex-row justify-between items-center border border-slate-700/30 relative"
                  >
                    {/* Top highlight shine */}
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255, 255, 255, 0.45)' }} />

                    <View className="flex-1 mr-3">
                      <Text className="text-xs text-emerald-400 font-bold uppercase">
                        {test.course?.title || 'Open Practice Test'}
                      </Text>
                      <Text className="text-white text-sm font-bold mt-1">{test.title}</Text>
                      <Text className="text-xs text-neutral-300 mt-1">
                        ⌛ {test.duration} Mins | 📝 {test.totalMarks} Marks
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('TestInstructions', { testId: test.id })}
                      className="bg-white/10 border border-white/20 px-4 py-2 rounded-xl active:bg-white/20"
                    >
                      <Text className="text-white font-bold text-xs uppercase">Attempt</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              ))}
            </View>

            {/* 5. Recent Announcements */}
            <View className="mb-6">
              <Text className="text-slate-100 text-lg font-bold mb-3">Recent Announcements</Text>
              {(() => {
                const courseAnnouncements = dashboardData.announcements.filter(
                  (item) => item.courseId && item.course
                );
                if (courseAnnouncements.length === 0) {
                  return <Text className="text-slate-500 text-xs italic">No recent announcements.</Text>;
                }
                return courseAnnouncements.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      if (item.courseId) {
                        navigation.navigate('CourseDetails', { courseId: item.courseId, initialTab: 'NOTICES' });
                      }
                    }}
                    className="rounded-2xl border p-4 mb-3 active:opacity-90 shadow-sm"
                    style={{
                      backgroundColor: '#1e293b', // Dark Slate bg
                      borderColor: '#334155',     // Slate border
                    }}
                  >
                    <View className="flex-row justify-between items-baseline mb-2">
                      <Text className="text-xs font-black uppercase tracking-wider" style={{ color: '#60a5fa' }}>
                        {item.course?.title || 'Announcement'}
                      </Text>
                      <Text className="text-[9px] font-bold" style={{ color: '#94a3b8' }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    <Text className="font-extrabold text-sm" style={{ color: '#f8fafc' }}>{item.title}</Text>
                    <Text className="text-xs mt-2 leading-5" style={{ color: '#cbd5e1' }}>{item.content}</Text>
                    
                    <View className="mt-3 pt-2 border-t border-slate-700 flex-row justify-between items-center">
                      <Text className="text-[10px] font-bold" style={{ color: '#94a3b8' }}>
                        👤 Teacher: {item.authorName || item.course?.instructorName || 'Instructor'}
                      </Text>
                      <Text className="text-[9px] font-bold" style={{ color: '#60a5fa' }}>
                        View in Batch →
                      </Text>
                    </View>
                  </TouchableOpacity>
                ));
              })()}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

