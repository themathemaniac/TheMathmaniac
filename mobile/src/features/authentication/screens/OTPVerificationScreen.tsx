import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';

type OTPVerificationRouteProp = RouteProp<RootStackParamList, 'OTPVerification'>;
type OTPVerificationNavigationProp = StackNavigationProp<RootStackParamList, 'OTPVerification'>;

interface Props {
  route: OTPVerificationRouteProp;
  navigation: OTPVerificationNavigationProp;
}

export const OTPVerificationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { phoneNumber, role } = route.params;
  const [code, setCode] = useState('');
  const [timer, setTimer] = useState(30);

  const { verifyOtp, sendOtp, isLoading, error } = useAuthStore();

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleVerify = async () => {
    if (code.length < 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit OTP code');
      return;
    }
    const success = await verifyOtp(phoneNumber, code, undefined, role);
    if (success) {
      navigation.replace('AppTabs', { screen: 'Home' });
    }
  };

  const handleResend = async () => {
    if (timer === 0) {
      const success = await sendOtp(phoneNumber);
      if (success) {
        setTimer(30);
        Alert.alert('OTP Resent', 'Verification code has been resent to your mobile number.');
      }
    }
  };

  return (
    <View className="flex-1 bg-slate-950 px-6 pt-20 justify-between pb-16">
      <View>
        <Text className="text-slate-100 text-3xl font-black">Verify OTP</Text>
        <Text className="text-slate-400 text-sm mt-3 font-medium leading-5">
          We sent a 6-digit verification code to
          <Text className="text-slate-100 font-bold"> {phoneNumber}</Text>.
        </Text>

        {error && (
          <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mt-6">
            <Text className="text-red-400 text-xs font-semibold">{error}</Text>
          </View>
        )}

        <View className="mt-8 mb-6">
          <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
            Verification Code (Try 123456)
          </Text>
          <TextInput
            className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-5 text-slate-100 text-center text-2xl font-black tracking-widest"
            placeholder="123456"
            placeholderTextColor="#8A8070"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
        </View>

        <View className="flex-row justify-between items-center px-2">
          <Text className="text-slate-500 text-sm">Didn't receive the code?</Text>
          <TouchableOpacity onPress={handleResend} disabled={timer > 0}>
            <Text
              className={`text-sm font-semibold ${
                timer > 0 ? 'text-slate-600' : 'text-blue-400'
              }`}
            >
              {timer > 0 ? `Resend in ${timer}s` : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Button
        title="Verify and Proceed"
        onPress={handleVerify}
        loading={isLoading}
      />
    </View>
  );
};
