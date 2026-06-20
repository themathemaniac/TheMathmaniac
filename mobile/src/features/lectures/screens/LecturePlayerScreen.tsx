import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { apiClient } from '../../../core/api/client';
import { Button } from '../../../shared/components/Button';
import { Skeleton } from '../../../shared/components/Skeleton';

type LecturePlayerRouteProp = RouteProp<RootStackParamList, 'LecturePlayer'>;
type LecturePlayerNavigationProp = StackNavigationProp<RootStackParamList, 'LecturePlayer'>;

interface Props {
  route: LecturePlayerRouteProp;
}

export const LecturePlayerScreen: React.FC<Props> = ({ route }) => {
  const { lectureId } = route.params;
  const navigation = useNavigation<LecturePlayerNavigationProp>();
  const [lecture, setLecture] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Playback Control States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [completed, setCompleted] = useState(false);

  // Track progress saves
  const progressTimerRef = useRef<any>(null);
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;

  const fetchLectureDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/lectures/${lectureId}`);
      const data = response.data.data;
      setLecture(data);
      setCurrentTime(data.lastPosition);
      setCompleted(data.completed);
      setIsPlaying(true); // Auto-play
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load lecture details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async (completedFlag = completed) => {
    if (!lecture) return;
    try {
      await apiClient.post(`/lectures/${lectureId}/progress`, {
        lastPosition: Math.round(currentTimeRef.current),
        completed: completedFlag,
      });
    } catch (e) {
      console.log('Error saving progress log:', e);
    }
  };

  useEffect(() => {
    fetchLectureDetails();
    return () => {
      // Cleanup progress intervals & save final status on unmount
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      saveProgress();
    };
  }, [lectureId]);

  // Periodic progress saving during active playback
  useEffect(() => {
    if (isPlaying) {
      progressTimerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1 * speed;
          if (lecture && next >= lecture.duration) {
            clearInterval(progressTimerRef.current);
            setIsPlaying(false);
            setCompleted(true);
            saveProgress(true);
            Alert.alert('Lecture Completed!', 'Good job completing this video lesson.');
            return lecture.duration;
          }
          return next;
        });
      }, 1000);
    } else {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      saveProgress();
    }

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [isPlaying, speed, lecture]);

  const handleForward10 = () => {
    setCurrentTime((prev) => {
      const next = prev + 10;
      return lecture && next >= lecture.duration ? lecture.duration : next;
    });
  };

  const handleRewind10 = () => {
    setCurrentTime((prev) => {
      const next = prev - 10;
      return next <= 0 ? 0 : next;
    });
  };

  const formatTimestamp = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleComplete = () => {
    const nextVal = !completed;
    setCompleted(nextVal);
    saveProgress(nextVal);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 px-6 pt-16">
        <Skeleton height={200} borderRadius={24} />
        <Skeleton height={30} className="mt-6" />
        <Skeleton height={150} className="mt-4" />
      </View>
    );
  }

  if (!lecture) return null;

  const progressPercentage = (currentTime / lecture.duration) * 100;

  return (
    <View className="flex-1 bg-slate-950">
      {/* 1. Video Canvas Frame */}
      <View className="bg-black w-full h-64 justify-center relative">
        {isPlaying ? (
          <View className="items-center justify-center flex-1">
            <ActivityIndicator size="small" color="#2D8C82" />
            <Text className="text-slate-400 text-xs font-semibold mt-3">
              Streaming HLS Video...
            </Text>
          </View>
        ) : (
          <View className="items-center justify-center flex-1 bg-slate-950/80">
            <Text className="text-slate-400 text-sm font-semibold">Paused</Text>
          </View>
        )}

        {/* Video Overlays */}
        <View className="absolute top-12 left-6 right-6 flex-row justify-between items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 bg-slate-900/60 rounded-full justify-center items-center border border-slate-800"
          >
            <Text className="text-white text-lg font-bold">←</Text>
          </TouchableOpacity>
          <View className="bg-slate-900/60 border border-slate-800 px-3 py-1 rounded-full">
            <Text className="text-blue-400 text-xs font-bold font-mono">1080p</Text>
          </View>
        </View>

        {/* Canvas Scrubber Bar */}
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <View className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-2">
            <View
              style={{ width: `${progressPercentage}%` }}
              className="h-full bg-blue-600 rounded-full"
            />
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-white text-xs font-mono">
              {formatTimestamp(currentTime)} / {formatTimestamp(lecture.duration)}
            </Text>
            <View className="flex-row space-x-2">
              <TouchableOpacity onPress={handleRewind10} className="px-2">
                <Text className="text-slate-400 text-xs">⏮ 10s</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsPlaying(!isPlaying)} className="px-2">
                <Text className="text-white text-xs font-bold">{isPlaying ? '⏸' : '▶'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleForward10} className="px-2">
                <Text className="text-slate-400 text-xs">10s ⏭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Speed Selector bar */}
      <View className="bg-slate-900 border-y border-slate-800 px-6 py-3 flex-row justify-between items-center">
        <Text className="text-slate-400 text-xs font-bold uppercase">Speed</Text>
        <View className="flex-row space-x-2">
          {[0.5, 1.0, 1.5, 2.0].map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSpeed(s)}
              className={`px-3 py-1.5 rounded-lg border ${
                speed === s ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700/50'
              }`}
            >
              <Text className={`text-xs font-bold ${speed === s ? 'text-white' : 'text-slate-300'}`}>
                {s}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 2. Lecture Details */}
      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-bold text-blue-400 uppercase tracking-widest">
          {lecture.courseTitle || 'Course Lecture'}
        </Text>
        <Text className="text-white text-xl font-black mt-2 leading-7">{lecture.title}</Text>
        <Text className="text-slate-400 text-xs mt-3 leading-5">{lecture.description}</Text>

        {/* Resources Cards */}
        <View className="mt-8 space-y-4">
          {lecture.notesUrl && (
            <View className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-row justify-between items-center">
              <View className="flex-1 mr-3">
                <Text className="text-white text-sm font-bold">Lecture Notes PDF</Text>
                <Text className="text-slate-400 text-xs mt-1">Download formula booklet for this topic</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('PDFViewer', {
                    fileUrl: lecture.notesUrl,
                    title: `${lecture.title} Notes`,
                  })
                }
                className="bg-blue-600/20 border border-blue-500/20 px-4 py-2 rounded-xl"
              >
                <Text className="text-blue-400 font-bold text-xs">View PDF</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Chapters and Timestamps */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mt-4">
            <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-4">
              📌 Lesson Chapters
            </Text>
            <TouchableOpacity
              onPress={() => setCurrentTime(0)}
              className="flex-row justify-between py-2 border-b border-slate-800"
            >
              <Text className="text-slate-300 text-xs">00:00 - Introduction & Prerequisites</Text>
              <Text className="text-blue-400 text-xs">Jump</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCurrentTime(lecture.duration * 0.4)}
              className="flex-row justify-between py-2 border-b border-slate-800"
            >
              <Text className="text-slate-300 text-xs">06:00 - Core Concept Explanation</Text>
              <Text className="text-blue-400 text-xs">Jump</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCurrentTime(lecture.duration * 0.75)}
              className="flex-row justify-between py-2"
            >
              <Text className="text-slate-300 text-xs">11:15 - Worked IIT-JEE Examples</Text>
              <Text className="text-blue-400 text-xs">Jump</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-8 flex-row space-x-4">
          <Button
            title={completed ? 'Mark Incomplete' : 'Mark Lesson Completed'}
            onPress={toggleComplete}
            variant={completed ? 'outline' : 'secondary'}
            className="flex-1"
          />
        </View>
        <View className="h-16" />
      </ScrollView>
    </View>
  );
};
