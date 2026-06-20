import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Alert, ScrollView, BackHandler } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';

type MandatoryChangePasswordScreenProp = StackNavigationProp<RootStackParamList, 'MandatoryChangePassword'>;

export const MandatoryChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation<MandatoryChangePasswordScreenProp>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { changePassword, isLoading, error } = useAuthStore();

  // Block hardware back button on Android
  useEffect(() => {
    const onBackPress = () => {
      Alert.alert(
        'Required Action',
        'You must change your password before you can proceed to the application.'
      );
      return true; // Prevent default action
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  // Block swipe-back gesture on iOS
  useEffect(() => {
    navigation.getParent()?.setOptions({
      gestureEnabled: false,
    });
    navigation.setOptions({
      gestureEnabled: false,
    });
  }, [navigation]);

  const handleSubmit = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Invalid Input', 'Your new password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    const success = await changePassword(newPassword);
    if (success) {
      Alert.alert(
        'Password Updated',
        'Your password has been successfully updated. Welcome to the LMS!',
        [{ text: 'Get Started', onPress: () => navigation.replace('AppTabs', { screen: 'Home' }) }]
      );
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-950 px-6 pt-20" contentContainerStyle={{ flexGrow: 1 }}>
      <View className="mb-10 items-center">
        <Text className="text-5xl mb-4">🔒</Text>
        <Text className="text-slate-100 text-2xl font-black text-center">First Login Security Reset</Text>
        <Text className="text-slate-400 text-xs mt-2 font-medium text-center leading-5 px-4">
          Your account was created by the administration. For security reasons, you must set a new password before you can access the LMS.
        </Text>
      </View>

      {error && (
        <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-6">
          <Text className="text-red-400 text-xs font-semibold text-center">{error}</Text>
        </View>
      )}

      <View className="mb-8 flex-1 justify-start">
        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
          New Password
        </Text>
        <TextInput
          className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 text-slate-100 text-base font-semibold mb-6"
          placeholder="•••••••• (Min 6 chars)"
          placeholderTextColor="#8A8070"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
          Confirm New Password
        </Text>
        <TextInput
          className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 text-slate-100 text-base font-semibold mb-8"
          placeholder="••••••••"
          placeholderTextColor="#8A8070"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <Button
          title="Save Password & Enter LMS"
          onPress={handleSubmit}
          loading={isLoading}
          className="mb-8"
        />
      </View>
    </ScrollView>
  );
};
