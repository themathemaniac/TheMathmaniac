import React, { useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';

type ForgotPasswordResetScreenProp = StackNavigationProp<RootStackParamList, 'ForgotPasswordReset'>;
type ForgotPasswordResetScreenRouteProp = RouteProp<RootStackParamList, 'ForgotPasswordReset'>;

export const ForgotPasswordResetScreen: React.FC = () => {
  const navigation = useNavigation<ForgotPasswordResetScreenProp>();
  const route = useRoute<ForgotPasswordResetScreenRouteProp>();
  const { resetToken } = route.params;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { resetPasswordWithToken, isLoading, error } = useAuthStore();

  const handleSubmit = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Invalid Input', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    const success = await resetPasswordWithToken(resetToken, newPassword);
    if (success) {
      Alert.alert(
        'Password Reset Successful',
        'Your password has been reset successfully. Please log in with your new password.',
        [{ text: 'Log In', onPress: () => navigation.replace('Login') }]
      );
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-950 px-6 pt-16" contentContainerStyle={{ flexGrow: 1 }}>
      <View className="mb-12">
        <Text className="text-slate-100 text-3xl font-black">Set New Password</Text>
        <Text className="text-slate-400 text-sm mt-2 font-medium">
          Create a strong password for your account
        </Text>
      </View>

      {error && (
        <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-6">
          <Text className="text-red-400 text-xs font-semibold">{error}</Text>
        </View>
      )}

      <View className="mb-8">
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
          Confirm Password
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
          title="Save Password"
          onPress={handleSubmit}
          loading={isLoading}
          className="mb-8"
        />
      </View>
    </ScrollView>
  );
};
