import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useAuthStore } from '../../../core/store/auth';

export const TeacherHomeScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A2222" />}
      >
        <View className="pb-12">
          {/* Quick Info Card */}
          <View className="bg-blue-600/95 border border-blue-500 rounded-3xl p-5 mb-6">
            <Text className="text-blue-200 text-xs font-bold uppercase tracking-widest">
              ⚡ Batch Performance Summary
            </Text>
            <Text className="text-white text-lg font-black mt-2 leading-6">
              IIT-JEE Advanced Calculus Batch
            </Text>
            <Text className="text-blue-100 text-xs mt-1 font-medium">
              Average Score on last test: 23.4 / 30 Marks (78%)
            </Text>
          </View>

          {/* Quick Statistics Grid */}
          <Text className="text-slate-100 text-base font-bold mb-3">Academic Stats Overview</Text>
          <View className="flex-row flex-wrap justify-between mb-6">
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">My Students</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">48</Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Active Batches</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">3</Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Avg Class Score</Text>
              <Text className="text-emerald-400 text-2xl font-black mt-2">82%</Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Resources Shared</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">15</Text>
            </View>
          </View>

          {/* Class Batches Schedule */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
            <Text className="text-slate-100 text-sm font-bold mb-4">📅 Today's Live Lecture Schedule</Text>
            <View className="space-y-3">
              {[
                { title: 'Limits & Differentiability Practice', time: '04:00 PM', batch: 'IIT-JEE (A-1)' },
                { title: 'Modular Arithmetic Foundation', time: '06:00 PM', batch: 'Olympiad IOQM' },
              ].map((sch, idx) => (
                <View key={idx} className="flex-row justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-800/40 my-1">
                  <View className="flex-1 mr-2">
                    <Text className="text-slate-200 text-xs font-bold">{sch.title}</Text>
                    <Text className="text-slate-500 text-[10px] mt-0.5">{sch.batch}</Text>
                  </View>
                  <Text className="text-blue-400 text-xs font-mono font-bold">{sch.time}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
