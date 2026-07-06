import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text } from 'react-native';

import { RootStackParamList, AppTabsParamList } from './types';
import { useAuthStore } from '../core/store/auth';

// Screens imports
import { SplashScreen } from '../features/authentication/screens/SplashScreen';
import { LoginScreen } from '../features/authentication/screens/LoginScreen';
import { SignupScreen } from '../features/authentication/screens/SignupScreen';
import { ForgotPasswordScreen } from '../features/authentication/screens/ForgotPasswordScreen';
import { ForgotPasswordResetScreen } from '../features/authentication/screens/ForgotPasswordResetScreen';
import { MandatoryChangePasswordScreen } from '../features/authentication/screens/MandatoryChangePasswordScreen';
import { ChangePasswordScreen } from '../features/profile/screens/ChangePasswordScreen';
import { AdminPanelScreen } from '../features/admin/screens/AdminPanelScreen';
import { AdminAttendanceScreen } from '../features/admin/screens/AdminAttendanceScreen';
import { HomeScreen } from '../features/home/screens/HomeScreen';
import { CoursesExploreScreen } from '../features/courses/screens/CoursesExploreScreen';
import { CourseDetailsScreen } from '../features/courses/screens/CourseDetailsScreen';
import { LecturePlayerScreen } from '../features/lectures/screens/LecturePlayerScreen';
import { MaterialsListScreen } from '../features/materials/screens/MaterialsListScreen';
import { PDFViewerScreen } from '../features/materials/screens/PDFViewerScreen';
import { TestsListScreen } from '../features/tests/screens/TestsListScreen';
import { TestInstructionsScreen } from '../features/tests/screens/TestInstructionsScreen';
import { ActiveTestScreen } from '../features/tests/screens/ActiveTestScreen';
import { TestResultScreen } from '../features/tests/screens/TestResultScreen';
import { ProfileHomeScreen } from '../features/profile/screens/ProfileHomeScreen';
import { FeePaymentScreen } from '../features/profile/screens/FeePaymentScreen';

// Teacher Screens imports
import { TeacherHomeScreen } from '../features/teacher/screens/TeacherHomeScreen';
import { TeacherCoursesScreen } from '../features/teacher/screens/TeacherCoursesScreen';
import { TeacherTestsScreen } from '../features/teacher/screens/TeacherTestsScreen';
import { TeacherMaterialsScreen } from '../features/teacher/screens/TeacherMaterialsScreen';
import { TeacherProfileScreen } from '../features/teacher/screens/TeacherProfileScreen';
import { TeacherAttendanceScreen } from '../features/teacher/screens/TeacherAttendanceScreen';
import { SuperuserReportsScreen } from '../features/teacher/screens/SuperuserReportsScreen';
import { TeacherCourseDetailsScreen } from '../features/teacher/screens/TeacherCourseDetailsScreen';
import { TeacherPaymentsScreen } from '../features/teacher/screens/TeacherPaymentsScreen';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<AppTabsParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF', // Pure White surface
          borderTopWidth: 1,
          borderTopColor: 'rgba(45, 140, 130, 0.15)', // Subtle Ocean Teal border
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: '#2D8C82', // Ocean Teal primary
        tabBarInactiveTintColor: '#6B7280', // Secondary text grey
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
                backgroundColor: focused ? 'rgba(45, 140, 130, 0.12)' : 'transparent',
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
          backgroundColor: '#FFFFFF', // Pure White surface
          borderTopWidth: 1,
          borderTopColor: 'rgba(45, 140, 130, 0.15)', // Subtle Ocean Teal border
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: '#2D8C82', // Ocean Teal primary
        tabBarInactiveTintColor: '#6B7280', // Secondary text grey
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
                backgroundColor: focused ? 'rgba(45, 140, 130, 0.12)' : 'transparent',
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
  if (user?.role === 'ADMIN') {
    const isSuperuser = user?.phoneNumber && ['+917980357754', '+919831754957'].includes(user.phoneNumber);
    if (isSuperuser) {
      return <AdminPanelScreen />;
    } else {
      return <AdminAttendanceScreen />;
    }
  }
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
          cardStyle: { backgroundColor: '#FAFBF8' },
        }}
        initialRouteName="Splash"
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ForgotPasswordReset" component={ForgotPasswordResetScreen} />
        <Stack.Screen name="MandatoryChangePassword" component={MandatoryChangePasswordScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
        <Stack.Screen name="AppTabs" component={AppTabsWrapper} />
        <Stack.Screen name="CourseDetails" component={CourseDetailsScreen} />
        <Stack.Screen name="LecturePlayer" component={LecturePlayerScreen} />
        <Stack.Screen name="PDFViewer" component={PDFViewerScreen} />
        <Stack.Screen name="TestInstructions" component={TestInstructionsScreen} />
        <Stack.Screen name="ActiveTest" component={ActiveTestScreen} />
        <Stack.Screen name="TestResult" component={TestResultScreen} />
        <Stack.Screen name="TeacherAttendanceTracking" component={TeacherAttendanceScreen} />
        <Stack.Screen name="SuperuserReports" component={SuperuserReportsScreen} />
        <Stack.Screen name="TeacherCourseDetails" component={TeacherCourseDetailsScreen} />
        <Stack.Screen name="TeacherPayments" component={TeacherPaymentsScreen} />
        <Stack.Screen name="FeePayment" component={FeePaymentScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
