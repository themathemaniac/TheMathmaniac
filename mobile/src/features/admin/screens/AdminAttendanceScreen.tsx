import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../../../core/api/client';
import { useAuthStore } from '../../../core/store/auth';
import * as Location from 'expo-location';

interface AttendanceRecord {
  id: string;
  loginTime: string;
  logoutTime?: string;
  workingHours?: number;
  checkInLat?: number;
  checkInLng?: number;
}

interface ShiftRecord {
  id: string;
  branch: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'BRANCH_DUTY' | 'FIELD_PROMOTION';
  attendances: AttendanceRecord[];
}

const CAMPUSES: Record<string, { lat: number; lon: number }> = {
  'Madhyamgram': { lat: 22.693230336542225, lon: 88.45923267330267 },
  'Sodepur': { lat: 22.703237523450426, lon: 88.37139070110229 },
};

export const AdminAttendanceScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [weeklyPatterns, setWeeklyPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  
  // Geolocation states
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

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

  const fetchShifts = async () => {
    try {
      const [shiftsRes, patternsRes] = await Promise.all([
        apiClient.get('/admin-attendance/shifts/my'),
        user ? apiClient.get(`/superuser/patterns/${user.id}`) : Promise.resolve({ data: { success: false, data: [] } })
      ]);

      if (shiftsRes.data.success) {
        const fetchedShifts: ShiftRecord[] = shiftsRes.data.data;
        setShifts(fetchedShifts);

        // Identify today's active shift (could be synthesized or override)
        const localDate = new Date();
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const localDateStr = `${year}-${month}-${day}`;

        const todaysShift = fetchedShifts.find(s => s.date === localDateStr);
        setActiveShift(todaysShift || null);
      }

      if (patternsRes.data.success) {
        setWeeklyPatterns(patternsRes.data.data);
      }
    } catch (e) {
      console.error('[Fetch Shifts / Patterns Error]', e);
      Alert.alert('Error', 'Unable to retrieve shift details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkPermissions = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    } catch (e) {
      console.log('Location permission request error:', e);
      setLocationPermission(false);
    }
  };

  useEffect(() => {
    checkPermissions();
    fetchShifts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchShifts();
  };

  // Live Location Tracker for UI
  const triggerLocationFetch = async (targetBranch: string) => {
    if (!locationPermission) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant location permissions to check in.');
        return null;
      }
      setLocationPermission(true);
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCurrentCoords(coords);

      const branchCoords = CAMPUSES[targetBranch];
      if (branchCoords) {
        const dist = calculateDistance(coords.latitude, coords.longitude, branchCoords.lat, branchCoords.lon);
        setDistance(dist);
        return { coords, dist };
      }
      return { coords, dist: null };
    } catch (e) {
      console.error('Error fetching current location:', e);
      Alert.alert('Location Error', 'Failed to retrieve GPS location. Please ensure Location Services are enabled.');
      return null;
    }
  };

  const handleCheckIn = async () => {
    if (!activeShift) return;

    setIsCheckingIn(true);
    const locResult = await triggerLocationFetch(activeShift.branch);
    if (!locResult) {
      setIsCheckingIn(false);
      return;
    }

    const { coords, dist } = locResult;

    try {
      const res = await apiClient.post('/admin-attendance/shifts/ping', {
        shiftId: activeShift.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (res.data.success) {
        Alert.alert('Check-In Success', `You have successfully checked in to your shift at ${activeShift.branch}.`);
        fetchShifts();
      }
    } catch (error: any) {
      console.log('Check-In Error:', error);
      Alert.alert(
        'Check-In Failed',
        error.response?.data?.error || 'Failed to check in. Please verify your location and network connection.'
      );
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeShift) return;

    Alert.alert(
      'Confirm Check-Out',
      'Are you sure you want to end your shift now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check-Out',
          onPress: async () => {
            setIsCheckingIn(true);
            const locResult = await triggerLocationFetch(activeShift.branch);
            const coords = locResult?.coords;

            try {
              const res = await apiClient.post('/admin-attendance/shifts/checkout', {
                shiftId: activeShift.id,
                latitude: coords?.latitude,
                longitude: coords?.longitude,
              });

              if (res.data.success) {
                Alert.alert(
                  'Check-Out Success',
                  `Shift completed! Total working hours: ${res.data.data.workingHours} hrs.`
                );
                fetchShifts();
              }
            } catch (error: any) {
              console.log('Check-Out Error:', error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to check out.');
            } finally {
              setIsCheckingIn(false);
            }
          },
        },
      ]
    );
  };

  // Aggregate monthly hours
  const totalShiftHours = React.useMemo(() => {
    return shifts.reduce((total, s) => {
      const att = s.attendances[0];
      if (att && att.workingHours) {
        return total + att.workingHours;
      }
      return total;
    }, 0);
  }, [shifts]);

  const activeAttendance = activeShift?.attendances[0];
  const isCheckedIn = activeAttendance && !activeAttendance.logoutTime;

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#2D8C82" />
        <Text className="text-slate-400 text-xs mt-4">Loading Shift Dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <ScrollView
        className="flex-1 px-5"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D8C82" />}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center py-6 border-b border-slate-900 mb-6">
          <View>
            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Mathemaniac Admin</Text>
            <Text className="text-slate-100 text-xl font-black mt-1">Hello, {user?.name}</Text>
          </View>
          <TouchableOpacity onPress={logout} className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
            <Text className="text-red-400 font-extrabold text-[10px] uppercase">Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Dashboard */}
        <View className="bg-slate-900 border border-slate-850 rounded-3xl p-5 mb-6 shadow-xl flex-row justify-around">
          <View className="items-center">
            <Text className="text-slate-500 text-[9px] font-black uppercase">Total Shifts</Text>
            <Text className="text-slate-100 text-2xl font-black mt-1">{shifts.length}</Text>
          </View>
          <View className="w-[1px] bg-slate-800" />
          <View className="items-center">
            <Text className="text-slate-500 text-[9px] font-black uppercase">Total Hours</Text>
            <Text className="text-slate-100 text-2xl font-black mt-1">{totalShiftHours.toFixed(1)}h</Text>
          </View>
        </View>

        {/* Weekly Schedule Overview */}
        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider mb-3">My Weekly Schedule</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, idx) => {
            const pattern = weeklyPatterns.find(p => p.dayOfWeek === idx);
            return (
              <View key={dayName} className={`mr-2.5 p-3 rounded-2xl border min-w-[90px] items-center ${pattern ? 'bg-[#2D8C82]/10 border-[#2D8C82]/30' : 'bg-slate-900/30 border-slate-850'}`}>
                <Text className={`text-[10px] font-black uppercase ${pattern ? 'text-[#2D8C82]' : 'text-slate-500'}`}>{dayName}</Text>
                {pattern ? (
                  <>
                    <Text className="text-slate-200 text-xs font-black mt-1">{pattern.branch}</Text>
                    <Text className="text-slate-400 text-[8px] mt-0.5">{pattern.startTime}</Text>
                  </>
                ) : (
                  <Text className="text-slate-600 text-[10px] font-bold mt-2">Holiday</Text>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Active Shift Card */}
        {activeShift ? (
          <View className="bg-slate-900 border border-slate-850 rounded-3xl p-5 mb-6 shadow-2xl">
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-slate-500 text-[9px] font-black uppercase">Active Shift Target</Text>
                <Text className="text-slate-100 text-lg font-black mt-0.5">{activeShift.branch} Branch</Text>
              </View>
              <View className={`px-2.5 py-1.5 rounded-xl border ${activeShift.type === 'FIELD_PROMOTION' ? 'bg-amber-600/10 border-amber-500/20' : 'bg-blue-600/10 border-blue-500/20'}`}>
                <Text className={`text-[9px] font-black uppercase ${activeShift.type === 'FIELD_PROMOTION' ? 'text-amber-400' : 'text-blue-400'}`}>
                  {activeShift.type === 'FIELD_PROMOTION' ? '📢 Outdoor Event' : '🏢 Branch Shift'}
                </Text>
              </View>
            </View>

            <View className="bg-slate-950 border border-slate-850 rounded-2xl p-4 mb-5">
              <View className="flex-row justify-between mb-2">
                <Text className="text-slate-500 text-xs">Date</Text>
                <Text className="text-slate-300 text-xs font-bold">{activeShift.date}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-slate-500 text-xs">Shift Timings</Text>
                <Text className="text-slate-300 text-xs font-bold">{activeShift.startTime} - {activeShift.endTime}</Text>
              </View>
            </View>

            {isCheckedIn ? (
              <View>
                <View className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-5 items-center">
                  <Text className="text-emerald-400 text-xs font-bold">✓ Checked In Since: {new Date(activeAttendance.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <TouchableOpacity
                  onPress={handleCheckOut}
                  disabled={isCheckingIn}
                  className="bg-red-600 border border-red-700 py-4 rounded-2xl items-center shadow-lg active:opacity-90"
                >
                  {isCheckingIn ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-white text-sm font-black uppercase tracking-wider">End Shift (Check Out)</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : activeAttendance && activeAttendance.logoutTime ? (
              <View className="bg-slate-950 border border-slate-850 rounded-2xl p-4 items-center">
                <Text className="text-slate-400 text-xs font-bold">Shift Completed Successfully</Text>
                <Text className="text-slate-500 text-[10px] mt-1">Logged out at {new Date(activeAttendance.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleCheckIn}
                disabled={isCheckingIn}
                className="bg-[#2D8C82] border border-[#237068] py-4 rounded-2xl items-center shadow-lg active:opacity-90"
              >
                {isCheckingIn ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-sm font-black uppercase tracking-wider">Check In to Shift</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="bg-slate-900 border border-slate-850 rounded-3xl p-6 mb-6 shadow-xl items-center">
            <Text className="text-slate-400 text-xs font-bold">No shifts scheduled for today.</Text>
            <Text className="text-slate-500 text-[10px] mt-1 text-center">Contact your superuser to assign shifts.</Text>
          </View>
        )}

        {/* Timetable/Upcoming Shifts */}
        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider mb-3">Timetable / Upcoming Shifts</Text>
        {shifts.length > 0 ? (
          shifts.map(shift => (
            <View key={shift.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-4 mb-3 shadow-md">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-slate-200 text-sm font-extrabold">{shift.branch} Branch</Text>
                <Text className="text-slate-400 text-[10px] font-semibold">{shift.date}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-slate-500 text-xs">{shift.startTime} - {shift.endTime}</Text>
                <Text className={`text-[10px] font-extrabold uppercase ${shift.type === 'FIELD_PROMOTION' ? 'text-amber-500' : 'text-blue-500'}`}>
                  {shift.type === 'FIELD_PROMOTION' ? 'Outdoor' : 'In-Office'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text className="text-slate-600 text-xs py-4 text-center">No shifts logged.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
