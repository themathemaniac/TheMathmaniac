import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient } from '../../../core/api/client';
import { Skeleton } from '../../../shared/components/Skeleton';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type TestsListNavigationProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

export const TestsListScreen: React.FC = () => {
  const navigation = useNavigation<TestsListNavigationProp>();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/tests');
      setTests(response.data.data);
    } catch (e) {
      console.log('Error pulling tests list:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTests();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      <View className="flex-row justify-between items-center mb-6">
        <View className="flex-1">
          <Text className="text-slate-100 text-2xl font-black">Practice Tests</Text>
          <Text className="text-slate-400 text-sm mt-1 font-medium">
            Challenge yourself with quizzes
          </Text>
        </View>
        <Image
          source={require('../../../../assets/Mathemaniac_Logo_Padded.png')}
          className="w-20 h-14 rounded-full border border-slate-700/60 ml-2"
          resizeMode="cover"
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D8C82" />}
      >
        {loading ? (
          <View className="space-y-4">
            <Skeleton height={100} borderRadius={20} />
            <Skeleton height={100} borderRadius={20} />
          </View>
        ) : tests.length > 0 ? (
          <View className="pb-24">
            {tests.map((test) => (
              <View key={test.id} className="rounded-3xl overflow-hidden mb-4 shadow-md">
                <LinearGradient
                  colors={['rgba(110, 115, 125, 0.95)', 'rgba(80, 85, 95, 0.85)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="p-5 border border-slate-700/30 relative"
                >
                  {/* Top highlight shine */}
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255, 255, 255, 0.45)' }} />

                  <Text className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                    {test.course?.title || 'Open Practice Test'}
                  </Text>
                  <Text className="text-white text-base font-bold mt-2">{test.title}</Text>

                  <View className="flex-row justify-between items-center mt-6 pt-4 border-t border-white/10">
                    <Text className="text-neutral-300 text-xs font-semibold">
                      ⌛ {test.duration} Mins | 📝 {test.totalMarks} Marks
                    </Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('TestInstructions', { testId: test.id })}
                      className="bg-white/15 border border-white/20 px-4 py-2.5 rounded-xl active:bg-white/25"
                    >
                      <Text className="text-white font-bold text-xs uppercase">Attempt</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            ))}
          </View>
        ) : (
          <View className="items-center py-20">
            <Text className="text-4xl">📝</Text>
            <Text className="text-slate-400 font-bold mt-4">No tests published yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
