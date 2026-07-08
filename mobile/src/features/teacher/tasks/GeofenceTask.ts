import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { secureStorage } from '../../../core/storage/secure';

export const GEOFENCE_LOCATION_TASK = 'background-geofence-task';

TaskManager.defineTask(GEOFENCE_LOCATION_TASK, async (args: any) => {
  const { data, error } = args;
  if (error) {
    console.error('Background Geofence Error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as any;
    if (locations && locations.length > 0) {
      const location = locations[0];
      const { latitude, longitude } = location.coords;
      
      try {
        const token = await secureStorage.getAccessToken();
        const scheduleId = await secureStorage.getGeofenceScheduleId();
        
        if (!token || !scheduleId) {
          console.log('Background Geofence: Missing token or scheduleId');
          return;
        }

        // Silent ping to the server
        const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mathapi.synapseedutech.com/api';
        
        await fetch(`${API_URL}/attendance/teacher/ping`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            latitude,
            longitude,
            scheduleId
          })
        });
        
        console.log(`Background Ping Successful: ${latitude}, ${longitude}`);
      } catch (e) {
        console.error('Background Geofence Ping Failed:', e);
      }
    }
  }
});
