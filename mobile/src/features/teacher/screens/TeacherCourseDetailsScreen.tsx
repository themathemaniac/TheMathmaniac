import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { apiClient } from '../../../core/api/client';
import * as DocumentPicker from 'expo-document-picker';

type TeacherCourseDetailsRouteProp = RouteProp<RootStackParamList, 'TeacherCourseDetails'>;
type TeacherCourseDetailsNavigationProp = StackNavigationProp<RootStackParamList, 'TeacherCourseDetails'>;

interface Props {
  route: TeacherCourseDetailsRouteProp;
}

export const TeacherCourseDetailsScreen: React.FC<Props> = ({ route }) => {
  const { courseId, courseTitle } = route.params;
  const navigation = useNavigation<TeacherCourseDetailsNavigationProp>();
  
  const [activeTab, setActiveTab] = useState<'MATERIALS' | 'SYLLABUS' | 'STUDENTS' | 'NOTICES'>('MATERIALS');
  const [loading, setLoading] = useState(true);
  
  const [course, setCourse] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Material Upload State
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialType, setMaterialType] = useState('NOTES');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; size: number } | null>(null);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  // Announcement State
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [postingNotice, setPostingNotice] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [courseRes, studentsRes, announcementsRes, materialsRes] = await Promise.all([
        apiClient.get(`/courses/${courseId}`),
        apiClient.get(`/courses/${courseId}/students`),
        apiClient.get(`/courses/${courseId}/announcements`),
        apiClient.get(`/materials?courseId=${courseId}`)
      ]);
      setCourse(courseRes.data.data);
      setStudents(studentsRes.data.data);
      setAnnouncements(announcementsRes.data.data);
      setMaterials(materialsRes.data.data);
    } catch (e) {
      console.log('Error fetching course details:', e);
      Alert.alert('Error', 'Failed to load batch data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courseId]);

  // Handle Material Pick
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setPickedFile({ uri: file.uri, name: file.name, size: file.size || 0 });
      }
    } catch (err) {
      Alert.alert('File Picker Error', 'An error occurred while picking the file.');
    }
  };

  const handleUploadMaterial = async () => {
    if (!materialTitle.trim() || !pickedFile) {
      Alert.alert('Validation Error', 'Please enter a title and select a PDF file.');
      return;
    }

    const formData = new FormData();
    formData.append('title', materialTitle.trim());
    formData.append('type', materialType);
    formData.append('courseId', courseId);
    formData.append('file', {
      uri: pickedFile.uri,
      name: pickedFile.name,
      type: 'application/pdf',
    } as any);

    try {
      setUploadingMaterial(true);
      await apiClient.post('/materials', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Success', 'Study material uploaded successfully!');
      setShowMaterialModal(false);
      setMaterialTitle('');
      setPickedFile(null);
      fetchData(); // Refresh list
    } catch (err: any) {
      Alert.alert('Upload Failed', err.response?.data?.error || 'Failed to upload document.');
    } finally {
      setUploadingMaterial(false);
    }
  };

  const handleDeleteMaterial = (id: string, name: string) => {
    Alert.alert('Confirm Delete', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await apiClient.delete(`/materials/${id}`);
          fetchData();
        } catch (e) {
          Alert.alert('Error', 'Failed to delete.');
        }
      }}
    ]);
  };

  const handlePostNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      Alert.alert('Validation Error', 'Please enter a title and content for the notice.');
      return;
    }
    try {
      setPostingNotice(true);
      await apiClient.post(`/courses/${courseId}/announcements`, {
        title: noticeTitle.trim(),
        content: noticeContent.trim()
      });
      Alert.alert('Success', 'Notice posted successfully!');
      setShowNoticeModal(false);
      setNoticeTitle('');
      setNoticeContent('');
      fetchData(); // Refresh list
    } catch (err: any) {
      Alert.alert('Post Failed', err.response?.data?.error || 'Failed to post notice.');
    } finally {
      setPostingNotice(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#2D8C82" />
      </View>
    );
  }

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  };

  return (
    <View className="flex-1 bg-slate-950 pt-12">
      {/* Header */}
      <View className="px-5 flex-row items-center mb-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-8 h-8 bg-slate-900 rounded-full items-center justify-center border border-slate-800 mr-3">
          <Text className="text-slate-100 font-bold">←</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-xl font-black flex-1" numberOfLines={1}>{courseTitle}</Text>
      </View>

      {/* Tabs */}
      <View className="px-5 mb-4 border-b border-slate-800">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {['MATERIALS', 'SYLLABUS', 'STUDENTS', 'NOTICES'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab as any)}
              className={`mr-6 pb-3 border-b-2 ${activeTab === tab ? 'border-blue-500' : 'border-transparent'}`}
            >
              <Text className={`font-bold ${activeTab === tab ? 'text-blue-400' : 'text-slate-500'}`}>
                {tab === 'SYLLABUS' ? 'TOPICS TAUGHT' : tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* MATERIALS TAB */}
        {activeTab === 'MATERIALS' && (
          <View className="pb-20">
            <TouchableOpacity onPress={() => setShowMaterialModal(true)} className="bg-blue-600/20 border border-blue-500/30 p-4 rounded-xl items-center mb-6">
              <Text className="text-blue-400 font-bold">+ Upload New Material (PDF)</Text>
            </TouchableOpacity>
            
            {materials.length === 0 ? (
              <Text className="text-slate-500 text-center mt-10">No materials uploaded yet.</Text>
            ) : (
              materials.map((item) => (
                <View key={item.id} className="bg-white border-2 border-slate-900 rounded-2xl p-4 mb-3 flex-row justify-between items-center">
                  <View className="flex-1 mr-3">
                    <Text className="text-[8px] font-black uppercase border px-2 py-0.5 rounded-md self-start mb-1" style={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#ffffff' }}>
                      {item.type.replace('_', ' ')}
                    </Text>
                    <Text className="text-slate-900 text-sm font-bold" style={{ color: '#0f172a' }}>{item.title}</Text>
                    <Text className="text-slate-500 text-[10px] mt-1" style={{ color: '#64748b' }}>{formatSize(item.fileSize)}</Text>
                  </View>
                  <View className="flex-row space-x-2">
                    <TouchableOpacity onPress={() => navigation.navigate('PDFViewer', { title: item.title, fileUrl: item.fileUrl })} className="bg-white w-8 h-8 rounded-full items-center justify-center border border-slate-300">
                      <Text className="text-xs">👁️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteMaterial(item.id, item.title)} className="bg-white w-8 h-8 rounded-full items-center justify-center border border-slate-300 ml-2">
                      <Text className="text-xs">🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* SYLLABUS TAB */}
        {activeTab === 'SYLLABUS' && (
          <View className="pb-20">
            {(!course?.lectures || course.lectures.length === 0) ? (
              <Text className="text-slate-500 text-center mt-10">No lectures in this batch.</Text>
            ) : (
              course.lectures.map((lecture: any) => (
                <View key={lecture.id} className="bg-white border-2 border-slate-900 rounded-2xl p-4 mb-3 flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="text-slate-500 text-[10px] font-bold">LESSON {lecture.sortOrder}</Text>
                    <Text className="text-slate-900 text-sm font-bold mt-1" numberOfLines={1}>{lecture.title}</Text>
                    <Text className="text-slate-500 text-xs mt-1">⌛ {Math.round(lecture.duration / 60)} mins</Text>
                  </View>
                  <TouchableOpacity onPress={() => navigation.navigate('LecturePlayer', { lectureId: lecture.id })} className="bg-blue-600/20 px-4 py-2 rounded-xl border border-blue-500/30">
                    <Text className="text-blue-400 font-bold text-xs">Play</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'STUDENTS' && (
          <View className="pb-20">
            <Text className="text-slate-400 mb-4 text-xs">Total Enrolled: {students.length}</Text>
            {students.length === 0 ? (
              <Text className="text-slate-500 text-center mt-10">No students enrolled yet.</Text>
            ) : (
              students.map((student) => (
                <View key={student.id} className="bg-white border-2 border-slate-900 rounded-xl p-4 mb-2 flex-row items-center">
                  <View className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3 border border-slate-200">
                    <Text className="text-slate-900 font-extrabold text-base" style={{ color: '#0f172a' }}>
                      {(student.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-900 font-bold text-sm" style={{ color: '#0f172a' }}>
                      {student.name}
                    </Text>
                    {student.school && (
                      <Text className="text-slate-500 text-[10px] mt-0.5" style={{ color: '#64748b' }}>
                        {student.school}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* NOTICES TAB */}
        {activeTab === 'NOTICES' && (
          <View className="pb-20">
            <TouchableOpacity onPress={() => setShowNoticeModal(true)} className="bg-emerald-600/20 border border-emerald-500/30 p-4 rounded-xl items-center mb-6">
              <Text className="text-emerald-400 font-bold">+ Post New Notice</Text>
            </TouchableOpacity>
            
            {announcements.length === 0 ? (
              <Text className="text-slate-500 text-center mt-10">No notices posted for this batch.</Text>
            ) : (
              announcements.map((notice) => (
                <View key={notice.id} className="bg-white border-2 border-slate-900 rounded-2xl p-5 mb-3">
                  <View className="flex-row justify-between items-start">
                    <Text className="text-slate-900 font-bold text-base flex-1 pr-2">{notice.title}</Text>
                    <TouchableOpacity onPress={() => {
                      Alert.alert('Delete Notice', 'Are you sure you want to delete this notice?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: async () => {
                            try {
                              await apiClient.delete(`/courses/${courseId}/announcements/${notice.id}`);
                              setAnnouncements(prev => prev.filter(a => a.id !== notice.id));
                            } catch (e) {
                              Alert.alert('Error', 'Failed to delete notice.');
                            }
                          }
                        }
                      ]);
                    }} className="bg-red-50 p-1.5 rounded-md border border-red-200">
                      <Text className="text-red-500 text-[10px] font-bold uppercase">Delete</Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-slate-500 text-xs mt-2 leading-5">{notice.content}</Text>
                  <Text className="text-slate-400 text-[10px] mt-3">
                    Posted on {new Date(notice.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Material Upload Modal */}
      <Modal visible={showMaterialModal} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="w-full max-w-[400px]"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl w-full">
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
                <Text className="text-white text-lg font-black mb-6">Upload Material</Text>
                
                <TextInput
                  className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white mb-4"
                  placeholder="Material Title"
                  placeholderTextColor="#64748b"
                  value={materialTitle}
                  onChangeText={setMaterialTitle}
                />

                <View className="flex-row mb-4">
                  {['NOTES', 'ASSIGNMENT', 'FORMULA_SHEET'].map(t => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setMaterialType(t)}
                      className="px-3.5 py-2 rounded-full border mr-2"
                      style={materialType === t 
                        ? { backgroundColor: '#1f2937', borderColor: '#111827' }
                        : { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }
                      }
                    >
                      <Text
                        className="text-[10px] font-bold"
                        style={{ color: materialType === t ? '#ffffff' : '#4b5563' }}
                      >
                        {t.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity onPress={handlePickDocument} className="bg-slate-800 border border-slate-700 p-4 rounded-xl items-center mb-6">
                  <Text className="text-white text-xs font-bold">{pickedFile ? pickedFile.name : 'Pick PDF Document'}</Text>
                </TouchableOpacity>

                <View className="flex-row justify-between mt-4">
                  <TouchableOpacity onPress={() => setShowMaterialModal(false)} disabled={uploadingMaterial} className="flex-1 py-3 mr-4 items-center">
                    <Text className="text-slate-400 font-bold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleUploadMaterial} disabled={uploadingMaterial} className="flex-1 bg-blue-600 py-3 rounded-xl items-center" style={{ backgroundColor: '#2D8C82' }}>
                    {uploadingMaterial ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-bold">Upload</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Notice Post Modal */}
      <Modal visible={showNoticeModal} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="w-full max-w-[400px]"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl w-full">
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
                <Text className="text-white text-lg font-black mb-6">Post Notice</Text>
                
                <TextInput
                  className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white mb-4"
                  placeholder="Notice Title"
                  placeholderTextColor="#64748b"
                  value={noticeTitle}
                  onChangeText={setNoticeTitle}
                />

                <TextInput
                  className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white mb-6 h-32"
                  placeholder="Notice Content..."
                  placeholderTextColor="#64748b"
                  multiline
                  textAlignVertical="top"
                  value={noticeContent}
                  onChangeText={setNoticeContent}
                />

                <View className="flex-row justify-between mt-4">
                  <TouchableOpacity onPress={() => setShowNoticeModal(false)} disabled={postingNotice} className="flex-1 py-3 mr-4 items-center">
                    <Text className="text-slate-400 font-bold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handlePostNotice} disabled={postingNotice} className="flex-1 bg-emerald-600 py-3 rounded-xl items-center" style={{ backgroundColor: '#5B6EF5' }}>
                    {postingNotice ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-bold">Post Notice</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>


    </View>
  );
};
