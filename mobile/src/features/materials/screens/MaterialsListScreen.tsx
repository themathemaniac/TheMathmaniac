import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Alert } from 'react-native';
import { apiClient } from '../../../core/api/client';
import { Skeleton } from '../../../shared/components/Skeleton';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type MaterialsListNavigationProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

export const MaterialsListScreen: React.FC = () => {
  const navigation = useNavigation<MaterialsListNavigationProp>();
  const [materials, setMaterials] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/materials');
      setMaterials(response.data.data);
    } catch (e) {
      console.log('Error pulling materials:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMaterials();
    setRefreshing(false);
  };

  const handleOpenMaterial = (material: any) => {
    if (material.isAccessible) {
      navigation.navigate('PDFViewer', {
        fileUrl: material.fileUrl,
        title: material.title,
      });
    } else {
      Alert.alert(
        'Resource Locked',
        'This material is part of a premium program. Please enroll in the course to unlock access.'
      );
    }
  };

  // Filter and search calculations
  const filteredMaterials = materials.filter((item) => {
    const matchesFilter = activeFilter === 'ALL' || item.type === activeFilter;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb > 1024) {
      return `${(kb / 1024).toFixed(1)} MB`;
    }
    return `${Math.round(kb)} KB`;
  };

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      {/* Header */}
      <View className="mb-4">
        <Text className="text-slate-100 text-2xl font-black">Study Resources</Text>
        {/* Search */}
        <View className="bg-slate-900 border border-slate-800 rounded-2xl flex-row items-center px-4 py-3.5 mt-4">
          <Text className="text-slate-400 mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-slate-100 font-semibold"
            placeholder="Search formulas, mock assignments..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="flex-row justify-between mb-4">
        {['ALL', 'NOTES', 'ASSIGNMENT', 'FORMULA_SHEET'].map((filter) => {
          let label = 'All';
          if (filter === 'NOTES') label = 'Notes';
          if (filter === 'ASSIGNMENT') label = 'Sheets';
          if (filter === 'FORMULA_SHEET') label = 'Formulas';

          return (
            <TouchableOpacity
              key={filter}
              onPress={() => setActiveFilter(filter)}
              className={`px-4 py-2.5 rounded-full border ${
                activeFilter === filter
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <Text className={`font-semibold text-xs ${activeFilter === filter ? 'text-white' : 'text-slate-400'}`}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Materials List Scroll */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        {loading ? (
          <View className="space-y-4">
            <Skeleton height={80} borderRadius={16} />
            <Skeleton height={80} borderRadius={16} />
            <Skeleton height={80} borderRadius={16} />
          </View>
        ) : filteredMaterials.length > 0 ? (
          <View className="pb-24">
            {filteredMaterials.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleOpenMaterial(item)}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3 flex-row justify-between items-center active:opacity-90"
              >
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center">
                    <Text className="text-slate-500 text-[9px] font-black tracking-widest uppercase border border-slate-800 bg-slate-950 px-2 py-0.5 rounded-md mr-2">
                      {item.type.replace('_', ' ')}
                    </Text>
                    <Text className="text-slate-400 text-[10px]" numberOfLines={1}>
                      {item.courseTitle}
                    </Text>
                  </View>
                  <Text className="text-slate-100 text-sm font-bold mt-2" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text className="text-slate-400 text-xs mt-1">Size: {formatSize(item.fileSize)}</Text>
                </View>

                {/* Lock icon / arrow */}
                <View className="bg-slate-800 w-10 h-10 rounded-full justify-center items-center border border-slate-700/50">
                  <Text className="text-base">{item.isAccessible ? '📄' : '🔒'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View className="items-center py-20">
            <Text className="text-4xl">📂</Text>
            <Text className="text-slate-400 font-bold mt-4">No resources found.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
