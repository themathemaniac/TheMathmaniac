import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { apiClient } from '../../../core/api/client';
import { Button } from '../../../shared/components/Button';
import { Skeleton } from '../../../shared/components/Skeleton';
import { useAuthStore } from '../../../core/store/auth';

type TeacherPaymentsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TeacherPayments'>;

interface StudentOption {
  id: string;
  name: string;
  phoneNumber?: string;
}

interface CourseOption {
  id: string;
  title: string;
}

export const TeacherPaymentsScreen: React.FC = () => {
  const navigation = useNavigation<TeacherPaymentsScreenNavigationProp>();
  const { user } = useAuthStore();

  // Access Control: Only ADMIN or Superuser phone numbers
  const isSuperuser = user?.phoneNumber && ['+917980357754', '+919831754957'].includes(user.phoneNumber);
  const isAdmin = user?.role === 'ADMIN' || isSuperuser;

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Form states
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${mm}`;
  });
  const [amount, setAmount] = useState('500');
  const [paymentMode, setPaymentMode] = useState<'OFFLINE_CASH' | 'ONLINE_UPI' | 'OFFLINE_CHEQUE'>('OFFLINE_CASH');
  const [isNewAdmission, setIsNewAdmission] = useState(false);
  const [admissionFee, setAdmissionFee] = useState('');
  const [isLateFeeApplied, setIsLateFeeApplied] = useState(false);

  interface PaymentHistoryOption {
    id: string;
    userId: string;
    month: string;
    amount: number;
    totalAmount: number;
    paymentMode: string;
    transactionNote: string;
    paidAt: string;
    createdAt: string;
    user: {
      name: string;
      phoneNumber?: string;
    };
    course?: {
      title: string;
    };
  }

  const [history, setHistory] = useState<PaymentHistoryOption[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  const [groupView, setGroupView] = useState<'month' | 'student'>('month');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [searchHistoryQuery, setSearchHistoryQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const formatMonthName = (monthStr: string) => {
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return monthStr;
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getAvailableYears = () => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    history.forEach(item => {
      if (item.month && item.month.includes('-')) {
        years.add(item.month.split('-')[0]);
      }
    });
    return ['All', ...Array.from(years).sort((a, b) => b.localeCompare(a))];
  };

  const getFilteredHistory = () => {
    return history.filter(item => {
      if (selectedYear !== 'All') {
        const itemYear = item.month ? item.month.split('-')[0] : '';
        if (itemYear !== selectedYear) return false;
      }

      if (searchHistoryQuery.trim() !== '') {
        const query = searchHistoryQuery.toLowerCase().trim();
        if (groupView === 'month') {
          const monthName = formatMonthName(item.month).toLowerCase();
          if (!monthName.includes(query) && !item.month.includes(query)) return false;
        } else {
          const name = (item.user?.name || '').toLowerCase();
          const phone = item.user?.phoneNumber || '';
          if (!name.includes(query) && !phone.includes(query)) return false;
        }
      }

      return true;
    });
  };

  const getMonthlyGroups = () => {
    const groups: Record<string, { total: number; items: PaymentHistoryOption[] }> = {};
    getFilteredHistory().forEach(item => {
      const key = item.month;
      if (!groups[key]) {
        groups[key] = { total: 0, items: [] };
      }
      groups[key].items.push(item);
      groups[key].total += item.totalAmount;
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const getStudentGroups = () => {
    const groups: Record<string, { studentName: string; phoneNumber?: string; total: number; items: PaymentHistoryOption[] }> = {};
    getFilteredHistory().forEach(item => {
      const key = item.userId;
      if (!groups[key]) {
        groups[key] = {
          studentName: item.user?.name || 'Unknown Student',
          phoneNumber: item.user?.phoneNumber,
          total: 0,
          items: []
        };
      }
      groups[key].items.push(item);
      groups[key].total += item.totalAmount;
    });
    return Object.entries(groups).sort((a, b) => a[1].studentName.localeCompare(b[1].studentName));
  };

  const getCalculatedLateFeeDetails = (billingMonth: string) => {
    if (!billingMonth || !/^\d{4}-\d{2}$/.test(billingMonth)) return { weeks: 0, fee: 0 };
    const [year, monthVal] = billingMonth.split('-').map(Number);
    const dueDate = new Date(year, monthVal - 1, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (today <= dueDate) return { weeks: 0, fee: 0 };

    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.ceil(diffDays / 7);
    return { weeks, fee: weeks * 50 };
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await apiClient.get('/payments/admin/history');
      if (res.data.success) {
        setHistory(res.data.data || []);
      }
    } catch (e) {
      console.log('Error pulling history for payments log:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [studentsRes, coursesRes] = await Promise.all([
          apiClient.get('/payments/admin/students'),
          apiClient.get('/courses'),
        ]);

        if (studentsRes.data.success) {
          setStudents(studentsRes.data.data || []);
        }
        if (coursesRes.data.success) {
          setCourses(coursesRes.data.data || []);
        }
        await fetchHistory();
      } catch (e) {
        console.log('Error pulling list for payments log:', e);
        Alert.alert('Error', 'Unable to fetch students or courses lists.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin]);

  const handleSubmit = async () => {
    if (!selectedStudentId) {
      Alert.alert('Validation Error', 'Please select a student.');
      return;
    }
    if (!selectedCourseId) {
      Alert.alert('Validation Error', 'Please select a course/batch.');
      return;
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      Alert.alert('Validation Error', 'Please enter a valid month in YYYY-MM format.');
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount.');
      return;
    }
    if (isNewAdmission && (!admissionFee || isNaN(Number(admissionFee)) || Number(admissionFee) < 0)) {
      Alert.alert('Validation Error', 'Please enter a valid admission fee.');
      return;
    }

    try {
      setSubmitting(true);
      const lateFeeVal = isLateFeeApplied ? getCalculatedLateFeeDetails(month).fee : 0;

      const response = await apiClient.post('/payments/admin/register', {
        studentId: selectedStudentId,
        courseId: selectedCourseId,
        month,
        amount,
        paymentMode,
        isNewAdmission,
        admissionFee: isNewAdmission ? admissionFee : undefined,
        fine: lateFeeVal || undefined,
      });

      if (response.data.success) {
        Alert.alert('Success', 'Fee payment registered successfully!');
        // Reset state
        setSelectedStudentId('');
        setSearchStudentQuery('');
        setIsNewAdmission(false);
        setAdmissionFee('');
        setIsLateFeeApplied(false);
        await fetchHistory();
      }
    } catch (e: any) {
      console.log('Error registering manual payment:', e);
      Alert.alert('Error', e.response?.data?.error || 'Unable to log student payment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <View className="flex-1 bg-slate-950 px-6 justify-center items-center">
        <Text className="text-4xl mb-4">🔒</Text>
        <Text className="text-slate-100 text-lg font-black text-center">Access Denied</Text>
        <Text className="text-slate-500 text-xs text-center mt-2 leading-5">
          The Fee Payment Ledger Registry is restricted to administrators and superusers only.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-6 bg-slate-900 border border-slate-800 px-6 py-3 rounded-2xl"
        >
          <Text className="text-slate-100 text-xs font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchStudentQuery.toLowerCase()) ||
    (s.phoneNumber && s.phoneNumber.includes(searchStudentQuery))
  );

  const selectedStudentName = students.find(s => s.id === selectedStudentId)?.name || '';

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-full justify-center items-center active:bg-slate-800"
        >
          <Text className="text-slate-100 text-sm font-bold">◀</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-lg font-black">Payment Register</Text>
        <View className="w-10" />
      </View>

      {loading ? (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <Skeleton height={50} className="mb-4" />
          <Skeleton height={50} className="mb-4" />
          <Skeleton height={50} className="mb-4" />
        </ScrollView>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Student Selector */}
          <View className="mb-4">
            <Text className="text-slate-400 text-xs font-bold mb-2">Search Student</Text>
            <TextInput
              value={selectedStudentId ? selectedStudentName : searchStudentQuery}
              onChangeText={(text) => {
                setSearchStudentQuery(text);
                if (selectedStudentId) {
                  setSelectedStudentId('');
                }
                setShowStudentDropdown(true);
              }}
              placeholder="Type student name or phone..."
              placeholderTextColor="#475569"
              className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl px-4 py-3 text-sm"
              onFocus={() => setShowStudentDropdown(true)}
            />

            {showStudentDropdown && searchStudentQuery.length > 0 && (
              <View className="bg-slate-900 border border-slate-800 rounded-2xl mt-2 max-h-48 overflow-hidden">
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredStudents.length === 0 ? (
                    <Text className="text-slate-500 text-xs p-4 text-center">No students found</Text>
                  ) : (
                    filteredStudents.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => {
                          setSelectedStudentId(s.id);
                          setSearchStudentQuery('');
                          setShowStudentDropdown(false);
                        }}
                        className="border-b border-slate-850 p-4 active:bg-slate-800"
                      >
                        <Text className="text-slate-200 text-xs font-bold">{s.name}</Text>
                        {s.phoneNumber && (
                          <Text className="text-slate-550 text-[10px] mt-0.5">{s.phoneNumber}</Text>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Batch Selector */}
          <View className="mb-4">
            <Text className="text-slate-400 text-xs font-bold mb-2">Course / Batch</Text>
            <View className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex-row flex-wrap p-2 gap-2">
              {courses.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedCourseId(c.id)}
                  className={`px-3 py-2 rounded-xl border ${selectedCourseId === c.id ? 'bg-blue-600/20 border-blue-500' : 'bg-transparent border-slate-800'}`}
                >
                  <Text className={`text-[10px] font-bold ${selectedCourseId === c.id ? 'text-blue-400' : 'text-slate-400'}`} numberOfLines={1}>
                    {c.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Month Input */}
          <View className="mb-4">
            <Text className="text-slate-400 text-xs font-bold mb-2">Billing Month (YYYY-MM)</Text>
            <TextInput
              value={month}
              onChangeText={setMonth}
              placeholder="e.g. 2026-06"
              placeholderTextColor="#475569"
              className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl px-4 py-3 text-sm font-mono"
            />
          </View>

          {/* New Admission Option */}
          <View className="mb-4">
            <Text className="text-slate-400 text-xs font-bold mb-2">New Admission?</Text>
            <View className="flex-row gap-x-2">
              <TouchableOpacity
                onPress={() => setIsNewAdmission(true)}
                className={`flex-1 py-3 border rounded-xl items-center justify-center ${isNewAdmission ? 'bg-blue-600/25 border-blue-500' : 'bg-slate-900 border-slate-800'}`}
              >
                <Text className={`text-[10.5px] font-bold ${isNewAdmission ? 'text-blue-400' : 'text-slate-400'}`}>
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setIsNewAdmission(false);
                  setAdmissionFee('');
                }}
                className={`flex-1 py-3 border rounded-xl items-center justify-center ${!isNewAdmission ? 'bg-blue-600/25 border-blue-500' : 'bg-slate-900 border-slate-800'}`}
              >
                <Text className={`text-[10.5px] font-bold ${!isNewAdmission ? 'text-blue-400' : 'text-slate-400'}`}>
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Admission Fee Input (Conditional) */}
          {isNewAdmission && (
            <View className="mb-4">
              <Text className="text-slate-400 text-xs font-bold mb-2">Admission Fee (₹)</Text>
              <TextInput
                value={admissionFee}
                onChangeText={setAdmissionFee}
                keyboardType="numeric"
                placeholder="1000"
                placeholderTextColor="#475569"
                className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl px-4 py-3 text-sm font-bold"
              />
            </View>
          )}

          {/* Late Fee Option */}
          <View className="mb-4">
            <Text className="text-slate-400 text-xs font-bold mb-2">Late Fee Payment?</Text>
            <View className="flex-row gap-x-2">
              <TouchableOpacity
                onPress={() => setIsLateFeeApplied(true)}
                className={`flex-1 py-3 border rounded-xl items-center justify-center ${isLateFeeApplied ? 'bg-blue-600/25 border-blue-500' : 'bg-slate-900 border-slate-800'}`}
              >
                <Text className={`text-[10.5px] font-bold ${isLateFeeApplied ? 'text-blue-400' : 'text-slate-400'}`}>
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsLateFeeApplied(false)}
                className={`flex-1 py-3 border rounded-xl items-center justify-center ${!isLateFeeApplied ? 'bg-blue-600/25 border-blue-500' : 'bg-slate-900 border-slate-800'}`}
              >
                <Text className={`text-[10.5px] font-bold ${!isLateFeeApplied ? 'text-blue-400' : 'text-slate-400'}`}>
                  No
                </Text>
              </TouchableOpacity>
            </View>

            {isLateFeeApplied && (() => {
              const details = getCalculatedLateFeeDetails(month);
              if (details.fee > 0) {
                return (
                  <View className="bg-amber-200 border border-amber-500 rounded-xl p-3 mt-2.5">
                    <Text className="text-black text-[10.5px] font-medium leading-relaxed">
                      ⚠️ Automatically calculated: <Text className="font-bold">₹{details.fee}</Text> late fee charge applied ({details.weeks} week{details.weeks > 1 ? 's' : ''} past the 10th).
                    </Text>
                  </View>
                );
              } else {
                return (
                  <View className="bg-slate-900 border border-slate-800 rounded-xl p-3 mt-2.5">
                    <Text className="text-slate-400 text-[10.5px] leading-relaxed">
                      ✅ No late fee applicable (due date is the 10th of {month}).
                    </Text>
                  </View>
                );
              }
            })()}
          </View>

          {/* Amount Input */}
          <View className="mb-4">
            <Text className="text-slate-400 text-xs font-bold mb-2">
              {isNewAdmission ? 'Monthly Tuition Fee (₹)' : 'Amount Paid (₹)'}
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="500"
              placeholderTextColor="#475569"
              className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl px-4 py-3 text-sm font-bold"
            />
          </View>

          {/* Payment Mode */}
          <View className="mb-6">
            <Text className="text-slate-400 text-xs font-bold mb-2">Payment Mode</Text>
            <View className="flex-row gap-x-2">
              {(['OFFLINE_CASH', 'ONLINE_UPI', 'OFFLINE_CHEQUE'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setPaymentMode(mode)}
                  className={`flex-1 py-3 border rounded-xl items-center justify-center ${paymentMode === mode ? 'bg-blue-600/25 border-blue-500' : 'bg-slate-900 border-slate-800'}`}
                >
                  <Text className={`text-[10.5px] font-bold ${paymentMode === mode ? 'text-blue-400' : 'text-slate-400'}`}>
                    {mode.replace('OFFLINE_', '').replace('ONLINE_', '')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Submit */}
          <Button
            title={submitting ? 'Registering...' : 'Register Payment'}
            onPress={handleSubmit}
            disabled={submitting}
          />

          {/* Transaction History Register Section */}
          <View className="mt-8 border-t border-slate-850 pt-6">
            <Text className="text-slate-100 text-base font-black mb-4">Transaction History Register</Text>

            {/* View Selector Tabs */}
            <View className="flex-row bg-slate-900 p-1 rounded-xl mb-4 border border-slate-855">
              <TouchableOpacity
                onPress={() => {
                  setGroupView('month');
                  setExpandedGroups({});
                }}
                className={`flex-1 py-2 rounded-lg items-center justify-center ${groupView === 'month' ? 'bg-blue-600' : 'bg-transparent'}`}
              >
                <Text className={`text-xs font-bold ${groupView === 'month' ? 'text-slate-100' : 'text-slate-400'}`}>
                  Group by Month
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setGroupView('student');
                  setExpandedGroups({});
                }}
                className={`flex-1 py-2 rounded-lg items-center justify-center ${groupView === 'student' ? 'bg-blue-600' : 'bg-transparent'}`}
              >
                <Text className={`text-xs font-bold ${groupView === 'student' ? 'text-slate-100' : 'text-slate-400'}`}>
                  Group by Student
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search and Year Filter Container */}
            <View className="mb-4 gap-y-3">
              <TextInput
                value={searchHistoryQuery}
                onChangeText={setSearchHistoryQuery}
                onFocus={() => {
                  setIsSearchFocused(true);
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 120);
                }}
                onBlur={() => setIsSearchFocused(false)}
                placeholder={groupView === 'month' ? 'Search by month/year (e.g. June, 2026)...' : 'Search by student name or phone...'}
                placeholderTextColor="#475569"
                className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl px-4 py-3 text-xs"
              />

              <View className="flex-row items-center gap-x-2 flex-wrap">
                <Text className="text-slate-500 text-[10px] font-bold uppercase mr-1">Year:</Text>
                {getAvailableYears().map((y) => (
                  <TouchableOpacity
                    key={y}
                    onPress={() => setSelectedYear(y)}
                    className={`px-3 py-1.5 rounded-full border ${selectedYear === y ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-850'}`}
                  >
                    <Text className={`text-[10px] font-bold ${selectedYear === y ? 'text-slate-100' : 'text-slate-400'}`}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {loadingHistory ? (
              <ActivityIndicator color="#3b82f6" size="small" className="my-4" />
            ) : history.length === 0 ? (
              <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 items-center">
                <Text className="text-slate-500 text-xs font-bold">No transactions found</Text>
              </View>
            ) : (
              <View className="gap-y-3">
                {groupView === 'month'
                  ? getMonthlyGroups().map(([monthKey, group]) => {
                    const isExpanded = !!expandedGroups[monthKey];
                    return (
                      <View key={monthKey} className="bg-slate-900/60 border border-slate-850 rounded-2xl overflow-hidden">
                        <TouchableOpacity
                          onPress={() => toggleGroup(monthKey)}
                          className="bg-slate-900 px-4 py-3 flex-row justify-between items-center border-b border-slate-850/50"
                        >
                          <View className="flex-row items-center gap-x-2">
                            <Text className="text-slate-400 text-xs">{isExpanded ? '▼' : '▶'}</Text>
                            <Text className="text-slate-100 text-xs font-bold">
                              {formatMonthName(monthKey)}
                            </Text>
                          </View>
                          <Text className="text-emerald-400 text-xs font-black">
                            ₹{group.total / 100}
                          </Text>
                        </TouchableOpacity>

                        {isExpanded && (
                          <View className="p-3 gap-y-2.5">
                            {group.items.map((item) => (
                              <View key={item.id} className="bg-slate-950/40 p-3 rounded-xl border border-slate-850/40">
                                <View className="flex-row justify-between items-start">
                                  <View className="flex-1 pr-2">
                                    <Text className="text-slate-200 text-xs font-bold">{item.user?.name || 'Unknown Student'}</Text>
                                    {item.user?.phoneNumber && (
                                      <Text className="text-slate-500 text-[10px] mt-0.5">{item.user.phoneNumber}</Text>
                                    )}
                                    <Text className="text-slate-400 text-[10px] mt-1.5 font-semibold">
                                      Batch: {item.course?.title || 'N/A'}
                                    </Text>
                                  </View>
                                  <View className="items-end">
                                    <Text className="text-emerald-400 text-xs font-bold">
                                      ₹{item.totalAmount / 100}
                                    </Text>
                                    <Text className="text-slate-500 text-[9px] font-bold mt-1 uppercase">
                                      {item.paymentMode?.replace('OFFLINE_', '').replace('ONLINE_', '') || 'CASH'}
                                    </Text>
                                  </View>
                                </View>
                                <View className="mt-2.5 pt-2 border-t border-slate-900/40 flex-row justify-between items-center">
                                  <Text className="text-slate-550 text-[9px] italic flex-1 pr-2" numberOfLines={1}>
                                    {item.transactionNote || 'Offline payment recorded by admin'}
                                  </Text>
                                  <Text className="text-slate-500 text-[9px] font-mono">
                                    {item.paidAt ? new Date(item.paidAt).toLocaleDateString() : 'N/A'}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })
                  : getStudentGroups().map(([studentId, group]) => {
                    const isExpanded = !!expandedGroups[studentId];
                    return (
                      <View key={studentId} className="bg-slate-900/60 border border-slate-850 rounded-2xl overflow-hidden">
                        <TouchableOpacity
                          onPress={() => toggleGroup(studentId)}
                          className="bg-slate-900 px-4 py-3 flex-row justify-between items-center border-b border-slate-850/50"
                        >
                          <View className="flex-row items-center gap-x-2">
                            <Text className="text-slate-400 text-xs">{isExpanded ? '▼' : '▶'}</Text>
                            <View>
                              <Text className="text-slate-100 text-xs font-bold">
                                {group.studentName}
                              </Text>
                              {group.phoneNumber && (
                                <Text className="text-slate-500 text-[9px] mt-0.5">{group.phoneNumber}</Text>
                              )}
                            </View>
                          </View>
                          <Text className="text-emerald-400 text-xs font-black">
                            ₹{group.total / 100}
                          </Text>
                        </TouchableOpacity>

                        {isExpanded && (
                          <View className="p-3 gap-y-2.5">
                            {group.items.map((item) => (
                              <View key={item.id} className="bg-slate-950/40 p-3 rounded-xl border border-slate-850/40">
                                <View className="flex-row justify-between items-start">
                                  <View className="flex-1 pr-2">
                                    <Text className="text-slate-200 text-xs font-bold">
                                      Batch: {item.course?.title || 'N/A'}
                                    </Text>
                                    <Text className="text-slate-400 text-[10px] mt-1 font-semibold">
                                      Billing Month: {formatMonthName(item.month)}
                                    </Text>
                                  </View>
                                  <View className="items-end">
                                    <Text className="text-emerald-400 text-xs font-bold">
                                      ₹{item.totalAmount / 100}
                                    </Text>
                                    <Text className="text-slate-550 text-[9px] font-bold mt-1 uppercase">
                                      {item.paymentMode?.replace('OFFLINE_', '').replace('ONLINE_', '') || 'CASH'}
                                    </Text>
                                  </View>
                                </View>
                                <View className="mt-2.5 pt-2 border-t border-slate-900/40 flex-row justify-between items-center">
                                  <Text className="text-slate-550 text-[9px] italic flex-1 pr-2" numberOfLines={1}>
                                    {item.transactionNote || 'Offline payment recorded by admin'}
                                  </Text>
                                  <Text className="text-slate-500 text-[9px] font-mono">
                                    {item.paidAt ? new Date(item.paidAt).toLocaleDateString() : 'N/A'}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
              </View>
            )}
          </View>

          <View style={{ height: isSearchFocused ? 450 : 48 }} />
        </ScrollView>
      )}
    </View>
  );
};
