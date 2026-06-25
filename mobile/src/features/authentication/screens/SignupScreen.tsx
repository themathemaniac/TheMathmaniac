import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';
import { Eye, EyeOff } from 'lucide-react-native';

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Signup'>;

interface Props {
  navigation: SignupScreenNavigationProp;
}

export const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');

  const { register, isLoading, error } = useAuthStore();

  const handleSignupSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Invalid Input', 'Please enter your full name.');
      return;
    }
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Input', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Invalid Input', 'Password must be at least 6 characters long.');
      return;
    }

    const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
    const success = await register(name.trim(), formattedPhone, password, role);
    if (success) {
      navigation.replace('AppTabs', { screen: 'Home' });
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-950 px-6 pt-16">
      <View className="mb-12">
        <Text className="text-slate-100 text-3xl font-black">Create Account</Text>
        <Text className="text-slate-400 text-sm mt-2 font-medium">
          Register to start exploring your courses
        </Text>
      </View>

      {error && (
        <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-6">
          <Text className="text-red-400 text-xs font-semibold">{error}</Text>
        </View>
      )}

      {/* Role Selector Tabs */}
      <View className="flex-row bg-slate-900 p-1.5 rounded-2xl mb-8 border border-slate-800">
        <TouchableOpacity
          onPress={() => setRole('STUDENT')}
          className={`flex-1 py-3.5 rounded-xl justify-center items-center ${
            role === 'STUDENT' ? 'bg-slate-800' : 'bg-transparent'
          }`}
        >
          <Text className={`font-bold text-sm ${role === 'STUDENT' ? 'text-slate-100' : 'text-slate-400'}`}>
            Student Register
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setRole('TEACHER')}
          className={`flex-1 py-3.5 rounded-xl justify-center items-center ${
            role === 'TEACHER' ? 'bg-slate-800' : 'bg-transparent'
          }`}
        >
          <Text className={`font-bold text-sm ${role === 'TEACHER' ? 'text-slate-100' : 'text-slate-400'}`}>
            Teacher Register
          </Text>
        </TouchableOpacity>
      </View>

      {/* Inputs */}
      <View className="mb-8">
        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
          Full Name
        </Text>
        <TextInput
          className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 text-slate-300 text-base font-semibold mb-6"
          placeholder="Mr. X"
          placeholderTextColor="#8A8070"
          value={name}
          onChangeText={setName}
        />

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
          Set Password
        </Text>
        <View className="flex-row items-center bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 mb-8">
          <TextInput
            className="flex-1 text-slate-300 text-base font-semibold"
            placeholder="•••••••• (Min 6 chars)"
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

        <Button
          title="Sign Up"
          onPress={handleSignupSubmit}
          loading={isLoading}
          className="mb-8"
        />

        <View className="flex-row justify-center items-center py-4">
          <Text className="text-slate-400 text-sm">Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text className="text-blue-400 text-sm font-black underline">Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};
