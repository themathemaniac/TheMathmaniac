import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../../core/store/auth';
import { apiClient } from '../../../core/api/client';

export const TeacherHomeScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalStudents: number;
    totalCourses: number;
    totalTests: number;
    totalMaterials: number;
  } | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/profile');
      if (res.data.success) {
        setStats(res.data.data.stats);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="bg-slate-900 border-b border-slate-800/80 px-6 pt-14 pb-4 flex-row justify-between items-center">
        <View>
          <Text className="text-slate-500 text-xs font-semibold tracking-widest uppercase">
            Mathemaniac Faculty
          </Text>
          <Text className="text-slate-100 text-lg font-black mt-0.5">
            Hey, {user?.name || 'Instructor'}! 👨‍🏫
          </Text>
        </View>
        <View className="w-10 h-10 bg-slate-800 border border-slate-700/60 rounded-full justify-center items-center">
          <Text className="text-lg">👨‍🏫</Text>
        </View>
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
            {/* Welcome Card */}
            <View className="bg-blue-600/95 border border-blue-500 rounded-3xl p-5 mb-6">
              <Text className="text-blue-200 text-xs font-bold uppercase tracking-widest">
                ⚡ Welcome, Instructor
              </Text>
              <Text className="text-white text-lg font-black mt-2 leading-6">
                Mathemaniac Faculty Control Panel
              </Text>
              <Text className="text-blue-100 text-xs mt-1 font-medium">
                Access and manage your courses, study materials, tests, and attendance tracking dynamically.
              </Text>
            </View>

            {/* Quick Statistics Grid */}
            <Text className="text-slate-100 text-base font-bold mb-3">Academic Stats Overview</Text>
            <View className="flex-row flex-wrap justify-between mb-6">
              <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">My Students</Text>
                <Text className="text-slate-100 text-2xl font-black mt-2">{stats?.totalStudents ?? 0}</Text>
              </View>
              <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Active Batches</Text>
                <Text className="text-slate-100 text-2xl font-black mt-2">{stats?.totalCourses ?? 0}</Text>
              </View>
              <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Quizzes Created</Text>
                <Text className="text-emerald-400 text-2xl font-black mt-2">{stats?.totalTests ?? 0}</Text>
              </View>
              <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Resources Shared</Text>
                <Text className="text-slate-100 text-2xl font-black mt-2">{stats?.totalMaterials ?? 0}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
