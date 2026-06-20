import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../core/store/auth';
import { Button } from '../../../shared/components/Button';

type ForgotPasswordScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [passphrase, setPassphrase] = useState('');

  const { verifyRecoveryPassphrase, isLoading, error } = useAuthStore();

  const handleVerifySubmit = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Input', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!passphrase.trim()) {
      Alert.alert('Invalid Input', 'Please enter your recovery passphrase.');
      return;
    }

    const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
    const resetToken = await verifyRecoveryPassphrase(formattedPhone, passphrase.trim());
    if (resetToken) {
      navigation.navigate('ForgotPasswordReset', { resetToken });
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-950 px-6 pt-16" contentContainerStyle={{ flexGrow: 1 }}>
      <View className="mb-12">
        <Text className="text-slate-100 text-3xl font-black">Account Recovery</Text>
        <Text className="text-slate-400 text-sm mt-2 font-medium">
          Verify your recovery passphrase to set a new password
        </Text>
      </View>

      {error && (
        <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-6">
          <Text className="text-red-400 text-xs font-semibold">{error}</Text>
        </View>
      )}

      <View className="mb-8">
        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
          Mobile Number
        </Text>
        <View className="flex-row items-center bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 mb-6">
          <Text className="text-slate-300 font-semibold mr-2">+91</Text>
          <TextInput
            className="flex-1 text-slate-100 text-base font-semibold"
            placeholder="7980357754"
            placeholderTextColor="#8A8070"
            keyboardType="number-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            maxLength={10}
          />
        </View>

        <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
          Recovery Passphrase
        </Text>
        <TextInput
          className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4 text-slate-100 text-base font-semibold mb-8"
          placeholder="e.g. SUNSET-RIVER-4821"
          placeholderTextColor="#8A8070"
          value={passphrase}
          onChangeText={setPassphrase}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <Button
          title="Verify Passphrase"
          onPress={handleVerifySubmit}
          loading={isLoading}
          className="mb-8"
        />

        <TouchableOpacity onPress={() => navigation.navigate('Login')} className="py-4 items-center">
          <Text className="text-blue-400 text-sm font-semibold">Back to Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
