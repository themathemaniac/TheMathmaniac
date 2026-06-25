import React, { useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';
import { Eye, EyeOff } from 'lucide-react-native';

type ForgotPasswordResetScreenProp = StackNavigationProp<RootStackParamList, 'ForgotPasswordReset'>;
type ForgotPasswordResetScreenRouteProp = RouteProp<RootStackParamList, 'ForgotPasswordReset'>;

export const ForgotPasswordResetScreen: React.FC = () => {
  const navigation = useNavigation<ForgotPasswordResetScreenProp>();
  const route = useRoute<ForgotPasswordResetScreenRouteProp>();
  const { resetToken } = route.params;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        <View className="flex-row items-center bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 mb-6">
          <TextInput
            className="flex-1 text-slate-300 text-base font-semibold"
            placeholder="•••••••• (Min 6 chars)"
            placeholderTextColor="#8A8070"
            secureTextEntry={!showNewPassword}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} className="pl-2 pr-1">
            {showNewPassword ? (
              <EyeOff color="#94A3B8" size={20} />
            ) : (
              <Eye color="#94A3B8" size={20} />
            )}
          </TouchableOpacity>
        </View>

        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
          Confirm Password
        </Text>
        <View className="flex-row items-center bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 mb-8">
          <TextInput
            className="flex-1 text-slate-300 text-base font-semibold"
            placeholder="••••••••"
            placeholderTextColor="#8A8070"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="pl-2 pr-1">
            {showConfirmPassword ? (
              <EyeOff color="#94A3B8" size={20} />
            ) : (
              <Eye color="#94A3B8" size={20} />
            )}
          </TouchableOpacity>
        </View>

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
