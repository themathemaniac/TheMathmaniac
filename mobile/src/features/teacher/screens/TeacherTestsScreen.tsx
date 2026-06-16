import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { apiClient } from '../../../core/api/client';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type TeacherTestsNavigationProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

export const TeacherTestsScreen: React.FC = () => {
  const navigation = useNavigation<TeacherTestsNavigationProp>();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Upload progress states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);

  // Submissions Modal states
  const [submissionsModalVisible, setSubmissionsModalVisible] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedTestTitle, setSelectedTestTitle] = useState('');
  const [selectedTestTotalMarks, setSelectedTestTotalMarks] = useState(0);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/tests');
      setTests(res.data.data);
    } catch (e) {
      console.log('Error pulling teacher tests:', e);
      Alert.alert('Load Error', 'Failed to retrieve quizzes and test papers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTests();
    setRefreshing(false);
  };

  const handlePickAndUploadPDF = async (testId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Validation: Only PDF
        if (file.mimeType && file.mimeType !== 'application/pdf') {
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (ext !== 'pdf') {
            Alert.alert('Invalid File', 'Only PDF documents are allowed.');
            return;
          }
        }

        // Limit size to 10MB
        if (file.size && file.size > 10 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Maximum file size allowed is 10MB.');
          return;
        }

        // Upload
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: 'application/pdf',
        } as any);

        setUploading(true);
        setUploadProgress(0);
        setActiveTestId(testId);

        await apiClient.post(`/tests/${testId}/upload-pdf`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(percent);
            }
          },
        });

        Alert.alert('Success', 'PDF Question Paper uploaded successfully!');
        fetchTests();
      }
    } catch (err) {
      console.log('Error picking or uploading file:', err);
      Alert.alert('Error', 'An error occurred during file upload.');
    } finally {
      setUploading(false);
      setActiveTestId(null);
    }
  };

  const handleDeletePDF = (testId: string, testTitle: string) => {
    Alert.alert('Confirm Delete', `Are you sure you want to permanently delete the attached question paper for "${testTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await apiClient.delete(`/tests/${testId}/pdf`);
            Alert.alert('Deleted', 'PDF question paper has been removed.');
            fetchTests();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete PDF question paper.');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleViewSubmissions = async (testId: string, testTitle: string, totalMarks: number) => {
    try {
      setSelectedTestTitle(testTitle);
      setSelectedTestTotalMarks(totalMarks);
      setLoadingSubmissions(true);
      setSubmissionsModalVisible(true);
      setSubmissions([]);

      const res = await apiClient.get(`/tests/${testId}/leaderboard`);
      setSubmissions(res.data.data);
    } catch (e) {
      console.log('Error getting submissions:', e);
      Alert.alert('Error', 'Failed to load student submissions.');
      setSubmissionsModalVisible(false);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb > 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${Math.round(kb)} KB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Jun 16, 2026';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Jun 16, 2026';
    }
  };

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      <View className="mb-6">
        <Text className="text-slate-100 text-2xl font-black">Test Papers & Evaluations</Text>
        <Text className="text-slate-400 text-sm mt-1 font-medium">
          Manage question papers and evaluate student submissions
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#8A2222" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A2222" />}
        >
          <View className="pb-24">
            {tests.length > 0 ? (
              tests.map((test) => (
                <View
                  key={test.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-4"
                >
                  {/* Test Info */}
                  <View className="flex-row items-center flex-wrap">
                    <Text className="text-slate-500 text-[8px] font-black tracking-widest uppercase border border-slate-800 bg-slate-950 px-2 py-0.5 rounded-md mr-2 my-0.5">
                      {test.course?.title ? test.course.title.split(' - ')[0] : 'Open Practice'}
                    </Text>
                    <Text className="text-slate-400 text-[10px]">
                      ⌛ {test.duration} Mins | 📝 {test.totalMarks} Marks
                    </Text>
                  </View>
                  <Text className="text-slate-200 text-base font-bold mt-2">
                    {test.title}
                  </Text>

                  {/* PDF Status Section */}
                  <View className="mt-4 bg-slate-950/40 border border-slate-800/40 rounded-2xl p-4">
                    <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Question Paper PDF</Text>
                    {test.pdfUrl ? (
                      <View>
                        <View className="flex-row items-center justify-between mb-3">
                          <View className="flex-1 mr-3">
                            <Text className="text-slate-100 text-xs font-bold" numberOfLines={1}>
                              📄 {test.pdfName || 'question_paper.pdf'}
                            </Text>
                            <Text className="text-slate-500 text-[10px] mt-1">
                              Size: {test.pdfSize ? formatSize(test.pdfSize) : 'Unknown'} | Uploaded: {formatDate()}
                            </Text>
                          </View>
                          
                          {/* File Actions */}
                          <View className="flex-row items-center space-x-2">
                            <TouchableOpacity
                              onPress={() => navigation.navigate('PDFViewer', { title: test.pdfName || test.title, fileUrl: test.pdfUrl })}
                              className="bg-slate-800 w-8 h-8 rounded-full justify-center items-center border border-slate-700/50"
                            >
                              <Text className="text-xs">👁️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handlePickAndUploadPDF(test.id)}
                              className="bg-slate-800 w-8 h-8 rounded-full justify-center items-center border border-slate-700/50"
                            >
                              <Text className="text-xs">✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeletePDF(test.id, test.title)}
                              className="bg-slate-800 w-8 h-8 rounded-full justify-center items-center border border-slate-700/50"
                            >
                              <Text className="text-xs">🗑️</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View className="flex-row items-center justify-between">
                        <Text className="text-slate-500 text-xs flex-1 mr-4">
                          No PDF question paper attached yet.
                        </Text>
                        <TouchableOpacity
                          onPress={() => handlePickAndUploadPDF(test.id)}
                          className="bg-slate-800 border border-slate-700/50 px-3.5 py-2 rounded-xl"
                        >
                          <Text className="text-slate-100 text-xs font-bold">+ Upload PDF</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Progress indicator for this specific test */}
                    {uploading && activeTestId === test.id && (
                      <View className="mt-3">
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-blue-400 text-[10px] font-bold">Uploading Question Paper...</Text>
                          <Text className="text-blue-400 text-[10px] font-mono font-bold">{uploadProgress}%</Text>
                        </View>
                        <View className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <View style={{ width: `${uploadProgress}%` }} className="bg-blue-600 h-full rounded-full" />
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Actions Grid */}
                  <View className="mt-4 pt-4 border-t border-slate-800/80 flex-row justify-between items-center">
                    <TouchableOpacity
                      onPress={() => handleViewSubmissions(test.id, test.title, test.totalMarks)}
                      className="bg-blue-600/90 px-4 py-2.5 rounded-xl flex-row items-center"
                    >
                      <Text className="text-white text-xs font-bold">📊 View Submissions</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View className="items-center py-20">
                <Text className="text-4xl">📝</Text>
                <Text className="text-slate-400 font-bold mt-4">No tests configured.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Submissions Modal */}
      <Modal visible={submissionsModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-slate-950/80">
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 min-h-[500px] max-h-[85%]">
            <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-800">
              <View className="flex-1 mr-4">
                <Text className="text-slate-100 text-base font-black" numberOfLines={1}>
                  Submissions
                </Text>
                <Text className="text-slate-400 text-[10px] font-medium mt-0.5" numberOfLines={1}>
                  {selectedTestTitle}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSubmissionsModalVisible(false)}
                className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/50"
              >
                <Text className="text-slate-100 text-xs font-bold">Close</Text>
              </TouchableOpacity>
            </View>

            {loadingSubmissions ? (
              <View className="flex-1 justify-center items-center py-20">
                <ActivityIndicator size="large" color="#8A2222" />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="pb-10">
                  {submissions.length > 0 ? (
                    submissions.map((sub, idx) => (
                      <View
                        key={idx}
                        className="bg-slate-950/30 border border-slate-800/60 rounded-2xl p-4 mb-3 flex-row justify-between items-center"
                      >
                        <View className="flex-1 mr-3">
                          <Text className="text-slate-200 text-sm font-bold">{sub.name}</Text>
                          <Text className="text-slate-500 text-[10px] mt-1">
                            Submitted: {formatDate(sub.createdAt)}
                          </Text>
                        </View>

                        <View className="items-end">
                          <Text className="text-slate-100 text-sm font-black">
                            {sub.score}/{selectedTestTotalMarks}
                          </Text>
                          <Text className="text-emerald-400 text-[10px] font-bold mt-1">
                            {Math.round(sub.accuracy)}% Accuracy
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View className="items-center py-20">
                      <Text className="text-3xl">👥</Text>
                      <Text className="text-slate-500 text-xs font-bold mt-3">No submissions yet.</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

