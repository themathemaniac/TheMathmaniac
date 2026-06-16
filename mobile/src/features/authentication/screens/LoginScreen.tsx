import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isOtpMode, setIsOtpMode] = useState(true);
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');

  const { sendOtp, loginWithEmail, loginWithGoogle, isLoading, error } = useAuthStore();

  const handlePhoneSubmit = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Input', 'Please enter a valid 10-digit mobile number');
      return;
    }
    // Prefix country code if not present
    const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
    const success = await sendOtp(formattedPhone);
    if (success) {
      navigation.navigate('OTPVerification', { phoneNumber: formattedPhone, role });
    }
  };

  const handleEmailSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Invalid Input', 'Please fill in both email and password');
      return;
    }
    const success = await loginWithEmail(email, password, role);
    if (success) {
      navigation.replace('AppTabs', { screen: 'Home' });
    }
  };

  const handleGoogleSubmit = async () => {
    const success = await loginWithGoogle(
      'rohan.google@outlook.com',
      'Rohan Google',
      'google_1234567890'
    );
    if (success) {
      navigation.replace('AppTabs', { screen: 'Home' });
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-950 px-6 pt-16">
      <View className="mb-12">
        <Text className="text-slate-100 text-3xl font-black">Welcome back</Text>
        <Text className="text-slate-400 text-sm mt-2 font-medium">
          Sign in to continue your IIT-JEE/NEET preparation
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
            🎓 Student Portal
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
            👨‍🏫 Teacher Portal
          </Text>
        </TouchableOpacity>
      </View>

      {isOtpMode ? (
        // OTP Mode Input
        <View className="mb-8">
          <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
            Mobile Number
          </Text>
          <View className="flex-row items-center bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4">
            <Text className="text-slate-300 font-semibold mr-2">+91</Text>
            <TextInput
              className="flex-1 text-slate-100 text-base font-semibold"
              placeholder="9831754957"
              placeholderTextColor="#8A8070"
              keyboardType="number-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              maxLength={10}
            />
          </View>

          <Button
            title="Send OTP"
            onPress={handlePhoneSubmit}
            loading={isLoading}
            className="mt-8"
          />
        </View>
      ) : (
        // Email Mode Inputs
        <View className="mb-8">
          <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
            Email Address
          </Text>
          <TextInput
            className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 text-slate-100 text-base font-semibold mb-6"
            placeholder="rohan@outlook.com"
            placeholderTextColor="#8A8070"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
            Password
          </Text>
          <TextInput
            className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 text-slate-100 text-base font-semibold"
            placeholder="••••••••"
            placeholderTextColor="#8A8070"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Button
            title="Log In"
            onPress={handleEmailSubmit}
            loading={isLoading}
            className="mt-8"
          />
        </View>
      )}

      {/* Switch Modes */}
      <TouchableOpacity
        onPress={() => setIsOtpMode(!isOtpMode)}
        className="items-center mt-4 mb-8"
      >
        <Text className="text-blue-400 text-sm font-semibold">
          {isOtpMode ? 'Use Email / Password instead' : 'Use Mobile OTP login instead'}
        </Text>
      </TouchableOpacity>

      {/* Divider */}
      <View className="flex-row items-center mt-4 mb-8">
        <View className="flex-1 h-[1px] bg-slate-800" />
        <Text className="text-slate-500 text-xs font-bold uppercase mx-4">or</Text>
        <View className="flex-1 h-[1px] bg-slate-800" />
      </View>

      {/* Google Login */}
      <TouchableOpacity
        onPress={handleGoogleSubmit}
        className="flex-row justify-center items-center bg-slate-800 border border-slate-700/50 py-4 rounded-2xl active:opacity-80 mt-6 mb-12"
      >
        <Text className="text-slate-100 text-base font-semibold">Sign in with Google</Text>
      </TouchableOpacity>

      {/* Sign Up Redirect */}
      <View className="flex-row justify-center mb-16">
        <Text className="text-slate-400 text-sm">Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text className="text-blue-600 text-sm font-semibold">Sign Up</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
