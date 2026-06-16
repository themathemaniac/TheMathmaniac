import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { apiClient } from '../../../core/api/client';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type TeacherMaterialsNavigationProp = StackNavigationProp<RootStackParamList, 'AppTabs'>;

export const TeacherMaterialsScreen: React.FC = () => {
  const navigation = useNavigation<TeacherMaterialsNavigationProp>();
  const [materials, setMaterials] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal & Upload States
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('NOTES'); // NOTES, ASSIGNMENT, FORMULA_SHEET
  const [courseId, setCourseId] = useState('');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchMaterialsAndCourses = async () => {
    try {
      setLoading(true);
      const [matRes, courseRes] = await Promise.all([
        apiClient.get('/materials'),
        apiClient.get('/courses'),
      ]);
      setMaterials(matRes.data.data);
      setCourses(courseRes.data.data);
      if (courseRes.data.data.length > 0) {
        setCourseId(courseRes.data.data[0].id);
      }
    } catch (e) {
      console.log('Error loading teacher materials/courses:', e);
      Alert.alert('Load Error', 'Failed to retrieve files and batches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterialsAndCourses();
  }, []);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setPickedFile({
          uri: file.uri,
          name: file.name,
          size: file.size || 0,
        });
      }
    } catch (err) {
      Alert.alert('File Picker Error', 'An error occurred while picking the file.');
    }
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Alert', 'Please enter a title for this study resource.');
      return;
    }
    if (!editingId && !pickedFile) {
      Alert.alert('Validation Alert', 'Please select a PDF document to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('type', type);
    formData.append('courseId', courseId);
    
    if (pickedFile) {
      formData.append('file', {
        uri: pickedFile.uri,
        name: pickedFile.name,
        type: 'application/pdf',
      } as any);
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const endpoint = editingId ? `/materials/${editingId}` : '/materials';
      const method = editingId ? 'put' : 'post';

      await apiClient.request({
        url: endpoint,
        method: method,
        data: formData,
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

      Alert.alert('Success', editingId ? 'Study material updated successfully!' : 'Study material uploaded successfully!');
      setModalVisible(false);
      resetForm();
      fetchMaterialsAndCourses();
    } catch (err: any) {
      console.log('Upload error:', err);
      Alert.alert('Upload Failed', err.response?.data?.error || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Confirm Delete', `Are you sure you want to permanently delete: "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await apiClient.delete(`/materials/${id}`);
            Alert.alert('Deleted', 'Document has been removed.');
            fetchMaterialsAndCourses();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete study material.');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const openEditModal = (material: any) => {
    setEditingId(material.id);
    setTitle(material.title);
    setType(material.type);
    setCourseId(material.courseId);
    setPickedFile(null); // Optional to replace file
    setModalVisible(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setType('NOTES');
    if (courses.length > 0) {
      setCourseId(courses[0].id);
    }
    setPickedFile(null);
  };

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb > 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${Math.round(kb)} KB`;
  };

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-slate-100 text-2xl font-black">Study Resources</Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
          className="bg-blue-600 px-4 py-2.5 rounded-full active:opacity-90"
        >
          <Text className="text-white text-xs font-bold">+ Add Doc</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#8A2222" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="pb-24">
            {materials.length > 0 ? (
              materials.map((item) => (
                <View
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3 flex-row justify-between items-center"
                >
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center flex-wrap">
                      <Text className="text-slate-500 text-[8px] font-black tracking-widest uppercase border border-slate-800 bg-slate-950 px-2 py-0.5 rounded-md mr-2 my-0.5">
                        {item.type.replace('_', ' ')}
                      </Text>
                      <Text className="text-slate-400 text-[10px]" numberOfLines={1}>
                        {item.courseTitle}
                      </Text>
                    </View>
                    <Text className="text-slate-200 text-sm font-bold mt-2">
                      {item.title}
                    </Text>
                    <Text className="text-slate-400 text-xs mt-1">Size: {formatSize(item.fileSize)}</Text>
                  </View>

                  {/* Action triggers */}
                  <View className="flex-row items-center space-x-2">
                    <TouchableOpacity
                      onPress={() => navigation.navigate('PDFViewer', { title: item.title, fileUrl: item.fileUrl })}
                      className="bg-slate-800 w-8 h-8 rounded-full justify-center items-center border border-slate-700/50"
                    >
                      <Text className="text-xs">👁️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => openEditModal(item)}
                      className="bg-slate-800 w-8 h-8 rounded-full justify-center items-center border border-slate-700/50"
                    >
                      <Text className="text-xs">✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(item.id, item.title)}
                      className="bg-slate-800 w-8 h-8 rounded-full justify-center items-center border border-slate-700/50"
                    >
                      <Text className="text-xs">🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View className="items-center py-20">
                <Text className="text-4xl">📂</Text>
                <Text className="text-slate-400 font-bold mt-4">No materials uploaded yet.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Upload/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-slate-950/80">
          <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 min-h-[500px]">
            <Text className="text-slate-100 text-lg font-black mb-6">
              {editingId ? 'Edit Study Resource' : 'Upload Study Resource'}
            </Text>

            {/* Title */}
            <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Title</Text>
            <TextInput
              className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-3.5 text-slate-100 text-sm font-semibold mb-4"
              placeholder="E.g. Limits Sheet Part 2"
              placeholderTextColor="#8A8070"
              value={title}
              onChangeText={setTitle}
            />

            {/* Material Type Selection */}
            <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Resource Type</Text>
            <View className="flex-row mb-4 flex-wrap">
              {['NOTES', 'ASSIGNMENT', 'FORMULA_SHEET'].map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setType(t)}
                  className={`px-4 py-2 rounded-full border mr-2 mb-2 ${
                    type === t ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700/50'
                  }`}
                >
                  <Text className="text-white text-xs font-bold">{t.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Course Selector */}
            <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Assign to Course</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
              {courses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  onPress={() => setCourseId(course.id)}
                  className={`px-4 py-2 rounded-xl border mr-2 ${
                    courseId === course.id ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700/50'
                  }`}
                >
                  <Text className="text-white text-xs font-bold" numberOfLines={1}>
                    {course.title.split(' - ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* File Picker Display */}
            <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Attachment (PDF only)</Text>
            <View className="bg-slate-800 border border-slate-700/50 rounded-2xl p-4 flex-row justify-between items-center mb-6">
              <View className="flex-1 mr-3">
                {pickedFile ? (
                  <View>
                    <Text className="text-slate-100 text-xs font-bold" numberOfLines={1}>{pickedFile.name}</Text>
                    <Text className="text-slate-400 text-[10px] mt-1">{formatSize(pickedFile.size)}</Text>
                  </View>
                ) : (
                  <Text className="text-slate-500 text-xs">
                    {editingId ? 'Leave empty to keep current PDF file' : 'No document selected'}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={handlePickDocument}
                className="bg-slate-800 border border-slate-700/50 px-4 py-2 rounded-xl active:bg-slate-700"
              >
                <Text className="text-slate-100 text-xs font-bold">Pick PDF</Text>
              </TouchableOpacity>
            </View>

            {/* Upload Progress Bar */}
            {uploading && (
              <View className="mb-6">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-blue-400 text-xs font-bold">Uploading Document...</Text>
                  <Text className="text-blue-400 text-xs font-mono font-bold">{uploadProgress}%</Text>
                </View>
                <View className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <View style={{ width: `${uploadProgress}%` }} className="bg-blue-600 h-full rounded-full" />
                </View>
              </View>
            )}

            {/* Buttons */}
            <View className="flex-row justify-between mt-auto mb-6">
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
                disabled={uploading}
                className="flex-1 border border-slate-800 bg-transparent py-3 rounded-2xl mr-4 items-center"
              >
                <Text className="text-slate-400 text-sm font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpload}
                disabled={uploading}
                className="flex-1 bg-blue-600 py-3 rounded-2xl items-center"
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white text-sm font-bold">
                    {editingId ? 'Save Changes' : 'Upload Resource'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
