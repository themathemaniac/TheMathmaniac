import { create } from 'zustand';
import { apiClient } from '../api/client';
import { secureStorage } from '../storage/secure';

export interface User {
  id: string;
  name: string;
  email?: string;
  phoneNumber: string;
  role: string;
  firstLogin?: boolean;
  faculty?: string;
  school?: string;
  class?: string;
  stream?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initializeAuth: () => Promise<void>;
  login: (phoneNumber: string, password: string) => Promise<boolean>;
  register: (name: string, phoneNumber: string, password: string, role?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<boolean>;
  verifyRecoveryPassphrase: (phoneNumber: string, passphrase: string) => Promise<string | null>;
  resetPasswordWithToken: (resetToken: string, newPassword: string) => Promise<boolean>;

  // Admin Actions
  adminCreateUser: (name: string, phoneNumber: string, role: string, email?: string, stream?: string, studentClass?: string, faculty?: string, school?: string, subjects?: string) => Promise<{ temporaryPassword: string; recoveryPassphrase: string } | null>;
  adminRecoverUser: (userId: string) => Promise<{ temporaryPassword: string; recoveryPassphrase: string } | null>;
  adminDeleteUser: (userId: string) => Promise<boolean>;
  adminListUsers: (query?: string, role?: string) => Promise<any[]>;
  adminListAuditLogs: () => Promise<any[]>;
  adminListCourses: () => Promise<any[]>;
  adminEnrollStudent: (courseId: string, studentId: string) => Promise<boolean>;
  adminAssignTeacher: (courseId: string, teacherId: string) => Promise<boolean>;
  adminRemoveTeacher: (courseId: string, teacherId: string) => Promise<boolean>;
  adminCreateCourse: (data: any) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  initializeAuth: async () => {
    set({ isLoading: true });
    try {
      const accessToken = await secureStorage.getAccessToken();
      const refreshToken = await secureStorage.getRefreshToken();

      if (accessToken && refreshToken) {
        // Load cached user profile first for instant startup feedback
        const cachedUser = await secureStorage.getUser();
        if (cachedUser) {
          set({ user: cachedUser, accessToken, isAuthenticated: true });
        }

        try {
          // Fetch profile to verify session is active and sync fresh details
          const response = await apiClient.get('/profile');
          const freshUser = response.data.data.profile;
          await secureStorage.saveUser(freshUser);
          set({
            user: freshUser,
            accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (e: any) {
          console.log('Profile fetch during initialization failed:', e.message || e);
          const isAuthError = e.response && (e.response.status === 401 || e.response.status === 403);

          if (isAuthError) {
            console.log('Authentication session expired. Clearing local credentials.');
            await secureStorage.clearTokens();
            set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
          } else {
            console.log('Server is offline or network error. Retaining local cached session.');
            if (cachedUser) {
              set({
                user: cachedUser,
                accessToken,
                isAuthenticated: true,
                isLoading: false,
              });
            } else {
              set({ isLoading: false });
            }
          }
        }
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      console.error('Critical initialization error, clearing tokens:', e);
      await secureStorage.clearTokens();
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (phoneNumber, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/login', { phoneNumber, password });
      const { accessToken, refreshToken, user } = response.data.data;
      await secureStorage.saveTokens(accessToken, refreshToken);
      await secureStorage.saveUser(user);
      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || (error.request ? 'Connection failed. Please check if the backend server is running.' : error.message) || 'Failed to login';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  register: async (name, phoneNumber, password, role) => {
    set({ error: 'Registration is restricted to administrators. Please contact administration.' });
    return false;
  },

  logout: async () => {
    set({ isLoading: true });
    await secureStorage.clearTokens();
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  changePassword: async (newPassword) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post('/auth/change-password', { newPassword });
      let updatedUser: User | null = null;
      set((state) => {
        updatedUser = state.user ? { ...state.user, firstLogin: false } : null;
        return {
          user: updatedUser,
          isLoading: false,
        };
      });
      if (updatedUser) {
        await secureStorage.saveUser(updatedUser);
      }
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to change password';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  verifyRecoveryPassphrase: async (phoneNumber, passphrase) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/forgot-password/verify', { phoneNumber, passphrase });
      set({ isLoading: false });
      return response.data.data.resetToken;
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Verification failed';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  resetPasswordWithToken: async (resetToken, newPassword) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post('/auth/forgot-password/reset', { resetToken, newPassword });
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to reset password';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  // Admin Actions
  adminCreateUser: async (name, phoneNumber, role, email, stream, studentClass, faculty, school, subjects) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/admin/users', { name, phoneNumber, role, email, stream, class: studentClass, faculty, school, subjects });
      set({ isLoading: false });
      return {
        temporaryPassword: response.data.data.temporaryPassword,
        recoveryPassphrase: response.data.data.recoveryPassphrase,
      };
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to create user';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  adminRecoverUser: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post(`/admin/users/${userId}/recovery`);
      set({ isLoading: false });
      return {
        temporaryPassword: response.data.data.temporaryPassword,
        recoveryPassphrase: response.data.data.recoveryPassphrase,
      };
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to recover user';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  adminDeleteUser: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/admin/users/${userId}`);
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to delete user';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  adminListUsers: async (query, role) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get('/admin/users', {
        params: { q: query, role },
      });
      set({ isLoading: false });
      return response.data.data;
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to list users';
      set({ error: msg, isLoading: false });
      return [];
    }
  },

  adminListAuditLogs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get('/admin/audit-logs');
      set({ isLoading: false });
      return response.data.data;
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to fetch audit logs';
      set({ error: msg, isLoading: false });
      return [];
    }
  },

  adminListCourses: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get('/admin/courses');
      set({ isLoading: false });
      return response.data.data;
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to fetch courses';
      set({ error: msg, isLoading: false });
      return [];
    }
  },

  adminEnrollStudent: async (courseId, studentId) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post(`/admin/courses/${courseId}/enroll`, { studentId });
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to enroll student';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  adminAssignTeacher: async (courseId, teacherId) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post(`/admin/courses/${courseId}/teachers`, { teacherId });
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to assign teacher';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  adminRemoveTeacher: async (courseId, teacherId) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/admin/courses/${courseId}/teachers/${teacherId}`);
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to remove teacher';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  adminCreateCourse: async (data: any) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post('/admin/courses', data);
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Failed to create course';
      set({ error: msg, isLoading: false });
      return false;
    }
  },
}));
