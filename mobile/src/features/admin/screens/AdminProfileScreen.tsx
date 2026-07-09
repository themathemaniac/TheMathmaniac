import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, Modal, TouchableOpacity, ActivityIndicator, TextInput, Image } from 'react-native';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { apiClient } from '../../../core/api/client';

type AdminProfileNavigationProp = StackNavigationProp<RootStackParamList, 'AdminPanel'>;

export const AdminProfileScreen: React.FC = () => {
  const navigation = useNavigation<AdminProfileNavigationProp>();
  const { user, logout, updateName } = useAuthStore();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  const handleEditNameSubmit = async () => {
    if (!editNameValue.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }
    setSavingName(true);
    const success = await updateName(editNameValue.trim());
    if (success) {
      setIsEditingName(false);
    } else {
      Alert.alert('Error', useAuthStore.getState().error || 'Failed to update name.');
    }
    setSavingName(false);
  };

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get('/profile');
      if (res.data.success) {
        setProfileData(res.data.data.profile);
      }
    } catch (e) {
      console.log('Error fetching admin profile:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

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

  const getDayName = (dayOfWeek: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  };

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-6">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mr-3 bg-slate-900 border border-slate-800 p-2 rounded-xl"
          >
            <Text className="text-slate-300 text-xs font-bold">◀ Back</Text>
          </TouchableOpacity>
          <View>
            <Text className="text-slate-100 text-2xl font-black">Admin Profile</Text>
            <Text className="text-slate-400 text-xs mt-1">Management details</Text>
          </View>
        </View>
        <Image
          source={require('../../../../assets/Mathemaniac_Logo_Padded.png')}
          className="w-16 h-12 rounded-full border border-slate-700/60"
          resizeMode="cover"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pb-24">
          {/* User Details */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 flex-row items-center">
            <View className="w-16 h-16 bg-blue-600 rounded-full justify-center items-center shadow-lg shadow-blue-500/20 mr-4">
              <Text className="text-white text-2xl font-black">
                {user?.name?.charAt(0) || 'A'}
              </Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between pr-2">
                <Text className="text-slate-100 text-lg font-black">{user?.name || 'Admin'}</Text>
                <TouchableOpacity onPress={() => { setEditNameValue(user?.name || ''); setIsEditingName(true); }} className="p-2">
                  <Text className="text-blue-500 text-xs font-bold">✎ Edit</Text>
                </TouchableOpacity>
              </View>
              <Text className="text-slate-400 text-xs mt-1">{user?.phoneNumber || ''}</Text>
              <Text className="text-slate-500 text-xs mt-0.5" numberOfLines={1}>
                {user?.email || 'Administrator'}
              </Text>
            </View>
          </View>

          {/* Routine and Branch Info */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
            <Text className="text-slate-100 text-sm font-bold mb-4">Shift Routine & Branch</Text>
            {loading ? (
              <ActivityIndicator size="small" color="#2D8C82" />
            ) : profileData?.adminWeeklyPatterns && profileData.adminWeeklyPatterns.length > 0 ? (
              profileData.adminWeeklyPatterns.map((pattern: any) => (
                <View key={pattern.id} className="mb-3 pb-3 border-b border-slate-800/80">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-slate-200 text-xs font-bold">{getDayName(pattern.dayOfWeek)}</Text>
                    <View className="bg-blue-600/20 px-2 py-0.5 rounded border border-blue-500/20">
                      <Text className="text-blue-400 text-[10px] font-bold uppercase">{pattern.branch}</Text>
                    </View>
                  </View>
                  <Text className="text-slate-400 text-[10px]">Time: {pattern.startTime} - {pattern.endTime}</Text>
                  <Text className="text-slate-500 text-[9px] mt-0.5 italic">Type: {pattern.type.replace('_', ' ')}</Text>
                </View>
              ))
            ) : (
              <Text className="text-slate-500 text-xs italic">No weekly patterns assigned.</Text>
            )}
          </View>

          {/* Action Buttons */}
          <View className="mb-4 gap-y-4">
            <Button
              title="Change Password"
              onPress={() => navigation.navigate('ChangePassword' as any)}
            />
          </View>

          {/* Logout */}
          <Button title="Sign Out of Session" onPress={handleLogout} variant="danger" />
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal visible={isEditingName} animationType="fade" transparent onRequestClose={() => setIsEditingName(false)}>
        <View className="flex-1 justify-center items-center bg-black/80 px-5">
          <View className="bg-slate-900 w-full rounded-3xl p-6 border border-slate-800">
            <Text className="text-slate-100 text-lg font-bold mb-4">Edit Profile Name</Text>
            <TextInput
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm mb-6"
              value={editNameValue}
              onChangeText={setEditNameValue}
              placeholder="Enter your name"
              placeholderTextColor="#5C5446"
              autoFocus
            />
            <View className="flex-row justify-end gap-3">
              <TouchableOpacity onPress={() => setIsEditingName(false)} className="px-5 py-2.5 rounded-xl border border-slate-700">
                <Text className="text-slate-300 font-bold text-xs">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEditNameSubmit} disabled={savingName} className="px-5 py-2.5 rounded-xl bg-blue-600">
                <Text className="text-white font-bold text-xs">{savingName ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
