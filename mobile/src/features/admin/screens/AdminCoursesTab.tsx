import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { apiClient } from '../../../core/api/client';
import { useAuthStore } from '../../../core/store/auth';

const SUPERUSER_PHONES = ['+917980357754', '+919831754957'];

export const AdminCoursesTab: React.FC = () => {
  const { user, adminListCourses, adminEnrollStudent, adminAssignTeacher, adminRemoveTeacher, isLoading } = useAuthStore();
  const [courses, setCourses] = useState<any[]>([]);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Create Course Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [newCourse, setNewCourse] = useState({
    title: '', description: '', thumbnailUrl: '', price: '', categoryId: '', instructorName: ''
  });

  const isSuperuser = user && SUPERUSER_PHONES.includes(user.phoneNumber);
  const isCourseCreator = user && user.phoneNumber?.includes('9831754957');

  const loadCourses = async () => {
    const data = await adminListCourses();
    setCourses(data);
  };

  useEffect(() => {
    loadCourses();
    if (isCourseCreator) {
      apiClient.get('/courses/categories').then(res => {
        if (res.data.success) {
          setCategories(res.data.data);
          if (res.data.data.length > 0) {
            setNewCourse(prev => ({ ...prev, categoryId: res.data.data[0].id }));
          }
        }
      }).catch(console.error);
    }
  }, []);

  const handleCreateCourse = async () => {
    if (!newCourse.title || !newCourse.description || !newCourse.price || !newCourse.categoryId || !newCourse.instructorName) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    const success = await useAuthStore.getState().adminCreateCourse({
      ...newCourse,
      price: parseInt(newCourse.price, 10)
    });
    if (success) {
      Alert.alert('Success', 'Course created successfully.');
      setNewCourse({ title: '', description: '', thumbnailUrl: '', price: '', categoryId: categories[0]?.id || '', instructorName: '' });
      setShowCreateForm(false);
      loadCourses();
    } else {
      Alert.alert('Error', useAuthStore.getState().error || 'Failed to create course.');
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!enrollStudentId.trim()) {
      Alert.alert('Input Error', 'Please enter a Student ID.');
      return;
    }
    const success = await adminEnrollStudent(courseId, enrollStudentId.trim());
    if (success) {
      Alert.alert('Success', 'Student enrolled successfully.');
      setEnrollStudentId('');
      loadCourses();
    } else {
      const errorMsg = useAuthStore.getState().error || 'Failed to enroll student.';
      Alert.alert('Error', errorMsg);
    }
  };

  const handleAssignTeacher = async (courseId: string) => {
    if (!assignTeacherId.trim()) {
      Alert.alert('Input Error', 'Please enter a Teacher ID.');
      return;
    }
    const success = await adminAssignTeacher(courseId, assignTeacherId.trim());
    if (success) {
      Alert.alert('Success', 'Teacher assigned successfully.');
      setAssignTeacherId('');
      loadCourses();
    } else {
      const errorMsg = useAuthStore.getState().error || 'Failed to assign teacher.';
      Alert.alert('Error', errorMsg);
    }
  };

  const handleRemoveTeacher = (courseId: string, teacherId: string) => {
    Alert.alert('Confirm Remove', 'Are you sure you want to remove this teacher from the course?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const success = await adminRemoveTeacher(courseId, teacherId);
          if (success) {
            Alert.alert('Success', 'Teacher removed successfully.');
            loadCourses();
          } else {
            const errorMsg = useAuthStore.getState().error || 'Failed to remove teacher.';
            Alert.alert('Error', errorMsg);
          }
        }
      }
    ]);
  };

  if (isLoading && courses.length === 0) {
    return (
      <View className="items-center py-20">
        <ActivityIndicator size="small" color="#2D8C82" />
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pb-10">
      {/* Create Course Section (Shubhadeep Biswas Only) */}
      {isCourseCreator && (
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 rounded-2xl py-3 items-center shadow-lg shadow-blue-500/20"
          >
            <Text className="text-white text-xs font-bold uppercase tracking-wider">{showCreateForm ? 'Cancel Course Creation' : '+ Create New Course'}</Text>
          </TouchableOpacity>

          {showCreateForm && (
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mt-4">
              <Text className="text-slate-100 text-sm font-bold mb-4">Course Details</Text>
              
              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Title</Text>
              <TextInput className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-xs mb-3" placeholder="Course Title" placeholderTextColor="#5C5446" value={newCourse.title} onChangeText={(t) => setNewCourse({...newCourse, title: t})} />

              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Description</Text>
              <TextInput className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-xs mb-3" placeholder="Course Description" placeholderTextColor="#5C5446" value={newCourse.description} onChangeText={(t) => setNewCourse({...newCourse, description: t})} multiline />

              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Instructor Name</Text>
              <TextInput className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-xs mb-3" placeholder="e.g. Prof. Smith" placeholderTextColor="#5C5446" value={newCourse.instructorName} onChangeText={(t) => setNewCourse({...newCourse, instructorName: t})} />

              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Price (in Paisa)</Text>
              <TextInput className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-xs mb-3" placeholder="e.g. 50000 (for Rs. 500)" placeholderTextColor="#5C5446" value={newCourse.price} onChangeText={(t) => setNewCourse({...newCourse, price: t})} keyboardType="number-pad" />

              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Thumbnail URL (Optional)</Text>
              <TextInput className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-xs mb-3" placeholder="https://..." placeholderTextColor="#5C5446" value={newCourse.thumbnailUrl} onChangeText={(t) => setNewCourse({...newCourse, thumbnailUrl: t})} />

              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Category</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {categories.map(cat => (
                  <TouchableOpacity key={cat.id} onPress={() => setNewCourse({...newCourse, categoryId: cat.id})} className={`px-3 py-2 rounded-xl border ${newCourse.categoryId === cat.id ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 border-slate-800'}`}>
                    <Text className={`text-[10px] font-bold ${newCourse.categoryId === cat.id ? 'text-white' : 'text-slate-400'}`}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={handleCreateCourse} className="bg-emerald-600 rounded-2xl py-3.5 items-center">
                <Text className="text-white text-xs font-bold uppercase tracking-wider">Publish Course</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {courses.length === 0 ? (
        <View className="items-center py-20 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl">
          <Text className="text-slate-500 font-bold text-sm">No courses found.</Text>
        </View>
      ) : (
        courses.map((course) => (
          <View key={course.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
            <Text className="text-slate-100 text-base font-black mb-1">{course.title}</Text>
            <Text className="text-slate-400 text-xs mb-3">{course.category?.name || 'Uncategorized'}</Text>
            
            <View className="flex-row items-center mb-3">
              <View className="bg-blue-900/20 border border-blue-500/30 px-2.5 py-1 rounded-lg mr-2">
                <Text className="text-blue-400 text-[10px] font-bold">Students: {course._count?.purchases || 0}</Text>
              </View>
              <View className="bg-purple-900/20 border border-purple-500/30 px-2.5 py-1 rounded-lg">
                <Text className="text-purple-400 text-[10px] font-bold">Teachers: {course.teachers?.length || 0}</Text>
              </View>
            </View>

            {/* Teacher List */}
            {course.teachers && course.teachers.length > 0 && (
              <View className="mb-3">
                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Assigned Teachers</Text>
                {course.teachers.map((t: any) => (
                  <View key={t.userId} className="flex-row justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800 mb-1">
                    <View>
                      <Text className="text-slate-300 text-xs font-semibold">{t.user?.name}</Text>
                      <Text className="text-slate-500 text-[10px]">{t.user?.email || 'No email'}</Text>
                    </View>
                    {isSuperuser && (
                      <TouchableOpacity onPress={() => handleRemoveTeacher(course.id, t.userId)} className="bg-red-500/10 px-2 py-1 rounded-md">
                        <Text className="text-red-400 text-[10px] font-bold">Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Student List */}
            {course.purchases && course.purchases.length > 0 && (
              <View className="mb-3">
                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Enrolled Students</Text>
                {course.purchases.map((p: any) => (
                  <View key={p.id} className="flex-row justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800 mb-1">
                    <View>
                      <Text className="text-slate-300 text-xs font-semibold">{p.user?.name}</Text>
                      <Text className="text-slate-500 text-[10px]">{p.user?.email || 'No email'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Action Buttons */}
            <View className="flex-row gap-2 mt-2 pt-3 border-t border-slate-850">
              <TouchableOpacity
                onPress={() => setSelectedCourseId(selectedCourseId === course.id ? null : course.id)}
                className="flex-1 bg-slate-800 border border-slate-700/50 py-2 rounded-xl items-center"
              >
                <Text className="text-slate-200 text-xs font-bold">{selectedCourseId === course.id ? 'Close Actions' : 'Manage Course'}</Text>
              </TouchableOpacity>
            </View>

            {/* Manage Form */}
            {selectedCourseId === course.id && (
              <View className="mt-4 pt-4 border-t border-slate-800/50">
                
                {/* Enroll Student (Admins & Superusers) */}
                <View className="mb-4">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Enroll Student (Manual)</Text>
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 text-xs"
                      placeholder="Enter Student ID"
                      placeholderTextColor="#5C5446"
                      value={enrollStudentId}
                      onChangeText={setEnrollStudentId}
                    />
                    <TouchableOpacity
                      onPress={() => handleEnroll(course.id)}
                      className="bg-[#2D8C82] px-4 py-3 rounded-xl"
                    >
                      <Text className="text-white text-[10px] font-bold uppercase tracking-wider">Enroll</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Assign Teacher (Superusers Only) */}
                {isSuperuser && (
                  <View>
                    <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Assign Teacher</Text>
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 text-xs"
                        placeholder="Enter Teacher ID"
                        placeholderTextColor="#5C5446"
                        value={assignTeacherId}
                        onChangeText={setAssignTeacherId}
                      />
                      <TouchableOpacity
                        onPress={() => handleAssignTeacher(course.id)}
                        className="bg-purple-600 px-4 py-3 rounded-xl"
                      >
                        <Text className="text-white text-[10px] font-bold uppercase tracking-wider">Assign</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
};
