import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../../../core/api/client';
import { Skeleton } from '../../../shared/components/Skeleton';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type AllAnnouncementsScreenProp = StackNavigationProp<RootStackParamList, 'AllAnnouncements'>;

export const AllAnnouncementsScreen: React.FC = () => {
  const navigation = useNavigation<AllAnnouncementsScreenProp>();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/profile/announcements?limit=all');
      setAnnouncements(res.data.data || []);
    } catch (error) {
      console.log('Error fetching all announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnnouncements();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="bg-slate-900 border-b border-slate-800/80 px-4 pt-14 pb-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mr-4 p-2"
        >
          <Text className="text-white text-lg font-bold">←</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">All Announcements</Text>
      </View>

      {loading ? (
        <View className="p-4 space-y-4">
          <Skeleton height={120} borderRadius={16} />
          <Skeleton height={120} borderRadius={16} />
          <Skeleton height={120} borderRadius={16} />
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          className="flex-1 px-4 pt-4"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D8C82" />
          }
          ListEmptyComponent={
            <View className="items-center justify-center mt-10">
              <Text className="text-slate-500 text-sm italic">No announcements found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                if (item.courseId) {
                  navigation.navigate('CourseDetails', { courseId: item.courseId, initialTab: 'NOTICES' });
                }
              }}
              className="rounded-2xl border p-4 mb-4 active:opacity-90 shadow-sm"
              style={{
                backgroundColor: '#1e293b',
                borderColor: '#334155',
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

              <Text className="font-extrabold text-sm mb-2" style={{ color: '#f8fafc' }}>
                {item.title}
              </Text>
              <Text className="text-xs leading-5" style={{ color: '#cbd5e1' }}>
                {item.content}
              </Text>

              <View className="mt-3 pt-2 border-t border-slate-700 flex-row justify-between items-center">
                <Text className="text-[10px] font-bold" style={{ color: '#94a3b8' }}>
                  👤 Teacher: {item.authorName || item.course?.instructorName || 'Instructor'}
                </Text>
                <Text className="text-[9px] font-bold" style={{ color: '#60a5fa' }}>
                  View in Batch →
                </Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
};
