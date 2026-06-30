import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, Image } from 'react-native';
import { apiClient } from '../../../core/api/client';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type TeacherMaterialsNavigationProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

export const TeacherMaterialsScreen: React.FC = () => {
  const navigation = useNavigation<TeacherMaterialsNavigationProp>();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const matRes = await apiClient.get('/materials');
      setMaterials(matRes.data.data);
    } catch (e) {
      console.log('Error loading teacher materials:', e);
      Alert.alert('Load Error', 'Failed to retrieve files.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Confirm Delete', `Are you sure you want to permanently delete: "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await apiClient.delete(`/materials/${id}`);
            Alert.alert('Deleted', 'Document has been removed.');
            fetchMaterials();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete study material.');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb > 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${Math.round(kb)} KB`;
  };

  const filteredMaterials = materials.filter(m => 
    (m.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (m.courseTitle?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-1">
          <Text className="text-slate-100 text-2xl font-black">All Study Resources</Text>
          <Text className="text-slate-400 text-xs mt-1">Manage all your uploaded materials across batches</Text>
        </View>
        <Image
          source={require('../../../../assets/Mathemaniac_Logo_Padded.png')}
          className="w-20 h-14 rounded-full border border-slate-700/60 ml-2"
          resizeMode="cover"
        />
      </View>

      <TextInput
        className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm mb-6"
        placeholder="Search by title or batch name..."
        placeholderTextColor="#64748b"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2D8C82" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="pb-24">
            {filteredMaterials.length > 0 ? (
              filteredMaterials.map((item) => (
                <View
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3 flex-row justify-between items-center"
                >
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center flex-wrap">
                      <Text className="text-slate-500 text-[8px] font-black tracking-widest uppercase border border-slate-800 bg-slate-950 px-2 py-0.5 rounded-md mr-2 my-0.5">
                        {item.type.replace('_', ' ')}
                      </Text>
                      <Text className="text-blue-400 text-[10px] font-bold" numberOfLines={1}>
                        {item.courseTitle}
                      </Text>
                    </View>
                    <Text className="text-slate-200 text-sm font-bold mt-2">
                      {item.title}
                    </Text>
                    <Text className="text-slate-400 text-xs mt-1">Size: {formatSize(item.fileSize)}</Text>
                  </View>

                  {/* Action triggers */}
                  <View className="flex-row items-center space-x-2">
                    <TouchableOpacity
                      onPress={() => navigation.navigate('PDFViewer', { title: item.title, fileUrl: item.fileUrl })}
                      className="bg-slate-800 w-8 h-8 rounded-full justify-center items-center border border-slate-700/50"
                    >
                      <Text className="text-xs">👁️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(item.id, item.title)}
                      className="bg-slate-800 w-8 h-8 rounded-full justify-center items-center border border-slate-700/50 ml-2"
                    >
                      <Text className="text-xs">🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View className="items-center py-20">
                <Text className="text-4xl">📂</Text>
                <Text className="text-slate-400 font-bold mt-4">No materials found.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};
