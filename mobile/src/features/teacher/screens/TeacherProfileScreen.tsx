import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, Modal, TouchableOpacity, ActivityIndicator, TextInput, Image } from 'react-native';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { generateWeeks, getMonthName, formatDateString } from '../../../shared/utils/calendar';
import { apiClient } from '../../../core/api/client';

type TeacherProfileNavigationProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

export const TeacherProfileScreen: React.FC = () => {
  const navigation = useNavigation<TeacherProfileNavigationProp>();
  const { user, logout, updateName } = useAuthStore();
  const [profileStats, setProfileStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

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

  const fetchStats = async () => {
    try {
      const res = await apiClient.get('/profile');
      if (res.data.success) {
        setProfileStats(res.data.data.stats);
      }
    } catch (e) {
      console.log('Error fetching profile stats:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
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

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-slate-100 text-2xl font-black">Instructor Profile</Text>
          <Text className="text-slate-400 text-xs mt-1">Faculty Info & Ledger Status</Text>
        </View>
        <Image
          source={require('../../../../assets/Mathemaniac_Logo_Padded.png')}
          className="w-20 h-14 rounded-full border border-slate-700/60"
          resizeMode="cover"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pb-24">
          {/* User Details */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 flex-row items-center">
            <View className="w-16 h-16 bg-blue-600 rounded-full justify-center items-center shadow-lg shadow-blue-500/20 mr-4">
              <Text className="text-white text-2xl font-black">
                {user?.name?.charAt(0) || 'T'}
              </Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between pr-2">
                <Text className="text-slate-100 text-lg font-black">{user?.name || 'Instructor'}</Text>
                <TouchableOpacity onPress={() => { setEditNameValue(user?.name || ''); setIsEditingName(true); }} className="p-2">
                  <Text className="text-blue-500 text-xs font-bold">✎ Edit</Text>
                </TouchableOpacity>
              </View>
              <Text className="text-slate-400 text-xs mt-1">{user?.phoneNumber || ''}</Text>
              <Text className="text-slate-500 text-xs mt-0.5" numberOfLines={1}>
                {user?.email || ''}
              </Text>
            </View>
          </View>

          {/* Academic Stats Overview */}
          <Text className="text-slate-100 text-base font-bold mb-4">Academic Stats Overview</Text>
          <View className="flex-row flex-wrap justify-between mb-6">
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">My Students</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">
                {loadingStats ? '...' : (profileStats?.totalStudents ?? 0)}
              </Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Active Batches</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">
                {loadingStats ? '...' : (profileStats?.totalCourses ?? 0)}
              </Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Quizzes Created</Text>
              <Text className="text-emerald-400 text-2xl font-black mt-2">
                {loadingStats ? '...' : (profileStats?.totalTests ?? 0)}
              </Text>
            </View>
            <View className="w-[47%] bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Resources Shared</Text>
              <Text className="text-slate-100 text-2xl font-black mt-2">
                {loadingStats ? '...' : (profileStats?.totalMaterials ?? 0)}
              </Text>
            </View>
          </View>

          {/* Academic Institution Card */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
            <Text className="text-slate-100 text-sm font-bold">Academic Institution Status</Text>
            <View className="flex-row items-center justify-between mt-4">
              <View>
                <Text className="text-slate-300 text-xs font-semibold">The Mathemaniac</Text>
                <Text className="text-slate-500 text-[10px] mt-0.5">{user?.faculty || 'Faculty Member'}</Text>
              </View>
              <View className="bg-blue-600/20 px-3 py-1 rounded-full border border-blue-500/20">
                <Text className="text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                  Active
                </Text>
              </View>
            </View>
          </View>

          

          {/* Action Buttons */}
          <View className="mb-4 gap-y-4">


            {/* Payment Ledger / Register Button for Admin/Superuser only */}
            {(user?.role === 'ADMIN' || (user?.phoneNumber && ['+917980357754', '+919831754957'].includes(user.phoneNumber))) && (
              <Button
                title="Manual Payment Register"
                onPress={() => navigation.navigate('TeacherPayments' as any)}
              />
            )}

            <Button
              title="Change Password"
              onPress={() => navigation.navigate('ChangePassword')}
            />

            {/* Admin Panel Button */}
            {(user?.role === 'ADMIN' || (user?.phoneNumber && ['+917980357754', '+919831754957'].includes(user.phoneNumber))) && (
              <Button
                title="Admin Control Panel"
                onPress={() => navigation.navigate('AdminPanel')}
              />
            )}
          </View>

          {/* Logout */}
          <Button title="Sign Out of Instructor View" onPress={handleLogout} variant="danger" />
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

