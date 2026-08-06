import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, FlatList, RefreshControl, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { apiClient } from '../../../core/api/client';
import { Skeleton } from '../../../shared/components/Skeleton';
import { useAuthStore } from '../../../core/store/auth';
import { initiateUPIIntent } from '../../payments/UPIPaymentFlow';

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
  course?: { title: string } | null;
}

export const FeePaymentScreen: React.FC = () => {
  const navigation = useNavigation<FeePaymentScreenNavigationProp>();
  const { user } = useAuthStore();
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceiptFee, setSelectedReceiptFee] = useState<FeeRecord | null>(null);

  // UPI Payment State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [manualUtr, setManualUtr] = useState<string>('');
  const [isProcessingUpi, setIsProcessingUpi] = useState(false);
  const [showUtrFallback, setShowUtrFallback] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string>('');

  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = -2; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      options.push(mStr);
    }
    return options;
  };

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

  const fetchEnrolledCourses = async () => {
    try {
      const res = await apiClient.get('/courses');
      if (res.data.success) {
        // Assume courses route returns all courses, but we only want ones the user purchased/enrolled in
        // A better approach is fetching a specific /courses/enrolled endpoint if it existed, but we'll use the available data
        // For now, let's let them select from available active courses or if the backend marks them as purchased
        const purchased = res.data.data.filter((c: any) => c.isPurchased || c.price > 0);
        setEnrolledCourses(purchased.length > 0 ? purchased : res.data.data);
      }
    } catch (e) {
      console.log('Failed to fetch courses for payment modal', e);
    }
  };

  useEffect(() => {
    fetchFees();
    fetchEnrolledCourses();
  }, []);

  const handleInitiateUpi = async () => {
    if (!selectedCourseId || !selectedMonth) {
      Alert.alert('Missing Info', 'Please select a course and billing month.');
      return;
    }
    
    // Auto-calculate fine if past 10th
    const now = new Date();
    const [year, month] = selectedMonth.split('-');
    const dueDate = new Date(parseInt(year), parseInt(month) - 1, 10);
    let fine = 0;
    if (now > dueDate) {
      const diffTime = Math.abs(now.getTime() - dueDate.getTime());
      const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
      fine = diffWeeks * 50; 
    }

    const course = enrolledCourses.find(c => c.id === selectedCourseId);
    if (!course) return;

    try {
      setIsProcessingUpi(true);
      const res = await apiClient.post('/payments/initiate-upi', {
        courseId: selectedCourseId,
        month: selectedMonth,
        amount: course.price,
        fine: fine
      });

      if (res.data.success) {
        const { upiString, feePayment } = res.data.data;
        setPendingPaymentId(feePayment.id);
        
        // Launch UPI App
        const result = await initiateUPIIntent(upiString);
        if (result.success) {
          // If successful launch, show the Welcome Back UTR fallback modal to collect UTR
          setShowUtrFallback(true);
        } else {
          Alert.alert('UPI Unavailable', result.message);
          setShowUtrFallback(true); // Let them manually scan QR and type UTR
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to initiate UPI payment');
    } finally {
      setIsProcessingUpi(false);
    }
  };

  const handleSubmitUtr = async () => {
    if (manualUtr.trim().length < 6) {
      Alert.alert('Invalid UTR', 'Please enter a valid Transaction Reference Number.');
      return;
    }
    try {
      setIsProcessingUpi(true);
      const res = await apiClient.post('/payments/submit-utr', {
        paymentId: pendingPaymentId,
        utrNumber: manualUtr
      });
      if (res.data.success) {
        Alert.alert('Success', 'Your payment reference has been submitted for admin verification!');
        setShowUtrFallback(false);
        setIsPayModalOpen(false);
        setManualUtr('');
        fetchFees();
      }
    } catch (e: any) {
      Alert.alert('Submission Failed', e.response?.data?.error || 'Could not submit UTR.');
    } finally {
      setIsProcessingUpi(false);
    }
  };

  const getMonthNameAndYear = (monthStr: string) => {
    const [year, monthNum] = monthStr.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[parseInt(monthNum, 10) - 1] || 'Month'} ${year}`;
  };

  const formatAmount = (amt: number) => `₹${(amt / 100).toLocaleString('en-IN')}`;

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      <View className="flex-row items-center justify-between mb-6">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-full justify-center items-center active:bg-slate-800">
          <Text className="text-slate-100 text-sm font-bold">◀</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-lg font-black">Fee Receipts</Text>
        <TouchableOpacity onPress={() => setIsPayModalOpen(true)} className="px-4 py-2 bg-blue-600 rounded-full active:bg-blue-700">
          <Text className="text-white text-xs font-bold uppercase tracking-wider">Pay Dues</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {loading ? (
          <View className="space-y-4 pt-4">
            <Skeleton height={80} />
            <Skeleton height={80} />
            <Skeleton height={80} />
          </View>
        ) : (
          <FlatList
            data={fees}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFees(); }} tintColor="#2D8C82" />}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListHeaderComponent={
              <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Receipt registry</Text>
                <Text className="text-slate-500 text-[10px] mt-1 leading-relaxed">
                  Below is the list of payments verified and manual fee receipts logged by the administrator. Tap on any record to view its printable receipt.
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View className="bg-slate-900/40 border border-slate-850 rounded-3xl p-8 justify-center items-center mt-2">
                <Text className="text-3xl mb-2">📄</Text>
                <Text className="text-slate-400 text-sm font-bold text-center">No payment receipts found</Text>
                <Text className="text-slate-600 text-xs text-center mt-1">If you have recently cleared your monthly dues, please wait for the administrator to register it.</Text>
              </View>
            }
            renderItem={({ item: fee }) => (
              <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-4">
                <View className="flex-row justify-between items-start">
                  <View>
                    <Text className="text-slate-100 text-base font-black">{fee.course?.title || 'Monthly Tuition Fee'}</Text>
                    <Text className="text-slate-400 text-xs mt-0.5 font-bold">Period: {getMonthNameAndYear(fee.month)}</Text>
                    <Text className="text-slate-500 text-[10px] mt-1 font-semibold">Payment Date: {fee.paidAt ? new Date(fee.paidAt).toLocaleDateString() : 'N/A'}</Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full border ${fee.status === 'SUCCESS' ? 'bg-green-600/20 border-green-500/20' : 'bg-yellow-600/20 border-yellow-500/20'}`}>
                    <Text className={`text-[9px] font-bold uppercase tracking-wider ${fee.status === 'SUCCESS' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {fee.status === 'PENDING_VERIFICATION' ? 'Pending' : fee.status}
                    </Text>
                  </View>
                </View>
                {fee.status === 'SUCCESS' && (
                  <View className="mt-4 pt-3 border-t border-slate-850 flex-row justify-between items-center">
                    <View>
                      <Text className="text-slate-400 text-xs font-black">{formatAmount(fee.totalAmount)}</Text>
                      <Text className="text-slate-500 text-[8px] font-mono mt-0.5">Method: {fee.paymentMode?.replace('_', ' ') || 'CASH'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedReceiptFee(fee)} className="bg-blue-600 px-4 py-2.5 rounded-xl active:opacity-90">
                      <Text className="text-white text-[10.5px] font-black uppercase tracking-wider">View Receipt</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>

      {/* Pay UPI Modal */}
      <Modal visible={isPayModalOpen} transparent animationType="slide" onRequestClose={() => setIsPayModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(2,6,23,0.95)', justifyContent: 'flex-end' }}>
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 h-5/6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-black">Pay Monthly Fees</Text>
              <TouchableOpacity onPress={() => setIsPayModalOpen(false)} className="bg-slate-800 w-8 h-8 rounded-full items-center justify-center">
                <Text className="text-slate-300">✕</Text>
              </TouchableOpacity>
            </View>

            {showUtrFallback ? (
              <View className="space-y-6">
                <View className="bg-blue-900/20 border border-blue-800 rounded-2xl p-4">
                  <Text className="text-blue-400 font-bold mb-2 text-base">Welcome Back!</Text>
                  <Text className="text-slate-300 text-sm">Please enter the 12-digit UTR or Transaction Reference number from your payment app to finalize this record.</Text>
                </View>
                <View>
                  <Text className="text-slate-400 text-xs font-bold mb-2">UTR / Reference Number</Text>
                  <TextInput
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-white font-semibold"
                    placeholder="e.g. 312345678901"
                    placeholderTextColor="#475569"
                    value={manualUtr}
                    onChangeText={setManualUtr}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity 
                  onPress={handleSubmitUtr} 
                  disabled={isProcessingUpi}
                  className={`py-4 rounded-xl items-center ${isProcessingUpi ? 'bg-green-800' : 'bg-green-600'}`}
                >
                  <Text className="text-white font-black">{isProcessingUpi ? 'Submitting...' : 'Submit Payment'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} className="space-y-6">
                <View>
                  <Text className="text-slate-400 text-xs font-bold mb-3">Select Program/Course</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {enrolledCourses.map(c => (
                      <TouchableOpacity 
                        key={c.id} 
                        onPress={() => setSelectedCourseId(c.id)}
                        className={`mr-3 px-5 py-3 rounded-2xl border ${selectedCourseId === c.id ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 border-slate-800'}`}
                      >
                        <Text className={`font-bold ${selectedCourseId === c.id ? 'text-white' : 'text-slate-300'}`}>{c.title}</Text>
                        <Text className={`text-[10px] mt-1 ${selectedCourseId === c.id ? 'text-blue-200' : 'text-slate-500'}`}>Fee: {formatAmount(c.price * 100)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View>
                  <Text className="text-slate-400 text-xs font-bold mb-3">Select Billing Month</Text>
                  <View className="flex-row flex-wrap">
                    {generateMonthOptions().map(mStr => (
                      <TouchableOpacity 
                        key={mStr} 
                        onPress={() => setSelectedMonth(mStr)}
                        className={`mr-3 mb-3 px-4 py-2.5 rounded-full border ${selectedMonth === mStr ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 border-slate-800'}`}
                      >
                        <Text className={`text-xs font-bold ${selectedMonth === mStr ? 'text-white' : 'text-slate-300'}`}>{getMonthNameAndYear(mStr)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="bg-slate-950 border border-slate-850 rounded-2xl p-5 mb-4">
                  <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2">Instructions</Text>
                  <Text className="text-slate-500 text-xs">Tap below to open Google Pay, PhonePe, or Paytm automatically. The exact fee and recipient details will be pre-filled.</Text>
                </View>

                <TouchableOpacity 
                  onPress={handleInitiateUpi} 
                  disabled={!selectedCourseId || !selectedMonth || isProcessingUpi}
                  className={`py-4 rounded-xl items-center flex-row justify-center ${(selectedCourseId && selectedMonth && !isProcessingUpi) ? 'bg-white' : 'bg-slate-700'}`}
                >
                  <Text className={`font-black text-base ${(selectedCourseId && selectedMonth && !isProcessingUpi) ? 'text-black' : 'text-slate-500'}`}>
                    {isProcessingUpi ? 'Processing...' : 'Pay via UPI'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Printable Receipt Modal */}
      <Modal visible={!!selectedReceiptFee} transparent animationType="slide" onRequestClose={() => setSelectedReceiptFee(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.85)', justifyContent: 'center', padding: 20 }}>
          <View className="bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl">
            <View className="items-center pb-4 border-b border-slate-800">
              <Text className="text-slate-100 text-base font-black uppercase tracking-wider text-center">The Mathemaniac Institute</Text>
              <Text className="text-slate-500 text-[10px] font-bold uppercase mt-1">Official Fee Payment Receipt</Text>
            </View>
            {selectedReceiptFee && (
              <View className="mt-4 space-y-4">
                <View className="space-y-2">
                  <View className="flex-row justify-between"><Text className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Student Name</Text><Text className="text-slate-400 text-[10px] font-bold">{user?.name || 'Student'}</Text></View>
                  <View className="flex-row justify-between"><Text className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Billing Period</Text><Text className="text-slate-100 text-xs font-black">{getMonthNameAndYear(selectedReceiptFee.month)}</Text></View>
                  <View className="flex-row justify-between"><Text className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Payment Date</Text><Text className="text-slate-500 text-[10px] font-bold">{selectedReceiptFee.paidAt ? new Date(selectedReceiptFee.paidAt).toLocaleDateString() : 'N/A'}</Text></View>
                </View>
                <View className="pt-4 border-t border-slate-800 space-y-2">
                  <View className="flex-row justify-between"><Text className="text-slate-400 text-[10px] font-bold">Base Tuition Fee</Text><Text className="text-slate-300 text-[10px] font-mono">{formatAmount(selectedReceiptFee.amount)}</Text></View>
                  {selectedReceiptFee.fine > 0 && <View className="flex-row justify-between"><Text className="text-red-400/80 text-[10px] font-bold">Late Fee / Fine</Text><Text className="text-red-400/80 text-[10px] font-mono">{formatAmount(selectedReceiptFee.fine)}</Text></View>}
                  <View className="flex-row justify-between pt-2"><Text className="text-slate-100 text-xs font-black">Total Paid</Text><Text className="text-green-400 text-xs font-black">{formatAmount(selectedReceiptFee.totalAmount)}</Text></View>
                </View>
              </View>
            )}
            <TouchableOpacity onPress={() => setSelectedReceiptFee(null)} className="mt-8 py-3 bg-slate-800 rounded-xl items-center"><Text className="text-slate-300 text-xs font-bold uppercase">Close Receipt</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};
