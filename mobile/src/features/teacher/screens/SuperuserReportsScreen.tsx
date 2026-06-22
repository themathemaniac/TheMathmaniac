import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { apiClient } from '../../../core/api/client';

type SuperuserReportsNavigationProp = StackNavigationProp<RootStackParamList, 'SuperuserReports'>;

interface DailyReport {
  id: string;
  title: string;
  date: string;
  pdfUrl: string;
  createdAt: string;
}

export const SuperuserReportsScreen: React.FC = () => {
  const navigation = useNavigation<SuperuserReportsNavigationProp>();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Default to today's date in YYYY-MM-DD
  const getTodayString = () => {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, -1);
    return localISOTime.split('T')[0];
  };

  const [compileDate, setCompileDate] = useState(getTodayString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());
  const [sortFilter, setSortFilter] = useState<'date' | 'createdAt'>('date');

  const onChangeDate = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDateObj(selectedDate);
      const tzOffset = selectedDate.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(selectedDate.getTime() - tzOffset)).toISOString().slice(0, -1);
      setCompileDate(localISOTime.split('T')[0]);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/superuser/reports');
      if (res.data.success) {
        setReports(res.data.data);
      } else {
        Alert.alert('Error', res.data.error || 'Failed to fetch reports.');
      }
    } catch (e: any) {
      console.log('Error pulling superuser reports:', e);
      Alert.alert(
        'Access Restricted',
        e.response?.data?.error || 'You do not have permission to view this resource.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh date input to today
    setCompileDate(getTodayString());
    try {
      const res = await apiClient.get('/superuser/reports');
      if (res.data.success) {
        setReports(res.data.data);
      }
    } catch (e) {
      console.log('Error refreshing reports:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateReport = async () => {
    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(compileDate)) {
      Alert.alert('Invalid Date Format', 'Please enter a date matching YYYY-MM-DD (e.g. 2026-06-22).');
      return;
    }

    try {
      setGenerating(true);
      const res = await apiClient.post('/superuser/reports/generate', { date: compileDate });
      if (res.data.success) {
        Alert.alert('Success', `Report for ${compileDate} successfully compiled!`);
        // Refresh the list
        const listRes = await apiClient.get('/superuser/reports');
        if (listRes.data.success) {
          setReports(listRes.data.data);
        }
      } else {
        Alert.alert('Generation Failed', res.data.error || 'Failed to compile report.');
      }
    } catch (e: any) {
      console.log('Error generating report:', e);
      Alert.alert('Error', e.response?.data?.error || 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const getAbsoluteUrl = (relativeUrl: string) => {
    const apiBase = apiClient.defaults.baseURL || '';
    const rootUrl = apiBase.replace('/api/v1', '');
    return `${rootUrl}${relativeUrl}`;
  };

  const handleViewReport = (report: DailyReport) => {
    const fullUrl = getAbsoluteUrl(report.pdfUrl);
    navigation.navigate('PDFViewer', {
      fileUrl: fullUrl,
      title: report.title,
    });
  };

  const sortedReports = [...reports].sort((a, b) => {
    if (sortFilter === 'date') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="bg-slate-900 border-b border-slate-800/80 px-6 pt-14 pb-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 bg-slate-800 border border-slate-700/60 rounded-full justify-center items-center"
        >
          <Text className="text-slate-100 text-lg font-bold">←</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-base font-bold flex-1 ml-4 text-center">
          🔑 Superuser Reports
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />}
      >
        <View className="pb-24">
          {/* Dashboard Description */}
          <View className="bg-amber-600/10 border border-amber-500/20 rounded-3xl p-5 mb-6">
            <Text className="text-amber-400 text-xs font-bold uppercase tracking-widest">
              🔒 Superuser Dashboard
            </Text>
            <Text className="text-slate-100 text-base font-extrabold mt-2 leading-6">
              Daily Attendance PDF Records
            </Text>
            <Text className="text-slate-400 text-[11px] mt-1 leading-4">
              All daily geolocation pings, duties, and attendance logs for teachers and admins are processed and preserved here. System cron automatically compiles at 11:55 PM daily.
            </Text>
          </View>

          {/* Force Generate Card */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6">
            <Text className="text-slate-200 text-sm font-bold mb-3">⚡ On-Demand Compilation</Text>
            <Text className="text-slate-500 text-[10px] mb-4 leading-4">
              Manually compile or overwrite an attendance report for any specific date.
            </Text>
            
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 mr-3 justify-center"
              >
                <Text className="text-slate-100 text-xs font-semibold">
                  {compileDate}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={dateObj}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onChangeDate}
                  maximumDate={new Date()}
                />
              )}
              
              <TouchableOpacity
                onPress={handleGenerateReport}
                disabled={generating}
                className="bg-amber-500 border border-amber-600 px-5 py-3 rounded-2xl active:opacity-90 min-w-[120px] items-center justify-center"
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#020617" />
                ) : (
                  <Text className="text-slate-950 text-xs font-extrabold uppercase tracking-wider">Compile</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Reports History List */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-slate-100 text-base font-bold">Historical Archive</Text>
            <View className="flex-row bg-slate-900 rounded-lg p-1 border border-slate-800">
              <TouchableOpacity
                onPress={() => setSortFilter('date')}
                className={`px-3 py-1.5 rounded-md ${sortFilter === 'date' ? 'bg-amber-500/20' : 'bg-transparent'}`}
              >
                <Text className={`text-[10px] font-bold ${sortFilter === 'date' ? 'text-amber-400' : 'text-slate-500'}`}>
                  By Date
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSortFilter('createdAt')}
                className={`px-3 py-1.5 rounded-md ${sortFilter === 'createdAt' ? 'bg-amber-500/20' : 'bg-transparent'}`}
              >
                <Text className={`text-[10px] font-bold ${sortFilter === 'createdAt' ? 'text-amber-400' : 'text-slate-500'}`}>
                  By Created
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {loading && !refreshing ? (
            <View className="py-20 justify-center items-center">
              <ActivityIndicator size="large" color="#F59E0B" />
              <Text className="text-slate-500 text-xs mt-3">Loading historical registry...</Text>
            </View>
          ) : sortedReports.length > 0 ? (
            sortedReports.map((report) => (
              <TouchableOpacity
                key={report.id}
                onPress={() => handleViewReport(report)}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3 flex-row justify-between items-center active:opacity-90"
              >
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center">
                    <View className="border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 rounded-md mr-2">
                      <Text className="text-amber-400 text-[8px] font-black tracking-widest uppercase">
                        PDF Archive
                      </Text>
                    </View>
                    <Text className="text-slate-500 text-[9px] font-semibold">
                      {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text className="text-slate-100 text-sm font-bold mt-2" numberOfLines={1}>
                    {report.title}
                  </Text>
                  <Text className="text-slate-400 text-[10px] mt-1">Date: {report.date}</Text>
                </View>

                {/* PDF icon */}
                <View className="bg-slate-800 w-10 h-10 rounded-full justify-center items-center border border-slate-700/50">
                  <Text className="text-base">📄</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View className="items-center py-20 bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl">
              <Text className="text-4xl">📁</Text>
              <Text className="text-slate-400 font-bold mt-4 text-sm">No report logs registered.</Text>
              <Text className="text-slate-600 text-xs mt-1 text-center px-6">
                Pull down to refresh or type a date above to trigger the first report.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
