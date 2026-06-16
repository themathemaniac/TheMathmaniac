import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export const TeacherCoursesScreen: React.FC = () => {
  const courses = [
    { id: '1', title: 'IIT-JEE Advanced Mathematics - Calculus Masterclass', enrolled: 24, lectures: 4, category: 'IIT-JEE' },
    { id: '2', title: 'Pre-RMO & IOQM Foundation Mathematics', enrolled: 16, lectures: 3, category: 'Olympiad & Foundation' },
    { id: '3', title: 'BTech Engineering Mathematics - Linear Algebra', enrolled: 8, lectures: 0, category: 'BTech & MTech Math' },
  ];

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      <View className="mb-4">
        <Text className="text-slate-100 text-2xl font-black">My Active Batches</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pb-24">
          {courses.map((course) => (
            <View
              key={course.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4"
            >
              <Text className="text-slate-500 text-[9px] font-black tracking-widest uppercase border border-slate-800 bg-slate-950 px-2 py-0.5 rounded-md mr-2 self-start">
                {course.category}
              </Text>
              
              <Text className="text-slate-100 text-base font-bold mt-3">
                {course.title}
              </Text>

              <View className="flex-row mt-4 pt-3 border-t border-slate-800/80 justify-between">
                <View>
                  <Text className="text-slate-500 text-[9px] uppercase font-bold">Enrolled Students</Text>
                  <Text className="text-slate-200 text-sm font-bold mt-0.5">👥 {course.enrolled} Enrolled</Text>
                </View>
                <View className="items-end">
                  <Text className="text-slate-500 text-[9px] uppercase font-bold">Video Lectures</Text>
                  <Text className="text-slate-200 text-sm font-bold mt-0.5">🎬 {course.lectures} Lectures</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};
