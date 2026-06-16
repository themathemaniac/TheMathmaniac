import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Signup'>;

interface Props {
  navigation: SignupScreenNavigationProp;
}

export const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');

  const { signupWithEmail, isLoading, error } = useAuthStore();

  const handleRegister = async () => {
    if (!name || !email || !phoneNumber || !password) {
      Alert.alert('Missing Fields', 'Please fill in all inputs to register');
      return;
    }
    const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
    const success = await signupWithEmail(name, email, formattedPhone, password, role);
    if (success) {
      navigation.replace('AppTabs', { screen: 'Home' });
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-950 px-6 pt-16">
      <View className="mb-10">
        <Text className="text-slate-100 text-3xl font-black">Create account</Text>
        <Text className="text-slate-400 text-sm mt-2 font-medium">
          Start your learning super-app experience today
        </Text>
      </View>

      {error && (
        <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-6">
          <Text className="text-red-400 text-xs font-semibold">{error}</Text>
        </View>
      )}

      {/* Role Selector */}
      <View className="flex-row bg-slate-900 border border-slate-800 rounded-2xl p-1 mb-6">
        <TouchableOpacity
          onPress={() => setRole('STUDENT')}
          className={`flex-1 py-3 rounded-xl items-center ${
            role === 'STUDENT' ? 'bg-blue-600' : 'bg-transparent'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              role === 'STUDENT' ? 'text-white' : 'text-slate-400'
            }`}
          >
            🎓 Student Signup
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setRole('TEACHER')}
          className={`flex-1 py-3 rounded-xl items-center ${
            role === 'TEACHER' ? 'bg-blue-600' : 'bg-transparent'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              role === 'TEACHER' ? 'text-white' : 'text-slate-400'
            }`}
          >
            👨‍🏫 Teacher Signup
          </Text>
        </TouchableOpacity>
      </View>

      <View className="mb-6">
        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Full Name</Text>
        <TextInput
          className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 text-slate-100 text-base font-semibold"
          placeholder="Rohan Dey"
          placeholderTextColor="#8A8070"
          value={name}
          onChangeText={setName}
        />
      </View>

      <View className="mb-6">
        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Email Address</Text>
        <TextInput
          className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 text-slate-100 text-base font-semibold"
          placeholder="rohan@outlook.com"
          placeholderTextColor="#8A8070"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      <View className="mb-6">
        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Mobile Number</Text>
        <TextInput
          className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 text-slate-100 text-base font-semibold"
          placeholder="9831754957"
          placeholderTextColor="#8A8070"
          keyboardType="number-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          maxLength={10}
        />
      </View>

      <View className="mb-8">
        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Password</Text>
        <TextInput
          className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 text-slate-100 text-base font-semibold"
          placeholder="••••••••"
          placeholderTextColor="#8A8070"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      <Button
        title="Create Account"
        onPress={handleRegister}
        loading={isLoading}
        className="mt-4 mb-8"
      />

      <View className="flex-row justify-center mb-16">
        <Text className="text-slate-400 text-sm">Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text className="text-blue-400 text-sm font-semibold">Log In</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
