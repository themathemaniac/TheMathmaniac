import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'mathemaniac_access_token';
const REFRESH_TOKEN_KEY = 'mathemaniac_refresh_token';
const USER_KEY = 'mathemaniac_user_profile';

export const secureStorage = {
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } catch (error) {
      console.error('Error saving secure tokens:', error);
    }
  },

  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('Error reading access token:', error);
      return null;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error reading refresh token:', error);
      return null;
    }
  },

  async saveUser(user: any): Promise<void> {
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error saving secure user:', error);
    }
  },

  async getUser(): Promise<any | null> {
    try {
      const uStr = await SecureStore.getItemAsync(USER_KEY);
      return uStr ? JSON.parse(uStr) : null;
    } catch (error) {
      console.error('Error reading user profile:', error);
      return null;
    }
  },

  async clearTokens(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (error) {
      console.error('Error clearing secure tokens:', error);
    }
  },

  async saveGeofenceScheduleId(id: string): Promise<void> {
    try {
      await SecureStore.setItemAsync('geofence_schedule_id', id);
    } catch (e) {
      console.error('Error saving geofence id:', e);
    }
  },

  async getGeofenceScheduleId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('geofence_schedule_id');
    } catch (e) {
      console.error('Error getting geofence id:', e);
      return null;
    }
  }
};
