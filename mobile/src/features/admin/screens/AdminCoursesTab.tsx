import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator, Modal, SafeAreaView, Image } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiClient } from '../../../core/api/client';
import { useAuthStore } from '../../../core/store/auth';
import { COURSE_THEMES, getThemeUrl, extractThemeColor } from '../../../core/constants/courseThemes';

const COMMON_SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English'];

const SUPERUSER_PHONES = ['+917980357754', '+919831754957'];

export const AdminCoursesTab: React.FC = () => {
  const { user, adminListCourses, adminEnrollStudent, adminAssignTeacher, adminRemoveTeacher, adminDeleteCourse, adminListUsers, isLoading } = useAuthStore();
  const [courses, setCourses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [assignTeacherIds, setAssignTeacherIds] = useState<string[]>([]);
  const [loadingActions, setLoadingActions] = useState({ assignTeacher: false });
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [expandedCourse, setExpandedCourse] = useState<any | null>(null);

  // Filters
  const [filterDay, setFilterDay] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string | null>(null);

  // Create Course Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [newCourse, setNewCourse] = useState<{
    title: string; description: string; thumbnailUrl: string; price: string; categoryId: string; branch: string; targetClass: string; timeSlots: any[];
    isBundle: boolean; bundleCourseIds: string[];
  }>({
    title: '', description: '', thumbnailUrl: '', price: '', categoryId: '', branch: 'Sodepur', targetClass: '', timeSlots: [], isBundle: false, bundleCourseIds: []
  });

  const [slotDay, setSlotDay] = useState<string>('Mon');
  const [slotStartTime, setSlotStartTime] = useState(new Date(new Date().setHours(16, 30, 0, 0)));
  const [slotEndTime, setSlotEndTime] = useState(new Date(new Date().setHours(18, 30, 0, 0)));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Theme Dropdown State
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const handleAddSlot = () => {
    const formatTime = (d: Date) => d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const timeStr = `${formatTime(slotStartTime)} - ${formatTime(slotEndTime)}`;
    
    setNewCourse(prev => ({
      ...prev,
      timeSlots: [...prev.timeSlots, { day: slotDay, time: timeStr }]
    }));
  };

  const handleRemoveSlot = (idx: number) => {
    setNewCourse(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((_, i) => i !== idx)
    }));
  };

  const isSuperuser = true;
  const isCourseCreator = true;

  const loadCourses = async () => {
    const data = await adminListCourses();
    setCourses(data);
  };

  const loadAllUsers = async () => {
    const st = await adminListUsers('', 'STUDENT');
    const te = await adminListUsers('', 'TEACHER');
    setStudents(st);
    setTeachers(te);
  };

  useEffect(() => {
    loadCourses();
    loadAllUsers();
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

  const handlePickThumbnail = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewCourse({ ...newCourse, thumbnailUrl: result.assets[0].uri });
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSaveCourse = async () => {
    if (!newCourse.title || !newCourse.price) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    
    const courseData = {
      ...newCourse,
      price: parseInt(newCourse.price, 10) * 100, // Convert Rs to Paisa
      timeSlots: newCourse.timeSlots,
      branch: newCourse.branch,
      targetClass: newCourse.targetClass
    };

    let success;
    if (editingCourseId) {
      success = await useAuthStore.getState().adminUpdateCourse(editingCourseId, courseData);
    } else {
      success = await useAuthStore.getState().adminCreateCourse(courseData);
    }

    if (success) {
      Alert.alert('Success', `Course ${editingCourseId ? 'updated' : 'created'} successfully.`);
      setNewCourse({ title: '', description: '', thumbnailUrl: '', price: '', categoryId: categories[0]?.id || '', branch: 'Sodepur', targetClass: '', timeSlots: [], isBundle: false, bundleCourseIds: [] });
      setShowCreateForm(false);
      setEditingCourseId(null);
      loadCourses();
    } else {
      Alert.alert('Error', useAuthStore.getState().error || `Failed to ${editingCourseId ? 'update' : 'create'} course.`);
    }
  };

  const handleEditCourseClick = (course: any) => {
    setEditingCourseId(course.id);
    setNewCourse({
      title: course.title,
      description: course.description || '',
      price: course.price ? (course.price / 100).toString() : '',
      categoryId: course.categoryId || '',
      branch: course.branch || 'Sodepur',
      targetClass: course.targetClass || '',
      timeSlots: typeof course.timeSlots === 'string' ? JSON.parse(course.timeSlots) : (course.timeSlots || []),
      isBundle: course.isBundle || false,
      bundleCourseIds: course.bundleItems?.map((b: any) => b.courseId) || [],
      thumbnailUrl: course.thumbnailUrl || ''
    });
    setShowCreateForm(true);
    // Note: Scroll to top could be implemented with a ref
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
    if (assignTeacherIds.length === 0) {
      Alert.alert('Error', 'Please select at least one teacher to assign.');
      return;
    }
    setLoadingActions(prev => ({ ...prev, assignTeacher: true }));
    let successCount = 0;
    for (const tid of assignTeacherIds) {
      const success = await adminAssignTeacher(courseId, tid);
      if (success) successCount++;
    }
    setLoadingActions(prev => ({ ...prev, assignTeacher: false }));
    if (successCount > 0) {
      Alert.alert('Success', `Successfully assigned ${successCount} teacher(s).`);
      setAssignTeacherIds([]);
      loadCourses();
    } else {
      Alert.alert('Error', 'Failed to assign teachers.');
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

  const handleDeleteCourse = (courseId: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to permanently remove this course? This will remove all enrollments and materials.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await adminDeleteCourse(courseId);
          if (success) {
            Alert.alert('Success', 'Course deleted successfully.');
            loadCourses();
          } else {
            Alert.alert('Error', useAuthStore.getState().error || 'Failed to delete course.');
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
    <View className="flex-1">
      {/* Create Course Section */}
      {isCourseCreator && (
        <View className="mb-6">
          <TouchableOpacity 
          onPress={() => {
            setShowCreateForm(true);
            setEditingCourseId(null);
          }}
          className="py-3.5 rounded-xl items-center bg-slate-800 border border-slate-700/50 shadow-sm shadow-black/20"
        >
          <Text className="text-slate-300 font-bold text-[13px] uppercase tracking-wider">+ New Course</Text>
        </TouchableOpacity>

          <Modal visible={showCreateForm} animationType="slide" transparent onRequestClose={() => setShowCreateForm(false)}>
            <View className="flex-1 justify-end bg-black/80">
              <View className="bg-slate-950 rounded-t-3xl h-[75%] border-t border-slate-800">
                {/* Header */}
                <View className="flex-row justify-between items-center p-5 border-b border-slate-850">
                  <Text className="text-slate-100 text-lg font-black">{editingCourseId ? 'Edit Course' : 'Create New Course'}</Text>
                  <TouchableOpacity onPress={() => setShowCreateForm(false)} className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700/50">
                    <Text className="text-slate-300 font-bold text-xs">Cancel</Text>
                  </TouchableOpacity>
                </View>
                
                <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
                  <Text className="text-slate-100 text-sm font-bold mb-4">Course Details</Text>
              
              <View className="flex-row items-center justify-between mb-4 mt-2">
                <Text className="text-slate-400 text-[10px] font-bold uppercase">Is this a Bundle / Batch?</Text>
                <TouchableOpacity 
                  onPress={() => setNewCourse({...newCourse, isBundle: !newCourse.isBundle})}
                  className={`w-12 h-6 rounded-full justify-center px-1 ${newCourse.isBundle ? 'bg-blue-600' : 'bg-slate-700'}`}
                >
                  <View className={`w-4 h-4 rounded-full bg-white transition-all ${newCourse.isBundle ? 'ml-auto' : ''}`} />
                </TouchableOpacity>
              </View>

              <View style={{ zIndex: 50 }}>
                <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Title</Text>
                <TextInput 
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-xs mb-3" 
                  placeholder="Course Title" 
                  placeholderTextColor="#5C5446" 
                  value={newCourse.title} 
                  onChangeText={(t) => {
                    setNewCourse(prev => {
                      const matchedCat = categories.find(c => t.toLowerCase().includes(c.name.toLowerCase()));
                      return {
                        ...prev, 
                        title: t,
                        categoryId: matchedCat ? matchedCat.id : prev.categoryId
                      };
                    });
                  }} 
                />
                {(() => {
                  if (!newCourse.title) return null;
                  const tLower = newCourse.title.toLowerCase();
                  
                  // Collect unique category names from DB categories and COMMON_SUBJECTS
                  const availableNames = Array.from(new Set([
                    ...categories.map(c => c.name),
                    ...COMMON_SUBJECTS
                  ]));

                  const suggestions = availableNames.filter(name => 
                    name.toLowerCase().includes(tLower) && name.toLowerCase() !== tLower
                  );

                  if (suggestions.length === 0) return null;

                  return (
                    <View className="bg-slate-900 border border-slate-700 rounded-xl mb-3 overflow-hidden shadow-sm shadow-black/20">
                      {suggestions.map(name => {
                        const existingCat = categories.find(c => c.name === name);
                        return (
                          <TouchableOpacity 
                            key={name} 
                            className="px-4 py-3 border-b border-slate-800"
                            onPress={() => setNewCourse({...newCourse, title: name, categoryId: existingCat ? existingCat.id : newCourse.categoryId})}
                          >
                            <Text className="text-slate-200 text-xs font-bold">{name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>

              {!newCourse.isBundle ? (
                <View className="mb-4">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Timings & Time Slots</Text>
                  <View className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <View className="flex-row mb-3">
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
                          <TouchableOpacity 
                            key={day} 
                            onPress={() => setSlotDay(day)}
                            className={`px-3 py-1.5 rounded-lg mr-2 ${slotDay === day ? 'bg-blue-600' : 'bg-slate-800'}`}
                          >
                            <Text className={`text-xs font-bold ${slotDay === day ? 'text-white' : 'text-slate-400'}`}>{day}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    <View className="flex-row items-center mb-3">
                      <TouchableOpacity onPress={() => setShowStartPicker(true)} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mr-2">
                        <Text className="text-slate-300 text-[10px]">Start: {slotStartTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowEndPicker(true)} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mr-2">
                        <Text className="text-slate-300 text-[10px]">End: {slotEndTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleAddSlot} className="bg-emerald-600 px-4 justify-center rounded-lg py-2">
                        <Text className="text-white text-[10px] font-bold">Add</Text>
                      </TouchableOpacity>
                    </View>

                    {showStartPicker && (
                      <DateTimePicker
                        value={slotStartTime}
                        mode="time"
                        display="default"
                        onChange={(event: any, selectedDate: any) => {
                          setShowStartPicker(false);
                          if (selectedDate) setSlotStartTime(selectedDate);
                        }}
                      />
                    )}
                    {showEndPicker && (
                      <DateTimePicker
                        value={slotEndTime}
                        mode="time"
                        display="default"
                        onChange={(event: any, selectedDate: any) => {
                          setShowEndPicker(false);
                          if (selectedDate) setSlotEndTime(selectedDate);
                        }}
                      />
                    )}
                    {newCourse.timeSlots.length > 0 && (
                      <View className="mt-4 flex-row flex-wrap gap-3">
                        {newCourse.timeSlots.map((slot, idx) => (
                          <View key={idx} className="bg-teal-50 border border-teal-200 pl-4 pr-3 py-3 rounded-2xl flex-row items-center shadow-sm">
                            <Text className="text-teal-900 text-[13px] font-bold mr-4">{slot.day}   {slot.time}</Text>
                            <TouchableOpacity onPress={() => handleRemoveSlot(idx)} className="p-1 ml-2">
                              <Text className="text-red-500 text-xl font-bold" style={{ fontFamily: 'System' }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <View className="mb-4">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Select Courses for Bundle</Text>
                  <View style={{ maxHeight: 180 }} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <ScrollView nestedScrollEnabled className="p-2">
                      {courses.filter(c => !c.isBundle).map(courseItem => {
                        const isSelected = newCourse.bundleCourseIds.includes(courseItem.id);
                        return (
                          <TouchableOpacity 
                            key={courseItem.id} 
                            onPress={() => setNewCourse(prev => ({
                              ...prev,
                              bundleCourseIds: isSelected 
                                ? prev.bundleCourseIds.filter(id => id !== courseItem.id) 
                                : [...prev.bundleCourseIds, courseItem.id]
                            }))}
                            className={`p-3 rounded-lg border mb-1 flex-row justify-between items-center ${isSelected ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-900 border-slate-800'}`}
                          >
                            <View>
                              <Text className={`text-xs font-bold ${isSelected ? 'text-blue-400' : 'text-slate-200'}`}>{courseItem.title}</Text>
                            </View>
                            {isSelected && (
                              <View className="bg-blue-500 rounded-full w-4 h-4 items-center justify-center">
                                <Text className="text-white text-[9px] font-black">✓</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {courses.filter(c => !c.isBundle).length === 0 && (
                        <Text className="text-slate-500 text-xs text-center py-4">No regular courses available to bundle.</Text>
                      )}
                    </ScrollView>
                  </View>
                </View>
              )}
              

              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Price (in Rs)</Text>
              <TextInput className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-xs mb-3" placeholder="e.g. 500" placeholderTextColor="#5C5446" value={newCourse.price} onChangeText={(t) => setNewCourse({...newCourse, price: t})} keyboardType="number-pad" />

              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Target Class</Text>
              <TextInput className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-xs mb-3" placeholder="e.g. 11th" placeholderTextColor="#5C5446" value={newCourse.targetClass} onChangeText={(t) => setNewCourse({...newCourse, targetClass: t})} />

              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Branch</Text>
              <View className="flex-row gap-4 mb-3">
                {['Sodepur', 'Madhyamgram'].map(b => (
                  <TouchableOpacity
                    key={b}
                    onPress={() => setNewCourse({...newCourse, branch: b})}
                    className={`px-4 py-2 rounded-xl border flex-1 items-center ${newCourse.branch === b ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 border-slate-800'}`}
                  >
                    <Text className={`text-xs font-bold ${newCourse.branch === b ? 'text-white' : 'text-slate-400'}`}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>


              <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Course Theme</Text>
              <TouchableOpacity 
                onPress={() => setShowThemeSelector(true)} 
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 mb-3 items-center flex-row justify-center"
              >
                {newCourse.thumbnailUrl && (newCourse.thumbnailUrl.includes('unsplash') || newCourse.thumbnailUrl.includes('loremflickr')) ? (
                  <>
                    <Image source={newCourse.thumbnailUrl ? { uri: newCourse.thumbnailUrl } : undefined} style={{ width: 40, height: 24, borderRadius: 4, marginRight: 8 }} />
                    <Text className="text-emerald-400 text-xs font-bold">Theme Selected</Text>
                  </>
                ) : (
                  <Text className="text-blue-400 text-xs font-bold">Select Theme ▼</Text>
                )}
              </TouchableOpacity>

              {/* Theme Selection Modal */}
              <Modal visible={showThemeSelector} animationType="slide" transparent onRequestClose={() => setShowThemeSelector(false)}>
                <View className="flex-1 justify-end bg-black/80">
                  <View className="bg-slate-900 rounded-t-3xl border-t border-slate-800 pb-10" style={{ maxHeight: '60%' }}>
                    <View className="flex-row justify-between items-center p-5 border-b border-slate-850">
                      <Text className="text-slate-100 text-lg font-black">Select a Theme</Text>
                      <TouchableOpacity onPress={() => setShowThemeSelector(false)} className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700/50">
                        <Text className="text-slate-300 font-bold text-xs">Done</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView className="p-5">
                      {(() => {
                        const titleLower = newCourse.title.toLowerCase();
                        let availableThemes: any[] = [];
                        if (/\b(computer|cs|tech|programming|coding)\b/.test(titleLower)) availableThemes = COURSE_THEMES.computer;
                        else if (/\b(physic|physics)\b/.test(titleLower)) availableThemes = COURSE_THEMES.physics;
                        else if (/\b(chem|chemistry)\b/.test(titleLower)) availableThemes = COURSE_THEMES.chemistry;
                        else if (/\b(math|maths|mathematics)\b/.test(titleLower)) availableThemes = COURSE_THEMES.maths;
                        else if (/\b(bio|biology|botany|zoology)\b/.test(titleLower)) availableThemes = COURSE_THEMES.biology;
                        else availableThemes = [...COURSE_THEMES.computer, ...COURSE_THEMES.physics, ...COURSE_THEMES.chemistry, ...COURSE_THEMES.maths, ...COURSE_THEMES.biology]; // Fallback to all

                        return (
                          <View className="flex-row flex-wrap justify-between">
                            {availableThemes.map((theme) => {
                              const themeUri = getThemeUrl(theme.url, theme.color);
                              const isSelected = newCourse.thumbnailUrl === themeUri;
                              return (
                                <TouchableOpacity
                                  key={theme.id}
                                  onPress={() => {
                                    setNewCourse({ ...newCourse, thumbnailUrl: themeUri });
                                    setShowThemeSelector(false);
                                  }}
                                  className={`rounded-xl overflow-hidden border-2 mb-4 ${isSelected ? 'border-blue-500 shadow-sm shadow-blue-500/50' : 'border-slate-800'}`}
                                  style={{ width: '48%' }}
                                >
                                  <Image source={theme.url ? { uri: theme.url } : undefined} style={{ width: '100%', height: 90 }} resizeMode="cover" />
                                  <View className="p-2" style={{ backgroundColor: theme.color }}>
                                    <Text className="text-white text-[10px] font-bold text-center" numberOfLines={1}>{theme.name}</Text>
                                  </View>
                                  {isSelected && (
                                    <View className="absolute top-2 right-2 bg-blue-500 rounded-full w-5 h-5 items-center justify-center">
                                      <Text className="text-white text-[10px] font-black">✓</Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        );
                      })()}
                      <View className="h-10" />
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              {/* Categories Section Removed per user request */}

              <TouchableOpacity onPress={handleSaveCourse} className="bg-slate-800 border border-slate-700/80 rounded-2xl py-3.5 items-center mt-2 shadow-sm shadow-black/30">
                <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider">{editingCourseId ? 'Update Course' : 'Publish Course'}</Text>
              </TouchableOpacity>
              </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      )}

      {/* Filters Section */}
      {courses.length > 0 && (
        <View className="mb-4 bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
          <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Filter Courses</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            <TouchableOpacity onPress={() => setFilterClass(null)} className={`px-3 py-1.5 rounded-lg border mr-2 ${!filterClass ? 'bg-black border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
              <Text className={`text-[11px] font-bold ${!filterClass ? 'text-white' : 'text-slate-500'}`}>All Classes</Text>
            </TouchableOpacity>
            {Array.from(new Set(courses.map(c => c.targetClass).filter(Boolean))).sort().map(cls => (
              <TouchableOpacity key={cls as string} onPress={() => setFilterClass(cls as string)} className={`px-3 py-1.5 rounded-lg border mr-2 ${filterClass === cls ? 'bg-black border-slate-700' : 'bg-slate-900 border-slate-800'}`}>
                <Text className={`text-[11px] font-bold ${filterClass === cls ? 'text-white' : 'text-slate-500'}`}>Class {cls}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity onPress={() => setFilterDay(null)} className={`px-3 py-1.5 rounded-lg border mr-2 ${!filterDay ? 'bg-black border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
              <Text className={`text-[11px] font-bold ${!filterDay ? 'text-white' : 'text-slate-500'}`}>All Days</Text>
            </TouchableOpacity>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
              <TouchableOpacity key={day} onPress={() => setFilterDay(day)} className={`px-3 py-1.5 rounded-lg border mr-2 ${filterDay === day ? 'bg-black border-slate-700' : 'bg-slate-900 border-slate-800'}`}>
                <Text className={`text-[11px] font-bold ${filterDay === day ? 'text-white' : 'text-slate-500'}`}>{day}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {courses.filter(course => {
        if (filterClass && course.targetClass !== filterClass) return false;
        if (filterDay && course.timeSlots) {
          const slotsStr = typeof course.timeSlots === 'string' ? course.timeSlots : JSON.stringify(course.timeSlots);
          if (!slotsStr.includes(`"day":"${filterDay}"`) && !slotsStr.includes(`"day": "${filterDay}"`)) {
            return false;
          }
        }
        return true;
      }).length === 0 ? (
        <View className="items-center py-20 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl">
          <Text className="text-slate-500 font-bold text-sm">No courses found.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 150 }}>
          <View className="flex-row flex-wrap justify-between px-1">
          {courses.filter(course => {
            if (filterClass && course.targetClass !== filterClass) return false;
            if (filterDay && course.timeSlots) {
              const slotsStr = typeof course.timeSlots === 'string' ? course.timeSlots : JSON.stringify(course.timeSlots);
              if (!slotsStr.includes(`"day":"${filterDay}"`) && !slotsStr.includes(`"day": "${filterDay}"`)) {
                return false;
              }
            }
            return true;
          }).map((course) => (
            <View key={course.id} style={{ width: '48%' }} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 mb-4 shadow-sm shadow-black/20">
              <TouchableOpacity onPress={() => setExpandedCourse(course)}>
                <Text className="text-slate-100 text-[13px] font-black mb-1 leading-tight" numberOfLines={2}>{course.title}</Text>
                <Text className="text-slate-400 text-[10px] mb-3" numberOfLines={1}>{course.category?.name || 'Uncategorized'}</Text>
              </TouchableOpacity>
            
            <View className="flex-row flex-wrap gap-2 mb-2">
              <View className="bg-blue-900/20 border border-blue-500/30 px-2 py-1 rounded-md">
                <Text className="text-blue-400 text-[9px] font-bold">Students: {course._count?.purchases || 0}</Text>
              </View>
              <View className="bg-purple-900/20 border border-purple-500/30 px-2 py-1 rounded-md">
                <Text className="text-purple-400 text-[9px] font-bold">Teachers: {course.teachers?.length || 0}</Text>
              </View>
            </View>

            <View className="flex-row gap-1.5 mt-2 pt-2 border-t border-slate-800/80">
              <TouchableOpacity
                onPress={() => handleEditCourseClick(course)}
                className="flex-1 bg-slate-800/80 border border-slate-700/50 py-1.5 rounded-lg items-center"
              >
                <Text className="text-slate-300 text-[10px] font-bold">Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedCourseId(selectedCourseId === course.id ? null : course.id)}
                className="flex-1 bg-slate-600 border border-slate-500 py-1.5 rounded-lg items-center"
              >
                <Text className="text-white text-[10px] font-bold">{selectedCourseId === course.id ? 'Close' : 'Manage'}</Text>
              </TouchableOpacity>
            </View>


            {/* Manage Form */}
            {selectedCourseId === course.id && (
              <Modal visible={selectedCourseId === course.id} animationType="slide" transparent onRequestClose={() => setSelectedCourseId(null)}>
                <View className="flex-1 justify-end bg-black/80">
                  <View className="bg-slate-950 rounded-t-3xl h-[75%] border-t border-slate-800">
                    <View className="flex-row justify-between items-center p-5 border-b border-slate-850">
                      <Text className="text-slate-100 text-lg font-black" numberOfLines={1} style={{ flex: 1, marginRight: 10 }}>Manage: {course.title}</Text>
                      <TouchableOpacity onPress={() => setSelectedCourseId(null)} className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700/50">
                        <Text className="text-slate-300 font-bold text-xs">Close</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 100 }}>
                
                {/* Teacher List (Moved Inside Manage) */}
                {course.teachers && course.teachers.length > 0 && (
                  <View className="mb-4">
                    <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Assigned Teachers</Text>
                    {course.teachers.map((t: any) => (
                      <View key={t.userId} className="flex-row justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 mb-2">
                        <View>
                          <Text className="text-slate-300 text-xs font-semibold">{t.user?.name}</Text>
                          <Text className="text-slate-500 text-[10px]">{t.user?.email || 'No email'}</Text>
                        </View>
                        {isSuperuser && !course.isBundle && (
                          <TouchableOpacity onPress={() => handleRemoveTeacher(course.id, t.userId)} className="bg-red-500/10 px-3 py-1.5 rounded-md border border-red-500/20">
                            <Text className="text-red-400 text-[10px] font-bold">Remove</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Enroll Student (Admins & Superusers) */}
                <View className="mb-4">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">
                    Enroll Student {course.targetClass ? `(Class ${course.targetClass})` : '(All Classes)'}
                  </Text>
                  
                  <View style={{ maxHeight: 160 }} className="bg-slate-950 border border-slate-800 rounded-xl mb-3 overflow-hidden">
                    <ScrollView nestedScrollEnabled className="p-2">
                      {students.filter(s => !course.targetClass || s.class === course.targetClass).map(student => (
                        <TouchableOpacity 
                          key={student.id} 
                          onPress={() => setEnrollStudentId(student.id)}
                          className={`p-3 rounded-lg border mb-1 flex-row justify-between items-center ${enrollStudentId === student.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-900 border-slate-800'}`}
                        >
                          <View>
                            <Text className={`text-xs font-bold ${enrollStudentId === student.id ? 'text-blue-400' : 'text-slate-200'}`}>{student.name}</Text>
                            <Text className={`text-[10px] mt-0.5 ${enrollStudentId === student.id ? 'text-blue-300/70' : 'text-slate-500'}`}>
                              {student.phoneNumber} {student.class ? `| Class ${student.class}` : ''}
                            </Text>
                          </View>
                          {enrollStudentId === student.id && (
                            <View className="bg-blue-500 rounded-full w-4 h-4 items-center justify-center">
                              <Text className="text-white text-[9px] font-black">✓</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                      {students.filter(s => !course.targetClass || s.class === course.targetClass).length === 0 && (
                        <Text className="text-slate-500 text-xs text-center py-4">No students found for this class.</Text>
                      )}
                    </ScrollView>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleEnroll(course.id)}
                    className="bg-[#2D8C82] py-3.5 rounded-xl items-center"
                  >
                    <Text className="text-white text-xs font-bold uppercase tracking-wider">Enroll Selected Student</Text>
                  </TouchableOpacity>
                </View>

                {/* Assign Teacher (Superusers Only, Hidden for Bundles) */}
                {isSuperuser && !course.isBundle && (
                  <View className="mb-4">
                    <Text className="text-slate-400 text-[10px] font-bold uppercase mb-2">Assign Teachers</Text>
                    
                    <View style={{ maxHeight: 160 }} className="bg-slate-950 border border-slate-800 rounded-xl mb-3 overflow-hidden">
                      <ScrollView nestedScrollEnabled className="p-2">
                        {teachers.map(teacher => {
                          const isSelected = assignTeacherIds.includes(teacher.id);
                          return (
                            <TouchableOpacity 
                              key={teacher.id} 
                              onPress={() => setAssignTeacherIds(prev => isSelected ? prev.filter(id => id !== teacher.id) : [...prev, teacher.id])}
                              className={`p-3 rounded-lg border mb-1 flex-row justify-between items-center ${isSelected ? 'bg-purple-600/20 border-purple-500' : 'bg-slate-900 border-slate-800'}`}
                            >
                              <View>
                                <Text className={`text-xs font-bold ${isSelected ? 'text-purple-400' : 'text-slate-200'}`}>{teacher.name}</Text>
                                <Text className={`text-[10px] mt-0.5 ${isSelected ? 'text-purple-300/70' : 'text-slate-500'}`}>
                                  {teacher.phoneNumber} {teacher.subjects ? `| Subjects: ${teacher.subjects}` : ''}
                                </Text>
                              </View>
                              {isSelected && (
                                <View className="bg-purple-500 rounded-full w-4 h-4 items-center justify-center">
                                  <Text className="text-white text-[9px] font-black">✓</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                        {teachers.length === 0 && (
                          <Text className="text-slate-500 text-xs text-center py-4">No teachers found.</Text>
                        )}
                      </ScrollView>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleAssignTeacher(course.id)}
                      className="bg-purple-600 py-3.5 rounded-xl items-center"
                    >
                      <Text className="text-white text-xs font-bold uppercase tracking-wider">Assign Selected Teachers</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Delete Course (Superusers Only) */}
                {isSuperuser && (
                  <TouchableOpacity
                    onPress={() => handleDeleteCourse(course.id)}
                    className="bg-red-500/10 border border-red-500/20 py-3 rounded-xl items-center mt-2 mb-4"
                  >
                    <Text className="text-red-400 text-xs font-bold uppercase tracking-wider">Delete Course</Text>
                  </TouchableOpacity>
                )}

                    </ScrollView>
                  </View>
                </View>
              </Modal>
            )}
          </View>
          ))}
          </View>
        </ScrollView>
      )}

      {/* Expanded Course Details Pop-up Modal */}
      <Modal visible={!!expandedCourse} animationType="fade" transparent={true} onRequestClose={() => setExpandedCourse(null)}>
        <View className="flex-1 bg-black/80 justify-center p-5">
          <View className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-xl shadow-black">
            <View className="flex-row justify-between items-start mb-4">
              <Text className="text-white text-base font-black flex-1 mr-2">{expandedCourse?.title}</Text>
              <TouchableOpacity onPress={() => setExpandedCourse(null)} className="bg-slate-800 rounded-full w-8 h-8 items-center justify-center">
                <Text className="text-slate-400 font-bold">✕</Text>
              </TouchableOpacity>
            </View>
            
            {expandedCourse?.teachers && expandedCourse.teachers.length > 0 && (
              <View className="mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800/50">
                <Text className="text-purple-400 text-[10px] font-bold uppercase tracking-wider mb-2">Assigned Faculty</Text>
                {expandedCourse.teachers.map((t: any) => (
                  <Text key={t.userId} className="text-slate-200 text-xs mb-1">• {t.user?.name}</Text>
                ))}
              </View>
            )}
            
            {expandedCourse?.purchases && expandedCourse.purchases.length > 0 && (
              <View className="mb-2 bg-slate-950 p-3 rounded-xl border border-slate-800/50">
                <Text className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-2">Enrolled Students</Text>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {expandedCourse.purchases.map((p: any) => (
                    <Text key={p.id} className="text-slate-300 text-xs mb-1.5">• {p.user?.name}</Text>
                  ))}
                </ScrollView>
              </View>
            )}
            
            {(!expandedCourse?.teachers?.length && !expandedCourse?.purchases?.length) && (
              <Text className="text-slate-500 text-sm italic text-center py-4">No faculty or students enrolled yet.</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};
