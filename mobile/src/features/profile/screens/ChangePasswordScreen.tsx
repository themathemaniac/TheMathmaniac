import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Eye, EyeOff } from 'lucide-react-native';

type ChangePasswordNavigationProp = StackNavigationProp<RootStackParamList, 'ChangePassword'>;

export const ChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation<ChangePasswordNavigationProp>();
  const { changePassword } = useAuthStore();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const success = await changePassword(newPassword);
    setIsSubmitting(false);

    if (success) {
      Alert.alert('Success', 'Your password has been changed successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } else {
      Alert.alert('Error', useAuthStore.getState().error || 'Failed to change password. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#FAFBF8] px-6 pt-16"
    >
      <View className="mb-8">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mb-6">
          <Text className="text-xl font-bold" style={{ color: '#090d16' }}>←</Text>
        </TouchableOpacity>

        <Text className="text-3xl font-black mb-2" style={{ color: '#090d16' }}>Change Password</Text>
        <Text className="font-semibold" style={{ color: '#334155' }}>Create a new, secure password for your account.</Text>
      </View>

      <View className="mb-4">
        <Text className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#090d16' }}>New Password</Text>
        <View className="flex-row items-center bg-white border border-slate-350 rounded-2xl px-5 shadow-sm shadow-slate-100">
          <TextInput
            className="flex-1 py-4 text-sm font-semibold"
            style={{ color: '#090d16' }}
            placeholder="Enter new password"
            placeholderTextColor="#6B7280"
            secureTextEntry={!showNewPassword}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} className="pl-2 pr-1">
            {showNewPassword ? (
              <EyeOff color="#475569" size={20} />
            ) : (
              <Eye color="#475569" size={20} />
            )}
          </TouchableOpacity>
        </View>
      </View>
 
      <View className="mb-8">
        <Text className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#090d16' }}>Confirm Password</Text>
        <View className="flex-row items-center bg-white border border-slate-350 rounded-2xl px-5 shadow-sm shadow-slate-100">
          <TextInput
            className="flex-1 py-4 text-sm font-semibold"
            style={{ color: '#090d16' }}
            placeholder="Re-enter new password"
            placeholderTextColor="#6B7280"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="pl-2 pr-1">
            {showConfirmPassword ? (
              <EyeOff color="#475569" size={20} />
            ) : (
              <Eye color="#475569" size={20} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isSubmitting}
        className={`bg-[#2D8C82] py-4 rounded-2xl items-center shadow-lg shadow-teal-500/20 ${isSubmitting ? 'opacity-70' : ''}`}
      >
        {isSubmitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-sm font-bold tracking-wide">Update Password</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};
