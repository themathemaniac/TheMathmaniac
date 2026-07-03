import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { apiClient } from '../../../core/api/client';
import { Button } from '../../../shared/components/Button';
import { Skeleton } from '../../../shared/components/Skeleton';
import { extractThemeColor } from '../../../core/constants/courseThemes';

type CourseDetailsRouteProp = RouteProp<RootStackParamList, 'CourseDetails'>;
type CourseDetailsNavigationProp = StackNavigationProp<RootStackParamList, 'CourseDetails'>;

interface Props {
  route: CourseDetailsRouteProp;
}

export const CourseDetailsScreen: React.FC<Props> = ({ route }) => {
  const { courseId } = route.params;
  const navigation = useNavigation<CourseDetailsNavigationProp>();
  const [course, setCourse] = useState<any | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'VIDEOS' | 'MATERIALS' | 'NOTICES'>(
    route.params?.initialTab || 'VIDEOS'
  );
  const [loading, setLoading] = useState(true);

  const fetchCourseDetails = async () => {
    try {
      setLoading(true);
      const [courseRes, materialsRes, announcementsRes] = await Promise.all([
        apiClient.get(`/courses/${courseId}`),
        apiClient.get(`/materials`, { params: { courseId } }).catch(() => ({ data: { data: [] } })),
        apiClient.get(`/courses/${courseId}/announcements`).catch(() => ({ data: { data: [] } }))
      ]);
      setCourse(courseRes.data.data);
      setMaterials(materialsRes.data.data || []);
      setAnnouncements(announcementsRes.data.data || []);
    } catch (e) {
      console.log('Error fetching course details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseDetails();
  }, [courseId]);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const handleLecturePress = (lectureId: string, hasAccess: boolean) => {
    if (!hasAccess) {
      Alert.alert('Access Denied', 'You need to be enrolled in this program to watch the lectures.');
      return;
    }
    navigation.navigate('LecturePlayer', { lectureId });
  };

  const handleMaterialPress = (item: any, hasAccess: boolean) => {
    if (!hasAccess) {
      Alert.alert('Access Denied', 'You need to be enrolled in this program to view study materials.');
      return;
    }
    if (item.fileUrl) {
      navigation.navigate('PDFViewer', { title: item.title, fileUrl: item.fileUrl });
    } else {
      Alert.alert('Resource Locked', 'This material does not have a valid document URL.');
    }
  };



  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 px-6 pt-16">
        <Skeleton height={200} borderRadius={24} />
        <Skeleton height={30} className="mt-6" />
        <Skeleton height={100} className="mt-4" />
        <Skeleton height={200} className="mt-6" />
      </View>
    );
  }

  if (!course) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center px-6">
        <Text className="text-slate-100 text-base">Course details could not be loaded.</Text>
      </View>
    );
  }

  const formattedPrice = course.price === 0 ? 'FREE' : `₹${(course.price / 100).toLocaleString('en-IN')}`;
  const themeColor = extractThemeColor(course.thumbnailUrl);
  const cardStyle = themeColor ? { borderColor: themeColor } : {};

  return (
    <View className="flex-1 bg-slate-950">
      {/* Scrollable Details */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Course Teaser/Image Block */}
        <View className="relative">
          <Image source={course.thumbnailUrl ? { uri: course.thumbnailUrl } : undefined} className="w-full h-56" resizeMode="cover" />
          <TouchableOpacity
            className="absolute left-6 top-14 w-10 h-10 bg-slate-900/80 rounded-full justify-center items-center border border-slate-700/50"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-slate-100 text-lg font-bold">←</Text>
          </TouchableOpacity>
        </View>

        <View className="p-6">
          <Text className="text-xs font-bold text-blue-400 uppercase tracking-widest">
            {course.targetClass ? `Class ${course.targetClass}` : course.category?.name || 'Program'}
          </Text>
          <Text className="text-slate-100 text-2xl font-black mt-2 leading-8">{course.title}</Text>



          {/* Assigned Faculty */}
          {course.teachers && course.teachers.length > 0 && (
            <View className="mt-4 border rounded-2xl p-4 bg-white" style={cardStyle}>
              <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3" style={themeColor ? { color: themeColor } : { color: '#475569' }}>Assigned Faculty</Text>
              {course.teachers.map((t: any) => (
                <View key={t.user.id} className="flex-row items-center mb-2">
                  <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center mr-3 border border-blue-200">
                    <Text className="text-blue-600 font-bold text-xs" style={{ color: '#2563eb' }}>
                      {(t.user.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-900 font-bold text-xs" style={{ color: '#0f172a' }}>{t.user.name}</Text>
                    {t.user.subjects && (
                      <Text className="text-blue-600 text-[10px] font-medium" style={{ color: '#2563eb' }}>{t.user.subjects}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 10-Second Value Outcomes */}
          {course.learningOutcomes && course.learningOutcomes.length > 0 && (
            <View className="border rounded-3xl p-5 mt-6 bg-white" style={cardStyle}>
              <Text className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3" style={themeColor ? { color: themeColor } : { color: '#2563eb' }}>
                ⚡ What you will learn
              </Text>
              {course.learningOutcomes.map((outcome: string, idx: number) => (
                <View key={idx} className="flex-row items-start mt-2">
                  <Text className="text-emerald-500 text-sm font-bold mr-2" style={{ color: '#10b981' }}>✓</Text>
                  <Text className="text-slate-800 text-xs leading-5 flex-1" style={{ color: '#1e293b' }}>{outcome}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          <Text className="text-slate-100 text-base font-bold mt-8">About Course</Text>
          <Text className="text-slate-400 text-xs leading-6 mt-3">{course.description}</Text>

          {/* Tabs for Videos, Materials & Notices */}
          <View className="flex-row border-b border-slate-800 mb-6 mt-8">
            <TouchableOpacity
              onPress={() => setActiveTab('VIDEOS')}
              className={`flex-1 pb-3 border-b-2 items-center ${activeTab === 'VIDEOS' ? 'border-blue-500' : 'border-transparent'}`}
            >
              <Text className={`font-bold text-xs ${activeTab === 'VIDEOS' ? 'text-blue-400' : 'text-slate-500'}`}>
                VIDEOS ({course.lectureCount})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('MATERIALS')}
              className={`flex-1 pb-3 border-b-2 items-center ${activeTab === 'MATERIALS' ? 'border-blue-500' : 'border-transparent'}`}
            >
              <Text className={`font-bold text-xs ${activeTab === 'MATERIALS' ? 'text-blue-400' : 'text-slate-500'}`}>
                MATERIALS ({materials.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('NOTICES')}
              className={`flex-1 pb-3 border-b-2 items-center ${activeTab === 'NOTICES' ? 'border-blue-500' : 'border-transparent'}`}
            >
              <Text className={`font-bold text-xs ${activeTab === 'NOTICES' ? 'text-blue-400' : 'text-slate-500'}`}>
                NOTICES ({announcements.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab content */}
          {activeTab === 'VIDEOS' && (
            <View className="pb-10">
              {course.lectures.length === 0 ? (
                <Text className="text-slate-500 text-center mt-6">No videos in this course.</Text>
              ) : (
                course.lectures.map((lecture: any) => {
                  const hasAccess = !!course?.isPurchased;
                  return (
                    <TouchableOpacity
                      key={lecture.id}
                      onPress={() => handleLecturePress(lecture.id, hasAccess)}
                      className="border rounded-2xl p-4 mb-3 flex-row items-center justify-between bg-white"
                      style={cardStyle}
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-slate-500 text-[10px] font-bold" style={themeColor ? { color: themeColor } : { color: '#64748b' }}>LESSON {lecture.sortOrder}</Text>
                        <Text className="text-slate-900 text-sm font-bold mt-1" numberOfLines={1} style={{ color: '#0f172a' }}>
                          {lecture.title}
                        </Text>
                        <Text className="text-slate-500 text-xs mt-1" style={{ color: '#64748b' }}>
                          ⌛ {Math.round(lecture.duration / 60)} mins
                        </Text>
                      </View>
                      <View className="items-center">
                        {!hasAccess ? (
                          <Text className="text-slate-400 text-base">🔒</Text>
                        ) : lecture.completed ? (
                          <Text className="text-emerald-500 text-base" style={{ color: '#10b981' }}>✓</Text>
                        ) : (
                          <Text className="text-blue-600 text-xs font-semibold" style={{ color: '#2563eb' }}>Play</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {activeTab === 'MATERIALS' && (
            <View className="pb-10">
              {materials.length === 0 ? (
                <Text className="text-slate-500 text-center mt-6">No study materials in this course.</Text>
              ) : (
                materials.map((item: any) => {
                  const hasAccess = !!course?.isPurchased;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleMaterialPress(item, hasAccess)}
                      className="border rounded-2xl p-4 mb-3 flex-row items-center justify-between bg-white"
                      style={cardStyle}
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-[8px] font-black uppercase border px-2 py-0.5 rounded-md self-start mb-1" style={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#ffffff' }}>
                          {item.type.replace('_', ' ')}
                        </Text>
                        <Text className="text-slate-900 text-sm font-bold mt-1" numberOfLines={1} style={{ color: '#0f172a' }}>
                          {item.title}
                        </Text>
                        <Text className="text-slate-500 text-[10px] mt-1" style={{ color: '#64748b' }}>
                          {item.fileSize ? `${(item.fileSize / 1024).toFixed(1)} KB` : ''}
                        </Text>
                      </View>
                      <View className="items-center">
                        {!hasAccess ? (
                          <Text className="text-slate-400 text-base">🔒</Text>
                        ) : (
                          <Text className="text-blue-600 text-xs font-semibold" style={{ color: '#2563eb' }}>View PDF 👁️</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {activeTab === 'NOTICES' && (
            <View className="pb-10">
              {announcements.length === 0 ? (
                <Text className="text-slate-500 text-center mt-6">No announcements in this course.</Text>
              ) : (
                announcements.map((item: any) => (
                  <View
                    key={item.id}
                    className="border rounded-2xl p-4 mb-3 bg-white"
                    style={cardStyle}
                  >
                    <View className="flex-row justify-between items-baseline mb-2">
                      <Text className="text-[10px] font-bold" style={{ color: '#64748b' }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </Text>
                      <Text className="text-[10px] font-bold" style={themeColor ? { color: themeColor } : { color: '#2563eb' }}>
                        👤 {item.authorName || course.instructorName || 'Instructor'}
                      </Text>
                    </View>
                    <Text className="text-slate-900 text-sm font-bold mt-1" style={{ color: '#0f172a' }}>
                      {item.title}
                    </Text>
                    <Text className="text-slate-600 text-xs mt-2 leading-5" style={{ color: '#334155' }}>
                      {item.content}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
