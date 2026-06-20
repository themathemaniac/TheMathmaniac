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
  AdminPanel: undefined;
  AppTabs: NavigatorScreenParams<AppTabsParamList>;
  CourseDetails: { courseId: string };
  PurchaseWebview: { courseId: string; amount: number; orderId: string; title: string };
  LecturePlayer: { lectureId: string };
  PDFViewer: { fileUrl: string; title: string };
  TestInstructions: { testId: string };
  ActiveTest: { testId: string };
  TestResult: { resultData: any };
};
