import { create } from 'zustand';
import { apiClient } from '../api/client';
import { secureStorage } from '../storage/secure';

export interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initializeAuth: () => Promise<void>;
  sendOtp: (phoneNumber: string) => Promise<boolean>;
  verifyOtp: (phoneNumber: string, code: string, name?: string, role?: string) => Promise<boolean>;
  loginWithEmail: (email: string, password: string, role?: string) => Promise<boolean>;
  loginWithGoogle: (email: string, name: string, googleId: string) => Promise<boolean>;
  signupWithEmail: (name: string, email: string, phoneNumber: string, password: string, role?: string) => Promise<boolean>;
  logout: () => Promise<void>;
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
        // Fetch profile to verify session is active
        const response = await apiClient.get('/profile');
        set({
          user: response.data.data.profile,
          accessToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      console.log('Auto login failed, credentials expired or offline.');
      await secureStorage.clearTokens();
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
    }
  },

  sendOtp: async (phoneNumber: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post('/auth/otp/send', { phoneNumber });
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || (error.request ? 'Connection failed. Please check if the backend server is running.' : error.message) || 'Failed to send OTP';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  verifyOtp: async (phoneNumber: string, code: string, name?: string, role?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/otp/verify', { phoneNumber, code, name, role });
      const { accessToken, refreshToken, user } = response.data.data;
      await secureStorage.saveTokens(accessToken, refreshToken);

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || (error.request ? 'Connection failed. Please check if the backend server is running.' : error.message) || 'Failed to verify OTP';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  loginWithEmail: async (email: string, password: string, role?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/login', { email, password, role });
      const { accessToken, refreshToken, user } = response.data.data;
      await secureStorage.saveTokens(accessToken, refreshToken);

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || (error.request ? 'Connection failed. Please check if the backend server is running.' : error.message) || 'Invalid email or password';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  loginWithGoogle: async (email: string, name: string, googleId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/google', { email, name, googleId });
      const { accessToken, refreshToken, user } = response.data.data;
      await secureStorage.saveTokens(accessToken, refreshToken);

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || (error.request ? 'Connection failed. Please check if the backend server is running.' : error.message) || 'Google Login failed';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  signupWithEmail: async (name: string, email: string, phoneNumber: string, password: string, role?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/signup', { name, email, phoneNumber, password, role });
      const { accessToken, refreshToken, user } = response.data.data;
      await secureStorage.saveTokens(accessToken, refreshToken);

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error || (error.request ? 'Connection failed. Please check if the backend server is running.' : error.message) || 'Registration failed';
      set({ error: msg, isLoading: false });
      return false;
    }
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
}));
