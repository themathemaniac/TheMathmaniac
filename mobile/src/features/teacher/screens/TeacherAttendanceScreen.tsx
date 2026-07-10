import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { apiClient } from '../../../core/api/client';
import { useAuthStore } from '../../../core/store/auth';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

// Set notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type TeacherAttendanceNavigationProp = StackNavigationProp<RootStackParamList, 'TeacherAttendanceTracking'>;

interface ScheduleRecord {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  class?: string;
  subject?: string;
  user?: {
    name: string;
  };
  campus: string;
  campusCoords?: {
    lat: number;
    lon: number;
  };
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'PARTIAL' | 'ABSENT';
  presenceRatio: number;
  totalPings: number;
  insidePings: number;
  schedule: {
    title: string;
  };
}

interface PingLogItem {
  timestamp: string;
  distance: number;
  isInside: boolean;
  success: boolean;
  coords: string;
}

export const GEOFENCE_LOCATION_TASK = 'background-geofence-task';

export const TeacherAttendanceScreen: React.FC = () => {
  const navigation = useNavigation<TeacherAttendanceNavigationProp>();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [activeSchedule, setActiveSchedule] = useState<ScheduleRecord | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<boolean | null>(null);
  
  // Location States (Real GPS only, 15m radius)
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isInside, setIsInside] = useState<boolean | null>(null);
  
  // Logging States (5-15 mins for teachers, 30-90 mins for admins)
  const [isLogging, setIsLogging] = useState(false);
  const [loggedPings, setLoggedPings] = useState<PingLogItem[]>([]);
  const [pingStats, setPingStats] = useState({ total: 0, inside: 0 });
  const [checkoutVerdict, setCheckoutVerdict] = useState<AttendanceRecord | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingRef = useRef(false);

  // Constants (Fallback to Madhyamgram if schedule coords missing)
  const FALLBACK_LAT = 22.693230336542225;
  const FALLBACK_LON = 88.45923267330267;
  const GEOFENCE_RADIUS_METERS = 15;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // in meters
  };

  const fetchSchedulesAndHistory = async () => {
    try {
      let trackingScheduleId: string | null = null;
      try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(GEOFENCE_LOCATION_TASK);
        if (hasStarted) {
          const { secureStorage } = require('../../../core/storage/secure');
          trackingScheduleId = await secureStorage.getGeofenceScheduleId();
          setIsLogging(true);
        } else {
          setIsLogging(false);
        }
      } catch(e) { console.log('Location status check error:', e); }

      const scheduleRes = await apiClient.get('/attendance/teacher/schedule');
      if (scheduleRes.data.success) {
        const fetchedSchedules = scheduleRes.data.data;
        if (fetchedSchedules.length > 0) {
          const localDate = new Date();
          const year = localDate.getFullYear();
          const month = String(localDate.getMonth() + 1).padStart(2, '0');
          const day = String(localDate.getDate()).padStart(2, '0');
          const localDateStr = `${year}-${month}-${day}`;
          
          let todaysSchedules = fetchedSchedules.filter((s: any) => s.date === localDateStr);
          const otherSchedules = fetchedSchedules.filter((s: any) => s.date !== localDateStr);
          
          otherSchedules.sort((a: any, b: any) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startTime.localeCompare(b.startTime);
          });
          
          if (todaysSchedules.length > 0) {
            const currentTimeStr = `${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(2, '0')}`;
            
            // Sort by start time
            todaysSchedules.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
            
            let activeIdxToUse = 0;
            if (trackingScheduleId) {
               const trackedIndex = todaysSchedules.findIndex((s: any) => s.id === trackingScheduleId);
               if (trackedIndex !== -1) activeIdxToUse = trackedIndex;
            } else {
               const activeIndex = todaysSchedules.findIndex((s: any) => s.endTime >= currentTimeStr);
               if (activeIndex !== -1) activeIdxToUse = activeIndex;
            }

            const activeCourse = todaysSchedules[activeIdxToUse];
            
            // Hoist to top
            todaysSchedules.splice(activeIdxToUse, 1);
            todaysSchedules.unshift(activeCourse);
            
            setActiveSchedule(activeCourse);
            setSchedules([...todaysSchedules, ...otherSchedules]);
          } else {
            setActiveSchedule(otherSchedules.length > 0 ? otherSchedules[0] : null);
            setSchedules(otherSchedules);
          }
        } else {
          setSchedules([]);
        }
      }

      const historyRes = await apiClient.get('/attendance/teacher/attendance');
      if (historyRes.data.success) {
        setHistory(historyRes.data.data);
      }
    } catch (e: any) {
      console.log('Error pulling schedule & history:', e);
      Alert.alert('Error', 'Unable to retrieve schedule or attendance history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPermissions();
    fetchSchedulesAndHistory();
    // Intentionally omitting stopLogging() from cleanup so background task persists when component unmounts
  }, []);

  // Update isLoggingRef whenever isLogging state changes
  useEffect(() => {
    isLoggingRef.current = isLogging;
  }, [isLogging]);

  const checkPermissions = async () => {
    try {
      const { status: locStatus } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(locStatus === 'granted');

      const { status: notifStatus } = await Notifications.getPermissionsAsync();
      setNotificationPermission(notifStatus === 'granted');
    } catch (e) {
      console.log('Error checking permissions:', e);
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(locStatus === 'granted');

      const { status: notifStatus } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(notifStatus === 'granted');

      return locStatus === 'granted';
    } catch (e) {
      console.log('Error requesting permissions:', e);
      return false;
    }
  };

  // Trigger Local Notification for Active GPS Tracking
  const triggerNotification = async () => {
    try {
      const hasPermission = notificationPermission || (await Notifications.getPermissionsAsync()).status === 'granted';
      if (hasPermission) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: isAdmin ? '📍 Shift Tracking In Progress' : '📍 GPS Tracking In Progress',
            body: isAdmin 
              ? 'Duty shift tracking is active. Keep location enabled during your shift.'
              : 'Attendance tracking is active. Keep location enabled during your class session.',
            sound: true,
          },
          trigger: null,
        });
      }
    } catch (e) {
      console.log('Failed to trigger OS notification:', e);
    }
  };

  // Perform a single location ping to server
  const sendLocationPing = async () => {
    if (!activeSchedule) return;

    try {
      const hasPerm = locationPermission || await requestPermissions();
      if (!hasPerm) {
        Alert.alert('GPS Permission Required', 'Please enable location permissions in your settings.');
        stopLogging();
        return;
      }

      // Fetch high accuracy real position
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;
      setCurrentCoords({ latitude, longitude });

      const targetLat = activeSchedule.campusCoords?.lat ?? FALLBACK_LAT;
      const targetLon = activeSchedule.campusCoords?.lon ?? FALLBACK_LON;

      const dist = calculateDistance(latitude, longitude, targetLat, targetLon);
      const inside = dist <= GEOFENCE_RADIUS_METERS;
      setDistance(dist);
      setIsInside(inside);

      const response = await apiClient.post('/attendance/teacher/ping', {
        latitude,
        longitude,
        scheduleId: activeSchedule.id,
      });

      if (response.data.success) {
        const serverData = response.data.data;
        setLoggedPings(prev => [
          {
            timestamp: new Date().toLocaleTimeString(),
            distance: serverData.distance,
            isInside: serverData.isInside,
            success: true,
            coords: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          },
          ...prev
        ]);

        setPingStats(prev => ({
          total: prev.total + 1,
          inside: prev.inside + (serverData.isInside ? 1 : 0),
        }));
      }
    } catch (e: any) {
      console.log('Ping request error:', e);
      setLoggedPings(prev => [
        {
          timestamp: new Date().toLocaleTimeString(),
          distance: 0,
          isInside: false,
          success: false,
          coords: 'GPS / Server Timeout',
        },
        ...prev
      ]);
    }
  };
  // We use Background Location API for teachers instead of setTimeout
  const startLogging = async () => {
    if (!activeSchedule) {
      Alert.alert('No Schedule', 'Please select or generate a class schedule first.');
      return;
    }

    const hasPerm = locationPermission || await requestPermissions();
    if (!hasPerm) {
      Alert.alert('GPS Permission Required', 'This system requires physical GPS coordinates to verify attendance.');
      return;
    }
    
    // For iOS, check background permission
    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
       await Location.requestBackgroundPermissionsAsync();
    }

    setLoggedPings([]);
    setPingStats({ total: 0, inside: 0 });
    setCheckoutVerdict(null);
    setIsLogging(true);
    isLoggingRef.current = true;
    
    // Save schedule ID securely for headless task
    const { secureStorage } = require('../../../core/storage/secure');
    await secureStorage.saveGeofenceScheduleId(activeSchedule.id);

    // Run first ping immediately in foreground
    await sendLocationPing();

    // Start background tracking for teachers
    if (!isAdmin) {
      try {
        await Location.startLocationUpdatesAsync(GEOFENCE_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 35 * 60 * 1000, // Roughly every 35 mins
          distanceInterval: 10,
          deferredUpdatesInterval: 35 * 60 * 1000,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "📍 GPS Tracking Active",
            notificationBody: "Your location is being tracked for duty attendance. Do not swipe away.",
            notificationColor: "#2D8C82"
          }
        });
      } catch (e) {
        console.error('Failed to start background tracking:', e);
      }
    } else {
      console.log('Admin session started: Background GPS pinging is disabled to save battery.');
    }
  };

  const stopLogging = async () => {
    setIsLogging(false);
    isLoggingRef.current = false;
    
    try {
       const hasStarted = await Location.hasStartedLocationUpdatesAsync(GEOFENCE_LOCATION_TASK);
       if (hasStarted) {
         await Location.stopLocationUpdatesAsync(GEOFENCE_LOCATION_TASK);
       }
    } catch(e) {}
  };

  const handleCheckout = async () => {
    if (!activeSchedule) return;

    Alert.alert(
      isAdmin ? 'Complete Shift' : 'Complete Session',
      isAdmin
        ? 'Are you sure you want to clock out of your shift? This will finalize your shift attendance status based on randomized checks.'
        : 'Are you sure you want to check out? This will finalize your attendance status for this class based on randomized checks.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Checkout',
          onPress: async () => {
            stopLogging();
            setLoading(true);
            try {
              const res = await apiClient.post('/attendance/teacher/checkout', {
                scheduleId: activeSchedule.id,
              });
              if (res.data.success) {
                setCheckoutVerdict(res.data.data.attendance);
                Alert.alert(
                  'Checked Out Successfully',
                  `Your attendance is recorded as ${res.data.data.attendance.status} (${(res.data.data.attendance.presenceRatio * 100).toFixed(1)}% presence)`
                );
                await fetchSchedulesAndHistory();
              }
            } catch (err: any) {
              console.log('Checkout error:', err);
              Alert.alert('Checkout Failed', err.response?.data?.error || 'Unable to record attendance checkout.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getVerdictColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'PARTIAL': return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      case 'ABSENT': return 'text-red-400 bg-red-500/10 border-red-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSchedulesAndHistory();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      {/* Custom Header */}
      <View className="flex-row items-center justify-between mb-6">
        <TouchableOpacity
          onPress={() => {
            stopLogging();
            navigation.goBack();
          }}
          className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-full justify-center items-center active:bg-slate-800"
        >
          <Text className="text-slate-100 text-sm font-bold">◀</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-lg font-black">Geotagged Attendance</Text>
        <View className="w-10" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D8C82" />}
      >
        {loading ? (
          <View className="flex-1 justify-center items-center py-20">
            <ActivityIndicator size="large" color="#2D8C82" />
            <Text className="text-slate-400 text-xs mt-3 font-semibold">Updating attendance panel...</Text>
          </View>
        ) : (
          <View className="pb-24">
            
            {/* Active Schedule Card */}
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5">
              <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider mb-2">
                {isAdmin ? 'Active Shift / Session' : 'Active Class / Session'}
              </Text>
              
              {activeSchedule ? (
                <View>
                  <Text className="text-slate-100 text-base font-black">
                    {activeSchedule.title}
                  </Text>
                  
                  {activeSchedule.user && (
                    <Text className="text-slate-300 text-xs mt-1.5 font-bold">
                      👨‍🏫 Teacher: {activeSchedule.user.name}
                    </Text>
                  )}
                  
                  {activeSchedule.class && (
                    <Text className="text-slate-300 text-xs mt-1">
                      📚 Class: {activeSchedule.class}
                    </Text>
                  )}
                  
                  {activeSchedule.subject && (
                    <Text className="text-slate-300 text-xs mt-1">
                      📖 Subject: {activeSchedule.subject}
                    </Text>
                  )}

                  <View className="flex-row items-center mt-1.5">
                    <Text className="text-slate-400 text-xs">
                      🏢 Campus: 
                    </Text>
                    <Text className="text-slate-200 text-xs font-bold ml-1">
                      {activeSchedule.campus}
                    </Text>
                  </View>
                  <Text className="text-slate-400 text-xs mt-1.5">
                    📅 Date: {activeSchedule.date}
                  </Text>
                  <Text className="text-slate-400 text-xs mt-1">
                    ⏱️ {isAdmin ? 'Shift Hours' : 'Scheduled'}: {activeSchedule.startTime} - {activeSchedule.endTime}
                  </Text>
                </View>
              ) : (
                <Text className="text-slate-400 text-xs font-semibold py-2">
                  No active session today. Check again later.
                </Text>
              )}
            </View>

            {/* Live GPS Coordinates Info */}
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider">
                  Live Geofence Boundary
                </Text>
                {isLogging && (
                  <View className="flex-row items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <View className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <Text className="text-emerald-400 text-[8px] font-black uppercase">Tracking Active</Text>
                  </View>
                )}
              </View>

              {currentCoords ? (
                <View className="space-y-2">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-500 text-xs font-semibold">Institute Center</Text>
                    <Text className="text-slate-400 text-xs font-bold">
                      {activeSchedule?.campusCoords?.lat ?? FALLBACK_LAT}, {activeSchedule?.campusCoords?.lon ?? FALLBACK_LON}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-500 text-xs font-semibold">Current Coords</Text>
                    <Text className="text-slate-100 text-xs font-black">
                      {currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-500 text-xs font-semibold">Allowed Radius</Text>
                    <Text className="text-slate-400 text-xs font-bold">{GEOFENCE_RADIUS_METERS} meters</Text>
                  </View>
                  
                  <View className="pt-3 border-t border-slate-800/80 flex-row justify-between items-center">
                    <Text className="text-slate-500 text-xs font-semibold">Distance Offset</Text>
                    <Text className={`text-sm font-black ${isInside ? 'text-green-400' : 'text-red-400'}`}>
                      {distance !== null ? `${distance.toFixed(1)} meters` : 'N/A'}
                    </Text>
                  </View>

                  <View className="flex-row justify-end mt-2">
                    <View className={`px-3 py-1 rounded-full border ${isInside ? 'bg-green-500/15 border-green-500/30' : 'bg-red-500/15 border-red-500/30'}`}>
                      <Text className={`text-[9px] font-black uppercase tracking-wider ${isInside ? 'text-green-400' : 'text-red-400'}`}>
                        {isInside ? '📍 Inside Geofence' : '❌ Outside Geofence'}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="py-4 items-center">
                  <Text className="text-slate-500 text-xs font-semibold">
                    No active GPS tracks. Tap start below to locate.
                  </Text>
                </View>
              )}
            </View>

            {/* Attendance Action Control Panel */}
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5">
              <Text className="text-slate-100 text-sm font-bold mb-4">⏱️ Session Tracker</Text>
              
              <View className="space-y-3">
                {!isLogging ? (
                  <TouchableOpacity
                    onPress={startLogging}
                    className="w-full bg-[#2D8C82] py-4 rounded-2xl items-center justify-center border border-[#3CA79B] shadow-lg shadow-teal-500/10 active:opacity-90"
                  >
                    <Text className="text-white text-xs font-bold uppercase tracking-wider">
                      {isAdmin ? 'Start Shift Session' : 'Start Attendance Session'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={stopLogging}
                      className="flex-1 bg-slate-950 border border-slate-800 py-3.5 rounded-2xl items-center justify-center active:bg-slate-900"
                    >
                      <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                        Pause Session
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleCheckout}
                      className="flex-[2] bg-blue-600 border border-blue-500 py-3.5 rounded-2xl items-center justify-center shadow-lg shadow-blue-500/10 active:opacity-90"
                    >
                      <Text className="text-white text-xs font-bold uppercase tracking-wider">
                        Check Out & Finalize
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {isLogging && (
                <View className="mt-4 pt-4 border-t border-slate-800/80 flex-row justify-between items-center">
                  <Text className="text-slate-500 text-xs font-semibold">Checks Tracked</Text>
                  <Text className="text-slate-100 text-xs font-black">
                    {pingStats.total} total ({pingStats.inside} inside, {pingStats.total - pingStats.inside} outside)
                  </Text>
                </View>
              )}
            </View>

            {/* Checkout Verdict Completed */}
            {checkoutVerdict && (
              <View className="bg-slate-900 border-2 border-blue-600 rounded-3xl p-5 mb-5">
                <Text className="text-blue-500 text-[10px] font-black uppercase tracking-wider mb-2">
                  Session Verdict Completed
                </Text>
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-slate-100 text-base font-black">Verdict Result</Text>
                  <View className={`px-3 py-1 rounded-full border ${getVerdictColor(checkoutVerdict.status)}`}>
                    <Text className="text-[10px] font-black tracking-wider uppercase">{checkoutVerdict.status}</Text>
                  </View>
                </View>
                <View className="space-y-1.5 pt-3 border-t border-slate-800/80">
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 text-xs font-semibold">Presence Ratio</Text>
                    <Text className="text-slate-100 text-xs font-bold">{(checkoutVerdict.presenceRatio * 100).toFixed(1)}%</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 text-xs font-semibold">Inside Geofence Checks</Text>
                    <Text className="text-slate-100 text-xs font-bold">{checkoutVerdict.insidePings} of {checkoutVerdict.totalPings}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Logs List Feed */}
            {loggedPings.length > 0 && (
              <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5">
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider mb-3">
                  Active Session Check History
                </Text>
                <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                  <View className="space-y-2">
                    {loggedPings.map((ping, idx) => (
                      <View key={idx} className="flex-row justify-between items-center py-1.5 border-b border-slate-850/60">
                        <View>
                          <Text className="text-[10px] text-slate-500 font-bold">{ping.timestamp} | Coords: {ping.coords}</Text>
                          <Text className="text-[11px] text-slate-300 mt-0.5">
                            Distance: {ping.success ? `${ping.distance.toFixed(1)}m` : 'Failed'}
                          </Text>
                        </View>
                        <View className={`px-2 py-0.5 rounded-full border ${ping.success ? (ping.isInside ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20') : 'bg-slate-500/10 border-slate-500/20'}`}>
                          <Text className={`text-[8px] font-black uppercase ${ping.success ? (ping.isInside ? 'text-green-400' : 'text-red-400') : 'text-slate-400'}`}>
                            {ping.success ? (ping.isInside ? 'Inside' : 'Outside') : 'Error'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Upcoming / Future Schedules */}
            <Text className="text-slate-100 text-base font-bold mb-3.5 mt-4">All Scheduled Routines</Text>
            {schedules.length === 0 ? (
              <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 items-center mb-5">
                <Text className="text-slate-500 text-xs font-semibold">No assigned routines found.</Text>
              </View>
            ) : (
              schedules.map((record) => {
                const isActive = activeSchedule?.id === record.id;
                return (
                  <TouchableOpacity
                    key={record.id}
                    onPress={() => {
                      if (isLogging) {
                        Alert.alert('Tracking Active', 'Please pause or check out of the current session before changing the schedule.');
                        return;
                      }
                      setActiveSchedule(record);
                      Alert.alert('Schedule Selected', `Active session set to: ${record.title}`);
                    }}
                    className={`bg-slate-900 rounded-3xl p-5 mb-3.5 border ${
                      isActive ? 'border-[#2D8C82] shadow-md shadow-teal-500/10' : 'border-slate-800'
                    }`}
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 mr-4">
                        <Text className={`text-sm font-bold ${isActive ? 'text-[#2D8C82]' : 'text-slate-100'}`}>
                          {record.title} {isActive ? ' (Selected)' : ''}
                        </Text>
                        <Text className="text-slate-500 text-[10px] mt-1 font-semibold">
                          ⏱️ {record.startTime} - {record.endTime}
                        </Text>
                        {(record.class || record.subject) && (
                          <Text className="text-slate-500 text-[10px] mt-0.5 font-semibold">
                            {record.class ? `📚 Class: ${record.class} ` : ''}
                            {record.subject ? `📖 Subject: ${record.subject}` : ''}
                          </Text>
                         )}
                      </View>
                      <View className="items-end justify-center">
                        <Text className={`text-xs font-black mb-1.5 ${isActive ? 'text-[#2D8C82]' : 'text-slate-300'}`}>
                          {new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </Text>
                        <View className={`px-2.5 py-1 rounded-full border ${isActive ? 'bg-[#2D8C82]/20 border-[#2D8C82]' : 'bg-blue-900/20 border-blue-500/30'}`}>
                          <Text className={`text-[9px] font-black uppercase tracking-wider ${isActive ? 'text-[#2D8C82]' : 'text-blue-400'}`}>{record.campus}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            {/* Completed Sessions Attendance History */}
            <Text className="text-slate-100 text-base font-bold mb-3.5 mt-4">Completed Attendance Logs</Text>
            {history.length === 0 ? (
              <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 items-center">
                <Text className="text-slate-500 text-xs font-semibold">No attendance log history found.</Text>
              </View>
            ) : (
              history.map((record) => (
                <View
                  key={record.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-3.5"
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 mr-4">
                      <Text className="text-slate-100 text-sm font-bold">
                        {record.schedule.title}
                      </Text>
                      <Text className="text-slate-500 text-[10px] mt-1 font-semibold">
                        📅 Date: {record.date}
                      </Text>
                      <Text className="text-slate-500 text-[10px] mt-0.5 font-semibold">
                        📶 Presence Ratio: {(record.presenceRatio * 100).toFixed(1)}% ({record.insidePings}/{record.totalPings} pings inside)
                      </Text>
                    </View>
                    <View className={`px-2.5 py-1 rounded-full border ${getVerdictColor(record.status)}`}>
                      <Text className="text-[9px] font-black uppercase tracking-wider">{record.status}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}

          </View>
        )}
      </ScrollView>
    </View>
  );
};
