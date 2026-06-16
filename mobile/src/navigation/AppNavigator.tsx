import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text } from 'react-native';

import { RootStackParamList, AppTabsParamList } from './types';
import { useAuthStore } from '../core/store/auth';

// Screens imports
import { SplashScreen } from '../features/authentication/screens/SplashScreen';
import { OnboardingScreen } from '../features/authentication/screens/OnboardingScreen';
import { LoginScreen } from '../features/authentication/screens/LoginScreen';
import { SignupScreen } from '../features/authentication/screens/SignupScreen';
import { OTPVerificationScreen } from '../features/authentication/screens/OTPVerificationScreen';
import { HomeScreen } from '../features/home/screens/HomeScreen';
import { CoursesExploreScreen } from '../features/courses/screens/CoursesExploreScreen';
import { CourseDetailsScreen } from '../features/courses/screens/CourseDetailsScreen';
import { PurchaseWebviewScreen } from '../features/courses/screens/PurchaseWebviewScreen';
import { LecturePlayerScreen } from '../features/lectures/screens/LecturePlayerScreen';
import { MaterialsListScreen } from '../features/materials/screens/MaterialsListScreen';
import { PDFViewerScreen } from '../features/materials/screens/PDFViewerScreen';
import { TestsListScreen } from '../features/tests/screens/TestsListScreen';
import { TestInstructionsScreen } from '../features/tests/screens/TestInstructionsScreen';
import { ActiveTestScreen } from '../features/tests/screens/ActiveTestScreen';
import { TestResultScreen } from '../features/tests/screens/TestResultScreen';
import { ProfileHomeScreen } from '../features/profile/screens/ProfileHomeScreen';

// Teacher Screens imports
import { TeacherHomeScreen } from '../features/teacher/screens/TeacherHomeScreen';
import { TeacherCoursesScreen } from '../features/teacher/screens/TeacherCoursesScreen';
import { TeacherTestsScreen } from '../features/teacher/screens/TeacherTestsScreen';
import { TeacherMaterialsScreen } from '../features/teacher/screens/TeacherMaterialsScreen';
import { TeacherProfileScreen } from '../features/teacher/screens/TeacherProfileScreen';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<AppTabsParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#F5F2EA', // Synapse light card bg
          borderTopWidth: 1,
          borderTopColor: 'rgba(160, 140, 85, 0.26)', // Synapse border
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: '#8A2222', // Warm and soothing red/maroon
        tabBarInactiveTintColor: '#6A6050', // Synapse muted text
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused }) => {
          let icon = '';
          if (route.name === 'Home') icon = '⚡';
          if (route.name === 'Courses') icon = '📚';
          if (route.name === 'Tests') icon = '✏️';
          if (route.name === 'Materials') icon = '📁';
          if (route.name === 'Profile') icon = '👤';

          return (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: focused ? 'rgba(138, 34, 34, 0.12)' : 'transparent',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 18 }}>{icon}</Text>
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Courses" component={CoursesExploreScreen} />
      <Tab.Screen name="Tests" component={TestsListScreen} />
      <Tab.Screen name="Materials" component={MaterialsListScreen} />
      <Tab.Screen name="Profile" component={ProfileHomeScreen} />
    </Tab.Navigator>
  );
}

function TeacherTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#F5F2EA', // Synapse light card bg
          borderTopWidth: 1,
          borderTopColor: 'rgba(160, 140, 85, 0.26)', // Synapse border
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: '#8A2222', // Warm and soothing red/maroon
        tabBarInactiveTintColor: '#6A6050', // Synapse muted text
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused }) => {
          let icon = '';
          if (route.name === 'Home') icon = '⚡';
          if (route.name === 'Courses') icon = '📚';
          if (route.name === 'Tests') icon = '✏️';
          if (route.name === 'Materials') icon = '📁';
          if (route.name === 'Profile') icon = '👤';

          return (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: focused ? 'rgba(138, 34, 34, 0.12)' : 'transparent',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 18 }}>{icon}</Text>
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={TeacherHomeScreen} />
      <Tab.Screen name="Courses" component={TeacherCoursesScreen} />
      <Tab.Screen name="Tests" component={TeacherTestsScreen} />
      <Tab.Screen name="Materials" component={TeacherMaterialsScreen} />
      <Tab.Screen name="Profile" component={TeacherProfileScreen} />
    </Tab.Navigator>
  );
}

function AppTabsWrapper() {
  const { user } = useAuthStore();
  if (user?.role === 'TEACHER') {
    return <TeacherTabNavigator />;
  }
  return <TabNavigator />;
}

export const AppNavigator = () => {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#EDEAE0' },
        }}
        initialRouteName="Splash"
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
        <Stack.Screen name="AppTabs" component={AppTabsWrapper} />
        <Stack.Screen name="CourseDetails" component={CourseDetailsScreen} />
        <Stack.Screen name="PurchaseWebview" component={PurchaseWebviewScreen} />
        <Stack.Screen name="LecturePlayer" component={LecturePlayerScreen} />
        <Stack.Screen name="PDFViewer" component={PDFViewerScreen} />
        <Stack.Screen name="TestInstructions" component={TestInstructionsScreen} />
        <Stack.Screen name="ActiveTest" component={ActiveTestScreen} />
        <Stack.Screen name="TestResult" component={TestResultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
