import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { apiClient } from '../../../core/api/client';
import { Button } from '../../../shared/components/Button';
import { Skeleton } from '../../../shared/components/Skeleton';
import { useAuthStore } from '../../../core/store/auth';

type FeePaymentScreenNavigationProp = StackNavigationProp<RootStackParamList, 'FeePayment'>;

interface FeeRecord {
  id: string;
  month: string;
  amount: number;
  fine: number;
  totalAmount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PENDING_VERIFICATION';
  paidAt: string | null;
  paymentMode: string | null;
  transactionNote: string | null;
  course?: {
    title: string;
  } | null;
}

export const FeePaymentScreen: React.FC = () => {
  const navigation = useNavigation<FeePaymentScreenNavigationProp>();
  const { user } = useAuthStore();
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceiptFee, setSelectedReceiptFee] = useState<FeeRecord | null>(null);

  const fetchFees = async () => {
    try {
      const response = await apiClient.get('/payments/history');
      if (response.data.success) {
        setFees(response.data.data);
      }
    } catch (e: any) {
      console.log('Error fetching student fees:', e);
      Alert.alert('Error', 'Unable to retrieve fee payment history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFees();
  };

  const getMonthNameAndYear = (monthStr: string) => {
    const [year, monthNum] = monthStr.split('-');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const name = monthNames[parseInt(monthNum, 10) - 1] || 'Month';
    return `${name} ${year}`;
  };

  const formatAmount = (amt: number) => {
    return `₹${(amt / 100).toLocaleString('en-IN')}`;
  };

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      {/* Custom Header */}
      <View className="flex-row items-center justify-between mb-6">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-full justify-center items-center active:bg-slate-800"
        >
          <Text className="text-slate-100 text-sm font-bold">◀</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-lg font-black">Fee Receipts</Text>
        <View className="w-10" />
      </View>

      {loading ? (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <Skeleton height={80} className="mb-4" />
          <Skeleton height={80} className="mb-4" />
          <Skeleton height={80} className="mb-4" />
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2D8C82"
              colors={['#2D8C82']}
            />
          }
        >
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Receipt registry</Text>
            <Text className="text-slate-500 text-[10px] mt-1 leading-relaxed">
              Below is the list of payments verified and manual fee receipts logged by the administrator. Tap on any record to view its printable receipt.
            </Text>
          </View>

          {fees.length === 0 ? (
            <View className="bg-slate-900/40 border border-slate-850 rounded-3xl p-8 justify-center items-center mt-6">
              <Text className="text-3xl mb-2">📄</Text>
              <Text className="text-slate-400 text-sm font-bold text-center">No payment receipts found</Text>
              <Text className="text-slate-600 text-xs text-center mt-1">If you have recently cleared your monthly dues, please wait for the administrator to register it.</Text>
            </View>
          ) : (
            fees.map((fee) => (
              <View
                key={fee.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-4"
              >
                <View className="flex-row justify-between items-start">
                  <View>
                    <Text className="text-slate-100 text-base font-black">
                      {fee.course?.title || 'Monthly Tuition Fee'}
                    </Text>
                    <Text className="text-slate-400 text-xs mt-0.5 font-bold">
                      Period: {getMonthNameAndYear(fee.month)}
                    </Text>
                    <Text className="text-slate-500 text-[10px] mt-1 font-semibold">
                      Payment Date: {fee.paidAt ? new Date(fee.paidAt).toLocaleDateString() : 'N/A'}
                    </Text>
                  </View>
                  <View className="bg-green-600/20 px-3 py-1 rounded-full border border-green-500/20">
                    <Text className="text-green-400 text-[9px] font-bold uppercase tracking-wider">
                      Paid
                    </Text>
                  </View>
                </View>

                <View className="mt-4 pt-3 border-t border-slate-850 flex-row justify-between items-center">
                  <View>
                    <Text className="text-slate-400 text-xs font-black">
                      {formatAmount(fee.totalAmount)}
                    </Text>
                    <Text className="text-slate-500 text-[8px] font-mono mt-0.5">
                      Method: {fee.paymentMode?.replace('_', ' ') || 'CASH'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedReceiptFee(fee)}
                    className="bg-blue-600 px-4 py-2.5 rounded-xl active:opacity-90"
                  >
                    <Text className="text-white text-[10.5px] font-black uppercase tracking-wider">View Receipt</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Printable Receipt Modal */}
      <Modal
        visible={!!selectedReceiptFee}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedReceiptFee(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.85)', justifyContent: 'center', padding: 20 }}>
          <View className="bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl">
            {/* Header */}
            <View className="items-center pb-4 border-b border-slate-800">
              <Text className="text-slate-100 text-base font-black uppercase tracking-wider text-center">The Mathemaniac Institute</Text>
              <Text className="text-slate-500 text-[10px] font-bold uppercase mt-1">Official Fee Payment Receipt</Text>
            </View>

            {/* Receipt Details */}
            {selectedReceiptFee && (
              <View className="mt-4 space-y-4">
                <View className="space-y-2">
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Student Name</Text>
                    <Text className="text-slate-400 text-[10px] font-bold">{user?.name || 'Student'}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Billing Period</Text>
                    <Text className="text-slate-100 text-xs font-black">{getMonthNameAndYear(selectedReceiptFee.month)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Payment Date</Text>
                    <Text className="text-slate-500 text-[10px] font-bold">
                      {selectedReceiptFee.paidAt ? new Date(selectedReceiptFee.paidAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* Amount breakdown block */}
                <View className="bg-slate-950/60 rounded-2xl p-4 space-y-2 border border-slate-800">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-500 text-xs font-semibold">Tuition Fee</Text>
                    <Text className="text-slate-400 text-xs font-bold">{formatAmount(selectedReceiptFee.amount)}</Text>
                  </View>
                  <View className="border-t border-slate-800 pt-2.5 mt-1 flex-row justify-between items-center">
                    <Text className="text-slate-400 text-xs font-black">Net Total Paid</Text>
                    <Text className="text-primary text-base font-black">{formatAmount(selectedReceiptFee.totalAmount)}</Text>
                  </View>
                </View>

                {/* Reference details */}
                <View className="space-y-1.5 pt-2 border-t border-slate-800">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Payment Method</Text>
                    <Text className="text-slate-400 text-[9px] font-semibold">{selectedReceiptFee.paymentMode?.replace('_', ' ') || 'CASH'}</Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Admin Remarks</Text>
                    <Text className="text-slate-400 text-[8.5px] font-mono" numberOfLines={1}>{selectedReceiptFee.transactionNote || 'N/A'}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Footer Notice */}
            <View className="mt-6 pt-4 border-t border-slate-800 items-center">
              <Text className="text-slate-600 text-[8px] text-center font-semibold uppercase tracking-wider">
                This is a secure system-generated receipt.
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setSelectedReceiptFee(null)}
              className="mt-5 bg-primary rounded-2xl py-3 items-center active:opacity-90"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">Close Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};
