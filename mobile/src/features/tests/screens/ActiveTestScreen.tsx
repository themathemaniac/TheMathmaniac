import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, BackHandler } from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { apiClient } from '../../../core/api/client';
import { useActiveTestStore } from '../../../core/store/activeTest';
import { Button } from '../../../shared/components/Button';
import { Skeleton } from '../../../shared/components/Skeleton';
import { MathRenderer, hasMathExpressions } from '../../../shared/components/MathRenderer';

type ActiveTestRouteProp = RouteProp<RootStackParamList, 'ActiveTest'>;
type ActiveTestNavigationProp = StackNavigationProp<RootStackParamList, 'ActiveTest'>;

interface Props {
  route: ActiveTestRouteProp;
}

export const ActiveTestScreen: React.FC<Props> = ({ route }) => {
  const { testId } = route.params;
  const navigation = useNavigation<ActiveTestNavigationProp>();
  const [test, setTest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const {
    timeLeft,
    answers,
    isTestActive,
    selectSingleOption,
    selectMultipleOptions,
    setNumericalAnswer,
    tickTimer,
    submitTestLocal,
    clearTest,
  } = useActiveTestStore();

  // Prevent back button exits
  useEffect(() => {
    const backAction = () => {
      Alert.alert('Active Exam', 'Are you sure you want to exit? Your answers will be submitted immediately.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Submit', onPress: () => handleFinalSubmit() },
      ]);
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [test]);

  // Retrieve safe questions list
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/tests/${testId}`);
        setTest(response.data.data);
      } catch (e) {
        Alert.alert('Error', 'Failed to retrieve test questions.');
        navigation.replace('AppTabs', { screen: 'Tests' });
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [testId]);

  // Countdown timer trigger
  useEffect(() => {
    let interval: any;
    if (isTestActive && !loading) {
      interval = setInterval(() => {
        tickTimer();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTestActive, loading]);

  // Auto-submit on timer end
  useEffect(() => {
    if (timeLeft === 0 && isTestActive && !loading) {
      Alert.alert('Time Expired', 'Your exam session has run out of time. Answers are submitting now.', [
        { text: 'OK', onPress: () => handleFinalSubmit() },
      ]);
    }
  }, [timeLeft]);

  const handleFinalSubmit = async () => {
    if (!test || submitting) return;
    try {
      setSubmitting(true);
      const userAnswersList = submitTestLocal(); // Array of AnswerItem
      const response = await apiClient.post(`/tests/${testId}/submit`, {
        answers: userAnswersList,
      });

      clearTest();
      navigation.replace('TestResult', { resultData: response.data.data });
    } catch (e) {
      Alert.alert('Submission Error', 'Failed to submit answers. Check your internet connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < test.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 px-6 pt-16">
        <Skeleton height={40} className="mb-6" />
        <Skeleton height={200} borderRadius={24} />
      </View>
    );
  }

  if (!test) return null;

  const currentQuestion = test.questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id];

  return (
    <View className="flex-1 bg-slate-950">
      {/* 1. Timer / Header Bar */}
      <View className="bg-slate-900 border-b border-slate-800/80 px-6 pt-14 pb-4 flex-row justify-between items-center">
        <Text className="text-slate-100 text-sm font-bold">
          Q {currentIndex + 1} of {test.questions.length}
        </Text>
        <View className="bg-blue-600/20 border border-blue-500/20 px-4 py-1.5 rounded-full">
          <Text className="text-blue-400 font-bold text-xs font-mono">
            ⏱ {formatTimer(timeLeft)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            Alert.alert('Submit Exam', 'Are you sure you want to end and submit the test?', [
              { text: 'Resume Test' },
              { text: 'Yes, Submit', onPress: handleFinalSubmit },
            ])
          }
          className="bg-emerald-500 px-4 py-1.5 rounded-full"
        >
          <Text className="text-slate-950 font-bold text-xs">SUBMIT</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Questions Canvas */}
      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        {/* Question Score Tag */}
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest bg-slate-900 px-3 py-1 border border-slate-800 rounded-lg">
            {currentQuestion.type.replace('_', ' ')}
          </Text>
          <Text className="text-slate-400 text-xs font-semibold">+{currentQuestion.marks} Marks</Text>
        </View>

        {/* Question Text */}
        {hasMathExpressions(currentQuestion.text) ? (
          <MathRenderer
            text={currentQuestion.text}
            isDarkText={true}
            style={{ marginTop: 16 }}
          />
        ) : (
          <Text className="text-slate-100 text-base font-medium leading-7 mt-4">
            {currentQuestion.text}
          </Text>
        )}

        {/* 3. Answers Inputs depending on Type */}
        <View className="mt-8">
          {currentQuestion.type === 'SINGLE_CORRECT' &&
            currentQuestion.options.map((opt: any) => {
              const isSelected = currentAnswer?.optionId === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => selectSingleOption(currentQuestion.id, opt.id)}
                  className={`border rounded-2xl p-4 mb-3 flex-row items-center ${
                    isSelected ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full border mr-3 justify-center items-center ${
                      isSelected ? 'border-blue-500 bg-blue-600' : 'border-slate-600'
                    }`}
                  >
                    {isSelected && <View className="w-2 h-2 rounded-full bg-white" />}
                  </View>
                  <Text className="text-slate-200 text-sm font-semibold flex-1">{opt.text}</Text>
                </TouchableOpacity>
              );
            })}

          {currentQuestion.type === 'MULTIPLE_CORRECT' &&
            currentQuestion.options.map((opt: any) => {
              const selectedIds = currentAnswer?.optionIds || [];
              const isSelected = selectedIds.includes(opt.id);

              const handleMultiSelect = () => {
                if (isSelected) {
                  selectMultipleOptions(
                    currentQuestion.id,
                    selectedIds.filter((id) => id !== opt.id)
                  );
                } else {
                  selectMultipleOptions(currentQuestion.id, [...selectedIds, opt.id]);
                }
              };

              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={handleMultiSelect}
                  className={`border rounded-2xl p-4 mb-3 flex-row items-center ${
                    isSelected ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-md border mr-3 justify-center items-center ${
                      isSelected ? 'border-blue-500 bg-blue-600' : 'border-slate-600'
                    }`}
                  >
                    {isSelected && <Text className="text-white text-[10px] font-black">✓</Text>}
                  </View>
                  <Text className="text-slate-200 text-sm font-semibold flex-1">{opt.text}</Text>
                </TouchableOpacity>
              );
            })}

          {currentQuestion.type === 'NUMERICAL' && (
            <View>
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
                Integer / Numeric Answer
              </Text>
              <TextInput
                className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4 text-slate-300 text-lg font-black text-center"
                placeholder="Type numeric answer here"
                placeholderTextColor="#8A8070"
                keyboardType="numeric"
                value={currentAnswer?.numericalAnswer || ''}
                onChangeText={(val) => setNumericalAnswer(currentQuestion.id, val)}
              />
            </View>
          )}
        </View>
        <View className="h-24" />
      </ScrollView>

      {/* 4. Navigator Bottom Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-6 py-5 flex-row justify-between">
        <Button
          title="Previous"
          onPress={handlePrev}
          disabled={currentIndex === 0}
          variant="outline"
          className="flex-1 mr-4"
        />
        <Button
          title={currentIndex === test.questions.length - 1 ? 'Submit' : 'Next'}
          onPress={currentIndex === test.questions.length - 1 ? handleFinalSubmit : handleNext}
          loading={submitting}
          variant={currentIndex === test.questions.length - 1 ? 'secondary' : 'primary'}
          className="flex-1"
        />
      </View>
    </View>
  );
};
