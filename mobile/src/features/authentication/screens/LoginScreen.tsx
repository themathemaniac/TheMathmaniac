import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';
import { Eye, EyeOff } from 'lucide-react-native';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'STUDENT' | 'TEACHER' | 'ADMIN'>('STUDENT');

  const { login, isLoading, error, logout } = useAuthStore();

  const handleLoginSubmit = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Input', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!password || password.length < 4) {
      Alert.alert('Invalid Input', 'Please enter your password.');
      return;
    }

    // Prefix country code if not present
    const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
    const success = await login(formattedPhone, password);
    if (success) {
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        if (role === 'STUDENT' && currentUser.role !== 'STUDENT') {
          Alert.alert('Access Denied', 'You cannot log into the Student Portal with a Teacher/Admin account.');
          await logout();
          return;
        }
        if (role === 'TEACHER' && currentUser.role !== 'TEACHER') {
          Alert.alert('Access Denied', 'You cannot log into the Teacher Portal with this account.');
          await logout();
          return;
        }
        if (role === 'ADMIN' && currentUser.role !== 'ADMIN') {
          Alert.alert('Access Denied', 'You cannot log into the Admin Portal with this account.');
          await logout();
          return;
        }
        
        // Redirect to Mandatory Change Password if first login
        if (currentUser.firstLogin) {
          navigation.replace('MandatoryChangePassword');
          return;
        }
      }
      navigation.replace('AppTabs', { screen: 'Home' });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-slate-950"
    >
      <ScrollView 
        className="flex-1 px-6 pt-16"
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
      <View className="mb-12">
        <Text className="text-slate-100 text-3xl font-black">Welcome to Mathemaniac</Text>
        <Text className="text-slate-400 text-sm mt-2 font-medium">
          Sign in to your account to continue
        </Text>
      </View>

      {/* Role Selector Tabs */}
      <View className="flex-row bg-slate-900 p-1.5 rounded-2xl mb-8 border border-slate-800 gap-x-1">
        <TouchableOpacity
          onPress={() => setRole('STUDENT')}
          className={`flex-1 py-3 rounded-xl justify-center items-center ${
            role === 'STUDENT' ? 'bg-slate-800' : 'bg-transparent'
          }`}
        >
          <Text className={`font-bold text-xs ${role === 'STUDENT' ? 'text-slate-100' : 'text-slate-400'}`}>
            Student
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setRole('TEACHER')}
          className={`flex-1 py-3 rounded-xl justify-center items-center ${
            role === 'TEACHER' ? 'bg-slate-800' : 'bg-transparent'
          }`}
        >
          <Text className={`font-bold text-xs ${role === 'TEACHER' ? 'text-slate-100' : 'text-slate-400'}`}>
            Teacher
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setRole('ADMIN')}
          className={`flex-1 py-3 rounded-xl justify-center items-center ${
            role === 'ADMIN' ? 'bg-slate-800' : 'bg-transparent'
          }`}
        >
          <Text className={`font-bold text-xs ${role === 'ADMIN' ? 'text-slate-100' : 'text-slate-400'}`}>
            Admin
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-6">
          <Text className="text-red-400 text-xs font-semibold">{error}</Text>
        </View>
      )}

      {/* Inputs */}
      <View className="mb-8">
        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
          Mobile Number
        </Text>
        <View className="flex-row items-center bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 mb-6">
          <Text className="text-slate-300 font-semibold mr-2">+91</Text>
          <TextInput
            className="flex-1 text-slate-300 text-base font-semibold"
            placeholder="9876543210"
            placeholderTextColor="#8A8070"
            keyboardType="number-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            maxLength={10}
          />
        </View>

        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
          Password
        </Text>
        <View className="flex-row items-center bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 mb-3">
          <TextInput
            className="flex-1 text-slate-300 text-base font-semibold"
            placeholder="••••••••"
            placeholderTextColor="#8A8070"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            keyboardType="default"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="pl-2 pr-1">
            {showPassword ? (
              <EyeOff color="#94A3B8" size={20} />
            ) : (
              <Eye color="#94A3B8" size={20} />
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-between items-center mb-8">
          <TouchableOpacity 
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text className="text-blue-400 text-xs font-semibold">Forgot Password?</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => Alert.alert(
              'Account Recovery Assistance',
              'Your recovery passphrase cannot be recovered. Please contact the administration for account recovery assistance.'
            )}
          >
            <Text className="text-blue-400 text-xs font-semibold">Forgot Passphrase?</Text>
          </TouchableOpacity>
        </View>

        <Button
          title="Sign In"
          onPress={handleLoginSubmit}
          loading={isLoading}
          className="mb-8"
        />

        {/* Informational administration text */}
        <View className="items-center py-4">
          <Text className="text-slate-500 text-[10px] font-bold text-center leading-4 px-4">
            Account registration is managed exclusively by administration. If you do not have an account, please contact the admin desk.
          </Text>
        </View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
  );
};
