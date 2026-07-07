import { NavigatorScreenParams } from '@react-navigation/native';

export type AppTabsParamList = {
  Home: undefined;
  Courses: undefined;
  Tests: undefined;
  Materials: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ForgotPasswordReset: { resetToken: string };
  MandatoryChangePassword: undefined;
  ChangePassword: undefined;
  AdminPanel: undefined;
  AppTabs: NavigatorScreenParams<AppTabsParamList>;
  CourseDetails: { courseId: string; initialTab?: 'VIDEOS' | 'MATERIALS' | 'NOTICES' };
  LecturePlayer: { lectureId: string };
  PDFViewer: { fileUrl: string; title: string };
  TestInstructions: { testId: string };
  ActiveTest: { testId: string };
  TestResult: { resultData: any };
  FeePayment: undefined;
  TeacherAttendanceTracking: undefined;
  SuperuserReports: undefined;
  TeacherCourseDetails: { courseId: string; courseTitle: string; };
  TeacherPayments: undefined;
  AdminAttendance: undefined;
};
